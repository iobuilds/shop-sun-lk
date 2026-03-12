import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload, ChevronRight, Clock, CheckCircle, XCircle, Truck, Package,
  Info, AlertCircle, FileDown, Building, RefreshCcw,
  AlertTriangle, Layers, Cpu, FileText, Wrench, X, ImageIcon,
  Plus, Eye, ExternalLink, FlaskConical, Download, MessageSquare
} from "lucide-react";
import GerberViewer from "@/components/GerberViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { generatePCBInvoice } from "@/lib/generatePCBInvoice";
import { logSiteAction } from "@/lib/logSiteAction";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending:          { label: "Pending Review",               color: "text-yellow-600 bg-yellow-50 border-yellow-200",      icon: Clock },
  quoted:           { label: "Quoted",                        color: "text-blue-600 bg-blue-50 border-blue-200",            icon: Info },
  under_review:     { label: "Revision Required",            color: "text-orange-600 bg-orange-50 border-orange-200",     icon: AlertCircle },
  revision_paying:  { label: "Revision Payment — On Hold",   color: "text-amber-700 bg-amber-50 border-amber-300",        icon: Clock },
  approved:         { label: "Approved — Payment Confirmed",  color: "text-green-600 bg-green-50 border-green-200",        icon: CheckCircle },
  sourcing:         { label: "Manufacturing",                 color: "text-purple-600 bg-purple-50 border-purple-200",     icon: Cpu },
  arrived:          { label: "Boards Ready — Pay Charges",   color: "text-secondary bg-secondary/10 border-secondary/30", icon: Package },
  shipped:          { label: "Shipped",                       color: "text-indigo-600 bg-indigo-50 border-indigo-200",     icon: Truck },
  completed:        { label: "Delivered",                     color: "text-green-700 bg-green-50 border-green-300",        icon: CheckCircle },
  cancelled:        { label: "Cancelled",                     color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
};

const SURFACE_FINISHES = ["HASL", "HASL Lead-Free", "ENIG", "OSP", "ENEPIG"];
const PCB_COLORS = ["Green", "Red", "Blue", "Black", "White", "Yellow"];
const THICKNESSES = ["0.8mm", "1.0mm", "1.2mm", "1.6mm", "2.0mm", "2.4mm"];
const LAYER_COUNTS = [1, 2, 4, 6, 8];

const COLOR_SWATCHES: Record<string, string> = {
  Green: "#1a6b2e", Red: "#8b0000", Blue: "#0a3d8f",
  Black: "#1a1a1a", White: "#e8e8e8", Yellow: "#b8860b",
};

interface GerberEntry {
  file: File;
  quantity: string;
  layer_count: string;
  surface_finish: string;
  board_thickness: string;
  pcb_color: string;
  showPreview: boolean;
  stencil_needed: boolean;
  assembly_needed: boolean;
  pnpFile: File | null;
  bomFile: File | null;
}

const defaultGerberSpec = (): Omit<GerberEntry, "file"> => ({
  quantity: "5",
  layer_count: "2",
  surface_finish: "HASL",
  board_thickness: "1.6mm",
  pcb_color: "Green",
  showPreview: false,
  stencil_needed: false,
  assembly_needed: false,
  pnpFile: null,
  bomFile: null,
});

export default function PCBOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<any>(null);
  const [tab, setTab] = useState<"new" | "my">(searchParams.get("tab") === "my" ? "my" : "new");

  // Multiple gerber entries
  const [gerberEntries, setGerberEntries] = useState<GerberEntry[]>([]);
  const [gerberDragging, setGerberDragging] = useState(false);

  // Global note and images (shared across all boards)
  const [customerNote, setCustomerNote] = useState("");
  const [noteImages, setNoteImages] = useState<File[]>([]);
  const [noteImagePreviews, setNoteImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  // Payment state
  const [bankTransferDialog, setBankTransferDialog] = useState<{ open: boolean; orderId: string; type: "quote" | "arrival"; amount: number } | null>(null);
  const [slipUploading, setSlipUploading] = useState(false);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Handle Stripe return — auto-mark as paid on success
  useEffect(() => {
    const payment = searchParams.get("payment");
    const orderId = searchParams.get("id");
    const type = searchParams.get("type") as "quote" | "arrival" | null;
    if (payment === "success" && orderId && type) {
      const verify = async () => {
        try {
          const field = type === "arrival" ? "arrival_payment_status" : "payment_status";
          const extraUpdate = type !== "arrival" ? { status: "approved" } : {};
          await (supabase as any).from("pcb_order_requests").update({ [field]: "paid", ...extraUpdate }).eq("id", orderId);
          toast({ title: "✅ Payment confirmed!", description: "Your PCB order has been updated." });
          refetchOrders();
        } catch { /* silent */ }
      };
      verify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: myOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["my-pcb-orders", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data } = await (supabase as any)
        .from("pcb_order_requests").select("*")
        .eq("user_id", session.user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!session?.user?.id,
  });

  // Realtime subscription — auto-refresh orders when any row for this user changes
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("pcb-orders-realtime")
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "pcb_order_requests",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => { refetchOrders(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, refetchOrders]);

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-pcb"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("*").eq("key", "bank_details").maybeSingle();
      const val = (data as any)?.value;
      if (Array.isArray(val)) return val as any[];
      if (val?.accounts) return val.accounts as any[];
      if (val && typeof val === "object") return [val] as any[];
      return [] as any[];
    },
  });

  const { data: paymentSettings } = useQuery({
    queryKey: ["payment-settings-pcb"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "payment_methods").single();
      return data?.value as any || {};
    },
  });

  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings-invoice"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "company_info").maybeSingle();
      return (data as any)?.value as any || {};
    },
  });

  const { data: pcbNotice } = useQuery({
    queryKey: ["pcb-process-notice"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "pcb_process_notice").maybeSingle();
      return (data as any)?.value as { steps?: string[]; enabled?: boolean } | null;
    },
  });

  const bankEnabled = paymentSettings?.bank_transfer_enabled === true || paymentSettings?.bank_transfer === true;
  const stripeEnabled = paymentSettings?.stripe_enabled !== false;

  const isQuoteExpired = (order: any) => {
    if (order.status !== "quoted" || !order.quoted_at) return false;
    return Date.now() > new Date(order.quoted_at).getTime() + 48 * 60 * 60 * 1000;
  };

  const getQuoteTimeLeft = (order: any) => {
    if (!order.quoted_at) return "";
    const diff = new Date(order.quoted_at).getTime() + 48 * 60 * 60 * 1000 - Date.now();
    if (diff <= 0) return "Expired";
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m left`;
  };

  const validateAndAddGerber = (file: File) => {
    const allowed = [".zip", ".rar", ".gbr", ".ger", ".gtl", ".gbl", ".gbs", ".gts", ".gko"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      toast({ title: "Invalid file type", description: "Please upload a ZIP, RAR, or Gerber file.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB per file.", variant: "destructive" });
      return;
    }
    setGerberEntries(prev => [...prev, { file, ...defaultGerberSpec() }]);
  };

  const removeGerberEntry = (idx: number) => {
    setGerberEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const updateGerberEntry = (idx: number, updates: Partial<GerberEntry>) => {
    setGerberEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...updates } : e));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setGerberDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => validateAndAddGerber(f));
  };

  const addNoteImages = (files: FileList) => {
    const newFiles = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 5 - noteImages.length);
    if (newFiles.length === 0) return;
    setNoteImages(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => setNoteImagePreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeNoteImage = (idx: number) => {
    setNoteImages(prev => prev.filter((_, i) => i !== idx));
    setNoteImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from("images").upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("images").getPublicUrl(path).data.publicUrl;
  };

  /** Bundle multiple files into one ZIP and upload it */
  const bundleAndUploadGerbers = async (entries: GerberEntry[], uid: string, ts: number): Promise<{ url: string; names: string }> => {
    if (entries.length === 1) {
      const f = entries[0].file;
      const ext = f.name.split(".").pop();
      const url = await uploadFile(f, `pcb-gerbers/${uid}-${ts}.${ext}`);
      return { url, names: f.name };
    }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const entry of entries) {
      zip.file(entry.file.name, entry.file);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const bundleFile = new File([blob], `gerbers-bundle.zip`, { type: "application/zip" });
    const url = await uploadFile(bundleFile, `pcb-gerbers/${uid}-${ts}-bundle.zip`);
    return { url, names: entries.map(e => e.file.name).join(", ") };
  };

  const handleSubmit = async () => {
    if (!session) { navigate("/auth"); return; }
    if (gerberEntries.length === 0) {
      toast({ title: "Gerber file required", description: "Please add at least one Gerber file.", variant: "destructive" });
      return;
    }
    for (const entry of gerberEntries) {
      if (parseInt(entry.quantity) < 5) {
        toast({ title: "Minimum 5 pcs", description: `${entry.file.name}: minimum order is 5 boards.`, variant: "destructive" });
        return;
      }
      if (entry.assembly_needed && !entry.pnpFile) {
        toast({ title: "PnP file required", description: `${entry.file.name}: Please upload a Pick & Place file for assembly.`, variant: "destructive" });
        return;
      }
      if (entry.assembly_needed && !entry.bomFile) {
        toast({ title: "BOM file required", description: `${entry.file.name}: Please upload a BOM file for assembly.`, variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    try {
      const ts = Date.now();
      const uid = session.user.id;

      // Bundle all gerber files
      const { url: gerberUrl, names: gerberFileNames } = await bundleAndUploadGerbers(gerberEntries, uid, ts);

      // Upload per-board assembly files
      const boardNoteParts: string[] = [];
      for (let i = 0; i < gerberEntries.length; i++) {
        const entry = gerberEntries[i];
        const boardLabel = gerberEntries.length > 1 ? `Board ${i + 1} (${entry.file.name})` : entry.file.name;

        let boardNote = `[${boardLabel}] qty=${entry.quantity} layers=${entry.layer_count} finish=${entry.surface_finish} thick=${entry.board_thickness} color=${entry.pcb_color}`;
        if (entry.stencil_needed) boardNote += " [STENCIL]";
        if (entry.assembly_needed) boardNote += " [ASSEMBLY]";

        if (entry.assembly_needed && entry.pnpFile) {
          const pnpUrl = await uploadFile(entry.pnpFile, `pcb-extras/${uid}-${ts}-b${i}-pnp.${entry.pnpFile.name.split(".").pop()}`);
          boardNote += `\n  PnP: ${pnpUrl}`;
        }
        if (entry.assembly_needed && entry.bomFile) {
          const bomUrl = await uploadFile(entry.bomFile, `pcb-extras/${uid}-${ts}-b${i}-bom.${entry.bomFile.name.split(".").pop()}`);
          boardNote += `\n  BOM: ${bomUrl}`;
        }
        boardNoteParts.push(boardNote);
      }

      // Note images
      const noteImageUrls: string[] = [];
      for (let i = 0; i < noteImages.length; i++) {
        const url = await uploadFile(noteImages[i], `pcb-notes/${uid}-${ts}-img${i}.${noteImages[i].name.split(".").pop()}`);
        noteImageUrls.push(url);
      }

      const fullNote = [
        ...boardNoteParts,
        customerNote.trim() || "",
        noteImageUrls.length > 0 ? `[Reference Images]: ${noteImageUrls.join(", ")}` : "",
      ].filter(Boolean).join("\n");

      const firstEntry = gerberEntries[0];

      const { error } = await (supabase as any).from("pcb_order_requests").insert({
        user_id: uid,
        quantity: parseInt(firstEntry.quantity),
        layer_count: parseInt(firstEntry.layer_count) || 2,
        surface_finish: firstEntry.surface_finish,
        board_thickness: firstEntry.board_thickness,
        pcb_color: firstEntry.pcb_color,
        customer_note: fullNote || null,
        gerber_file_url: gerberUrl,
        gerber_file_name: gerberEntries.length > 1 ? `${gerberEntries.length} files: ${gerberFileNames}` : firstEntry.file.name,
      });
      if (error) throw error;

      toast({ title: "✅ PCB order submitted!", description: "We'll review and provide a quote shortly." });
      setGerberEntries([]);
      setCustomerNote("");
      setNoteImages([]); setNoteImagePreviews([]);
      setTab("my"); refetchOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openBankTransfer = (orderId: string, type: "quote" | "arrival", amount: number) => {
    setSlipUrl(null);
    setBankTransferDialog({ open: true, orderId, type, amount });
  };

  const handleSlipUpload = async (file: File, existingSlipUrl?: string) => {
    const orderId = bankTransferDialog?.orderId;
    const type = bankTransferDialog?.type;
    if (!orderId || !type) return;
    if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10MB.", variant: "destructive" }); return; }
    setSlipUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pcb-slips/${orderId}-${type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from("images").getPublicUrl(path).data.publicUrl;
      setSlipUrl(publicUrl);
      const field = type === "arrival" ? "arrival_slip_url" : "slip_url";
      const statusField = type === "arrival" ? "arrival_payment_status" : "payment_status";
      await (supabase as any).from("pcb_order_requests").update({ [field]: publicUrl, [statusField]: "under_review" }).eq("id", orderId);
      toast({ title: "Slip uploaded!", description: "Your payment is now under review. We'll notify you once approved." });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setSlipUploading(false); }
  };

  const handleStripePayment = async (orderId: string, type: "quote" | "arrival") => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { navigate("/auth"); return; }
      const { data, error } = await supabase.functions.invoke("pcb-checkout", {
        body: { pcb_order_id: orderId, payment_type: type },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
    }
  };

  const handleReRequest = async (orderId: string) => {
    try {
      await (supabase as any).from("pcb_order_requests").update({ status: "pending", payment_status: "unpaid", quoted_at: null }).eq("id", orderId);
      toast({ title: "Re-requested", description: "We'll update the quote shortly." });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenChat = async (order: any) => {
    if (!session) { navigate("/auth"); return; }
    try {
      const shortId = order.id.slice(0, 8).toUpperCase();
      // Find existing conversation for this PCB order or create one
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", session.user.id)
        .ilike("subject", `%PCB-${shortId}%`)
        .limit(1);

      let convoId: string;
      if (existing && existing.length > 0) {
        convoId = existing[0].id;
      } else {
        const { data: newConvo, error } = await supabase
          .from("conversations")
          .insert({ user_id: session.user.id, subject: `PCB Order PCB-${shortId}`, status: "open" })
          .select("id").single();
        if (error) throw error;
        convoId = newConvo.id;
      }
      navigate(`/profile?tab=messages&convo=${convoId}`);
    } catch (err: any) {
      toast({ title: "Could not open chat", description: err.message, variant: "destructive" });
    }
  };

  const handleApproveQuote = async (orderId: string) => {
    try {
      // Move to revision_paying — user must now pay the additional amount
      await (supabase as any).from("pcb_order_requests").update({ status: "revision_paying" }).eq("id", orderId);
      toast({ title: "Revision approved! Please upload payment for the additional amount." });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRevisionSlipUpload = async (file: File, orderId: string, currentNotes: string) => {
    try {
      const ext = file.name.split(".").pop();
      const path = `pcb-revision-slips/${orderId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path);
      // Append slip tag to admin_notes
      const cleanNotes = (currentNotes || "").split("\n").filter((l: string) => !l.startsWith("[revision_slip]:")).join("\n").trim();
      const newNotes = [cleanNotes, `[revision_slip]:${publicUrl}`].filter(Boolean).join("\n");
      await (supabase as any).from("pcb_order_requests").update({ admin_notes: newNotes }).eq("id", orderId);
      toast({ title: "Slip uploaded — waiting for admin to approve revision payment." });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadInvoice = async (order: any) => {
    setDownloadingInvoice(order.id);
    try {
      const profile = session?.user?.id ? null : null; // profile fetched separately if needed
      await generatePCBInvoice(order, siteSettings || {});
    } catch (err: any) {
      toast({ title: "Failed to generate invoice", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const canPay = (o: any) => o.status === "quoted" && !isQuoteExpired(o) && o.payment_status !== "paid" && o.payment_status !== "under_review" && o.grand_total > 0;
  const canPayArrival = (o: any) => o.status === "arrived" && o.arrival_payment_status !== "paid" && o.arrival_payment_status !== "under_review" && ((o.arrival_shipping_fee || 0) + (o.arrival_tax_amount || 0)) > 0;
  // Needs approval when admin sent revision (under_review)
  const needsApproval = (o: any) => o.status === "under_review";
  // Needs revision payment when user approved revision but hasn't paid yet
  const needsRevisionPayment = (o: any) => {
    if (o.status !== "revision_paying") return false;
    const slipLine = (o.admin_notes || "").split("\n").find((l: string) => l.startsWith("[revision_slip]:"));
    return !slipLine; // no slip yet → needs payment
  };
  // Revision slip submitted, awaiting admin review
  const revisionSlipUnderReview = (o: any) => {
    if (o.status !== "revision_paying") return false;
    const slipLine = (o.admin_notes || "").split("\n").find((l: string) => l.startsWith("[revision_slip]:"));
    return !!slipLine;
  };
  const getRevisionExtra = (o: any): number => {
    const line = (o.admin_notes || "").split("\n").find((l: string) => l.startsWith("[revision_extra]:"));
    return line ? parseFloat(line.replace("[revision_extra]:", "")) || 0 : 0;
  };
  const getRevisionNote = (o: any): string => {
    const line = (o.admin_notes || "").split("\n").find((l: string) => l.startsWith("[revision_note]:"));
    return line ? line.replace("[revision_note]:", "").trim() : "";
  };

  return (
    <>
      <SEOHead title="PCB Manufacturing Order | NanoCircuit.lk" description="Submit your PCB design for manufacturing. Upload Gerber files, specify board specs, and get a quote." />
      <Navbar />
      <div className="min-h-screen bg-background pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <ChevronRight className="w-3 h-3" /><span>PCB Order</span>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display text-foreground">PCB Manufacturing</h1>
                <p className="text-sm text-muted-foreground">Upload Gerber files and get a custom quote</p>
              </div>
            </div>
          </div>

          {/* PCB Process Notice Banner */}
          {pcbNotice?.enabled !== false && (
            <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground">How PCB Manufacturing Works</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {(pcbNotice?.steps?.length
                  ? pcbNotice.steps
                  : [
                      "Submit Order & Gerber Files",
                      "We Review & Quote Price",
                      "Pay Initial Quote",
                      "Production Starts",
                      "Price Revision (if needed) — Your Approval",
                      "Final Payment Confirmed",
                      "Boards Arrive — Arrival Charges Added",
                      "Pay Shipping & Tax",
                      "PCBs Shipped to You",
                    ]
                ).map((step: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-xs bg-background border border-border rounded-lg px-2.5 py-1 text-foreground font-medium">
                      <span className="text-primary mr-1.5">{i + 1}.</span>{step}
                    </span>
                  </div>
                ))}
              </div>

              {/* JLCPCB Partner Capabilities */}
              <div className="border-t border-primary/15 pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">Manufacturing Partner: <span className="text-foreground font-semibold">JLCPCB</span></span>
                  <a href="https://jlcpcb.com/capabilities/pcb-capabilities" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline ml-auto flex items-center gap-1">
                    Full specs <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Layers", value: "1–16 layers" },
                    { label: "Min Trace/Space", value: "5 mil / 5 mil" },
                    { label: "Board Size", value: "up to 500×500mm" },
                    { label: "Min Hole Size", value: "0.2 mm" },
                    { label: "Surface Finish", value: "HASL, ENIG, OSP…" },
                    { label: "Solder Mask", value: "6 colors available" },
                    { label: "Thickness", value: "0.4 – 2.4 mm" },
                    { label: "Lead Time", value: "2–7 business days" },
                  ].map(cap => (
                    <div key={cap.label} className="bg-background/70 border border-border rounded-lg px-2.5 py-1.5">
                      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{cap.label}</p>
                      <p className="text-xs font-semibold text-foreground leading-tight">{cap.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8">
            <button onClick={() => setTab("new")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${tab === "new" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              New PCB Order
            </button>
            <button onClick={() => setTab("my")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all inline-flex items-center justify-center gap-1.5 ${tab === "my" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              My Orders
              {myOrders && myOrders.length > 0 && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{myOrders.length}</span>}
              {session?.user?.id && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Live updates enabled" />}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === "new" && (
              <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

                {/* ── Gerber Upload ── */}
                <div className="bg-card border border-border rounded-xl p-5 mb-5">
                  <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" /> Upload Gerber Files
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">You can add multiple boards — each with its own specs and services. They'll be submitted as one order.</p>

                  {/* Hidden file input always present */}
                  <input ref={fileInputRef} type="file" className="hidden" multiple
                    accept=".zip,.rar,.gbr,.ger,.gtl,.gbl,.gbs,.gts,.gko"
                    onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => validateAndAddGerber(f)); }} />

                  {/* Gerber entry cards — shown first when files exist */}
                  {gerberEntries.length > 0 && (
                    <div className="space-y-4 mb-4">
                      {gerberEntries.map((entry, idx) => (
                        <GerberEntryCard
                          key={idx}
                          entry={entry}
                          idx={idx}
                          onUpdate={(updates) => updateGerberEntry(idx, updates)}
                          onRemove={() => removeGerberEntry(idx)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Drop zone — always shown, moves below cards once files are added */}
                  <div
                    onDragOver={e => { e.preventDefault(); setGerberDragging(true); }}
                    onDragLeave={() => setGerberDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl cursor-pointer transition-all ${gerberDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"} ${gerberEntries.length > 0 ? "p-3" : "p-6"}`}
                  >
                    <div className={`flex items-center justify-center gap-2 ${gerberEntries.length > 0 ? "flex-row" : "flex-col"}`}>
                      <Plus className={`text-muted-foreground shrink-0 ${gerberEntries.length > 0 ? "w-4 h-4" : "w-7 h-7"}`} />
                      {gerberEntries.length > 0 ? (
                        <span className="text-sm text-muted-foreground">Add another Gerber file</span>
                      ) : (
                        <>
                          <p className="font-medium text-foreground text-sm">Drop Gerber files here or click to browse</p>
                          <p className="text-xs text-muted-foreground">ZIP, RAR, GBR supported · max 50MB per file</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Additional Notes (global) ── */}
                <div className="bg-card border border-border rounded-xl p-5 mb-5">
                  <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Additional Notes
                  </h2>
                  <Textarea
                    value={customerNote}
                    onChange={e => setCustomerNote(e.target.value)}
                    placeholder="e.g. special requirements, IPC class, controlled impedance, reference designators to skip..."
                    rows={3} className="mb-3"
                  />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> Attach Reference Images (optional, max 5)
                    </Label>
                    {noteImagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {noteImagePreviews.map((src, i) => (
                          <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => removeNoteImage(i)}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {noteImages.length < 5 && (
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                            <Upload className="w-5 h-5 text-muted-foreground" />
                            <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) addNoteImages(e.target.files); }} />
                          </label>
                        )}
                      </div>
                    )}
                    {noteImagePreviews.length === 0 && (
                      <label className="flex items-center gap-2 border-2 border-dashed border-border rounded-lg px-4 py-2.5 cursor-pointer hover:border-primary/50 transition-colors text-sm text-muted-foreground w-full">
                        <ImageIcon className="w-4 h-4" /><span>Add reference images (JPG, PNG)</span>
                        <input ref={noteImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) addNoteImages(e.target.files); }} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5 text-sm text-muted-foreground flex gap-3">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>We'll review your files and send a quote within 24 hours. Quotes are valid for 48 hours. Payment follows a two-step flow: initial cost, then arrival shipping &amp; tax.</div>
                </div>

                <Button onClick={handleSubmit} disabled={submitting || gerberEntries.length === 0} className="w-full" size="lg">
                  {submitting ? "Submitting…" : `Submit PCB Order${gerberEntries.length > 1 ? ` (${gerberEntries.length} boards)` : ""}`}
                </Button>
              </motion.div>
            )}

            {tab === "my" && (
              <motion.div key="my" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {!session ? (
                  <div className="text-center py-12">
                    <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">Sign in to view your PCB orders</p>
                    <Button onClick={() => navigate("/auth")}>Sign In</Button>
                  </div>
                ) : !myOrders?.length ? (
                  <div className="text-center py-12">
                    <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">No PCB orders yet</p>
                    <Button variant="outline" onClick={() => setTab("new")}>Submit First Order</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myOrders.map((order: any) => {
                      const expired = isQuoteExpired(order);
                      const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
                      const StatusIcon = statusInfo.icon;
                      const shortId = order.id.slice(0, 8).toUpperCase();
                      const arrivalTotal = (order.arrival_shipping_fee || 0) + (order.arrival_tax_amount || 0);

                      // 9-step workflow stage mapping
                      const WORKFLOW_STEPS = [
                        { label: "Order Submitted", statuses: ["pending"], step: 1 },
                        { label: "Review & Quote", statuses: ["quoted", "under_review"], step: 2 },
                        { label: "Pay Initial Quote", statuses: ["quoted"], step: 3 },
                        { label: "Production Starts", statuses: ["approved", "sourcing"], step: 4 },
                        { label: "Price Revision", statuses: ["under_review"], step: 5 },
                        { label: "Final Payment", statuses: ["approved"], step: 6 },
                        { label: "Boards Arrived", statuses: ["arrived"], step: 7 },
                        { label: "Pay Shipping & Tax", statuses: ["arrived"], step: 8 },
                        { label: "Shipped to You", statuses: ["shipped", "completed"], step: 9 },
                      ];

                      const getActiveStep = (status: string): number => {
                        if (status === "pending") return 1;
                        if (status === "quoted") return 3;
                        if (status === "under_review") return 5;
                        if (status === "revision_paying") return 5;
                        if (status === "approved") return 4;
                        if (status === "sourcing") return 4;
                        if (status === "arrived") return 7;
                        if (status === "shipped") return 9;
                        if (status === "completed") return 9;
                        if (status === "cancelled") return 0;
                        return 1;
                      };

                      const activeStep = getActiveStep(order.status);
                      const isCancelled = order.status === "cancelled";

                      return (
                        <motion.div key={order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-card border border-border rounded-xl p-5">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <p className="font-semibold text-foreground">PCB-{shortId}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {order.quantity} pcs · {order.pcb_color} · {order.board_thickness}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {expired && order.status === "quoted" ? "Quote Expired" : statusInfo.label}
                            </span>
                          </div>

                          {/* ── 9-Step Workflow Progress Tracker ── */}
                          {!isCancelled && (
                            <div className="mb-4 bg-muted/30 rounded-xl p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Order Progress</p>
                              <div className="relative">
                                {/* Progress line */}
                                <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" />
                                <div
                                  className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500"
                                  style={{ width: `${Math.max(0, ((activeStep - 1) / 8) * 100)}%` }}
                                />
                                {/* Steps */}
                                <div className="relative flex justify-between">
                                  {[
                                    { n: 1, label: "Submitted" },
                                    { n: 2, label: "Quoted" },
                                    { n: 3, label: "Pay Quote" },
                                    { n: 4, label: "Production" },
                                    { n: 5, label: "Revision" },
                                    { n: 6, label: "Confirmed" },
                                    { n: 7, label: "Arrived" },
                                    { n: 8, label: "Pay Charges" },
                                    { n: 9, label: "Shipped" },
                                  ].map(({ n, label }) => {
                                    const isDone = activeStep > n;
                                    const isActive = activeStep === n;
                                    return (
                                      <div key={n} className="flex flex-col items-center gap-1.5 w-8">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all text-xs font-bold z-10 relative
                                          ${isDone ? "bg-primary border-primary text-primary-foreground" :
                                            isActive ? "bg-primary/15 border-primary text-primary" :
                                            "bg-background border-border text-muted-foreground"}`}>
                                          {isDone ? <CheckCircle className="w-4 h-4" /> : n}
                                        </div>
                                        <span className={`text-[9px] leading-tight text-center ${isActive ? "text-primary font-semibold" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                                          {label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {order.gerber_file_url && (
                            <a href={order.gerber_file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3">
                              <FileDown className="w-3.5 h-3.5" /> {order.gerber_file_name || "Gerber File"}
                            </a>
                          )}

                          {/* Approval alert when admin revised quote */}
                          {needsApproval(order) && (() => {
                            const revExtra = getRevisionExtra(order);
                            const revNote = getRevisionNote(order);
                            const initialCost = Number(order.grand_total || 0) - revExtra;
                            const lines = (order.admin_notes || "").split("\n");
                            const imgLine = lines.find((l: string) => l.startsWith("[revision_images]:"));
                            const revImgs = imgLine ? imgLine.replace("[revision_images]:", "").split(",").filter(Boolean) : [];
                            return (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                                <p className="text-sm font-semibold text-orange-800 mb-1 flex items-center gap-1.5">
                                  <AlertCircle className="w-4 h-4" /> Revision Required — Your Approval Needed
                                </p>
                                {revNote && <p className="text-xs text-orange-700 mb-2 italic">"{revNote}"</p>}
                                {revImgs.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs text-orange-700 font-medium mb-1">Reference images:</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {revImgs.map((url: string, i: number) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded overflow-hidden border border-orange-200 aspect-square">
                                          <img src={url} alt={`ref-${i + 1}`} className="w-full h-full object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {order.grand_total > 0 && (
                                  <div className="bg-background border border-orange-200 rounded-lg p-2 mb-3 text-sm space-y-1">
                                    {initialCost > 0 && revExtra > 0 && <div className="flex justify-between text-muted-foreground"><span>Initial Quote</span><span>Rs. {initialCost.toLocaleString()}</span></div>}
                                    {revExtra > 0 && <div className="flex justify-between text-orange-700 font-medium"><span>Revision Charge</span><span>+ Rs. {revExtra.toLocaleString()}</span></div>}
                                    <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border"><span>New Total</span><span>Rs. {Number(order.grand_total).toLocaleString()}</span></div>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleApproveQuote(order.id)} className="gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5" /> Approve &amp; Pay Revision
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Revision payment — user approved, needs to pay extra amount */}
                          {needsRevisionPayment(order) && (() => {
                            const revExtra = getRevisionExtra(order);
                            const revNote = getRevisionNote(order);
                            return (
                              <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 mb-3">
                                <p className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" /> Revision Payment Required
                                </p>
                                {revNote && <p className="text-xs text-amber-700 mb-2 italic">"{revNote}"</p>}
                                {revExtra > 0 && (
                                  <div className="bg-background border border-amber-200 rounded-lg p-2 mb-3 text-sm">
                                    <div className="flex justify-between font-bold"><span>Additional Amount Due</span><span className="text-amber-800">Rs. {revExtra.toLocaleString()}</span></div>
                                  </div>
                                )}
                                <p className="text-xs text-amber-700 mb-2">Upload your bank transfer slip for the revision amount. Manufacturing resumes once approved.</p>
                                <label className="flex items-center gap-2 border border-amber-300 bg-background rounded-lg px-3 py-2 cursor-pointer hover:border-amber-500 transition-colors text-sm text-muted-foreground">
                                  <Upload className="w-4 h-4 text-amber-600 shrink-0" />
                                  Click to upload revision payment slip
                                  <input type="file" accept="image/*,.pdf" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleRevisionSlipUpload(f, order.id, order.admin_notes || ""); }} />
                                </label>
                              </div>
                            );
                          })()}

                          {/* Revision payment slip submitted — waiting admin review */}
                          {revisionSlipUnderReview(order) && (() => {
                            const revExtra = getRevisionExtra(order);
                            const slipLine = (order.admin_notes || "").split("\n").find((l: string) => l.startsWith("[revision_slip]:"));
                            const uploadedSlipUrl = slipLine ? slipLine.replace("[revision_slip]:", "").trim() : null;
                            return (
                              <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 mb-3">
                                <p className="text-sm font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" /> Revision Payment — Under Review
                                </p>
                                <p className="text-xs text-amber-700 mb-2">Your slip has been submitted. Manufacturing resumes once our team approves it.</p>
                                {revExtra > 0 && <p className="text-xs font-medium text-amber-800 mb-2">Amount: Rs. {revExtra.toLocaleString()}</p>}
                                {uploadedSlipUrl && (
                                  <div className="mb-2">
                                    <a href={uploadedSlipUrl} target="_blank" rel="noopener noreferrer">
                                      <img src={uploadedSlipUrl} alt="Revision slip" className="max-h-32 rounded-lg border border-amber-200 object-contain bg-white mb-1.5" onError={e => (e.currentTarget.style.display = "none")} />
                                    </a>
                                    <a href={uploadedSlipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View full slip ↗</a>
                                  </div>
                                )}
                                {/* Allow re-submission */}
                                <label className="inline-flex items-center gap-1.5 text-xs text-amber-700 underline cursor-pointer hover:text-amber-900 mt-1">
                                  <Upload className="w-3 h-3" /> Re-upload slip
                                  <input type="file" accept="image/*,.pdf" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleRevisionSlipUpload(f, order.id, order.admin_notes || ""); }} />
                                </label>
                              </div>
                            );
                          })()}



                          {(order.status === "quoted" || (order.grand_total > 0 && order.status !== "under_review")) && !expired && order.status !== "under_review" && (
                            <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm space-y-1">
                              {order.unit_cost_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Board Cost</span><span>Rs. {Number(order.unit_cost_total).toLocaleString()}</span></div>}
                              {order.shipping_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Rs. {Number(order.shipping_fee).toLocaleString()}</span></div>}
                              {order.tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>Rs. {Number(order.tax_amount).toLocaleString()}</span></div>}
                              {order.grand_total > 0 && <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>Rs. {Number(order.grand_total).toLocaleString()}</span></div>}
                              {order.quoted_at && <p className="text-xs text-muted-foreground pt-1">⏱ {getQuoteTimeLeft(order)}</p>}
                            </div>
                          )}

                          {order.status === "arrived" && arrivalTotal > 0 && (
                            <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-3 mb-3 text-sm space-y-1">
                              <p className="font-medium text-secondary mb-1">Arrival Charges</p>
                              {order.arrival_shipping_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Rs. {Number(order.arrival_shipping_fee).toLocaleString()}</span></div>}
                              {order.arrival_tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax / Customs</span><span>Rs. {Number(order.arrival_tax_amount).toLocaleString()}</span></div>}
                              <div className="flex justify-between font-semibold pt-1 border-t border-secondary/20"><span>Total Due</span><span>Rs. {arrivalTotal.toLocaleString()}</span></div>
                            </div>
                          )}

                          {order.payment_status === "under_review" && (
                            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 mb-3">
                              <p className="text-xs font-semibold text-yellow-800 mb-1.5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Payment slip submitted — under review
                              </p>
                              {order.slip_url && (
                                <div className="mb-1.5">
                                  <a href={order.slip_url} target="_blank" rel="noopener noreferrer">
                                    <img src={order.slip_url} alt="Payment slip" className="max-h-28 rounded border border-yellow-200 object-contain bg-white mb-1" onError={e => (e.currentTarget.style.display = "none")} />
                                  </a>
                                  <a href={order.slip_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View full slip ↗</a>
                                </div>
                              )}
                              {/* Allow re-submission */}
                              <label className="inline-flex items-center gap-1.5 text-xs text-yellow-700 underline cursor-pointer hover:text-yellow-900 mt-0.5">
                                <Upload className="w-3 h-3" /> Re-upload slip
                                <input type="file" accept="image/*,.pdf" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) openBankTransfer(order.id, "quote", order.grand_total); }} />
                              </label>
                            </div>
                          )}
                          {order.payment_status === "unpaid" && order.slip_url === null && order.status === "quoted" && !expired && (
                            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-3">
                              <AlertTriangle className="w-3.5 h-3.5" /> Your payment slip was rejected. Please re-upload.
                            </div>
                          )}
                          {order.arrival_payment_status === "under_review" && (
                            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 mb-3">
                              <p className="text-xs font-semibold text-yellow-800 mb-1.5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Arrival payment slip submitted — under review
                              </p>
                              {order.arrival_slip_url && (
                                <div className="mb-1.5">
                                  <a href={order.arrival_slip_url} target="_blank" rel="noopener noreferrer">
                                    <img src={order.arrival_slip_url} alt="Arrival slip" className="max-h-28 rounded border border-yellow-200 object-contain bg-white mb-1" onError={e => (e.currentTarget.style.display = "none")} />
                                  </a>
                                  <a href={order.arrival_slip_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View full slip ↗</a>
                                </div>
                              )}
                              <label className="inline-flex items-center gap-1.5 text-xs text-yellow-700 underline cursor-pointer hover:text-yellow-900 mt-0.5">
                                <Upload className="w-3 h-3" /> Re-upload slip
                                <input type="file" accept="image/*,.pdf" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) openBankTransfer(order.id, "arrival", arrivalTotal); }} />
                              </label>
                            </div>
                          )}

                          {order.admin_notes && (() => {
                            const lines = order.admin_notes.split("\n");
                            const SKIP_PREFIXES = ["stripe_session:", "[revision_images]:", "[revision_extra]:", "[revision_note]:", "[revision_slip]:"];
                            const cleanNotes = lines.filter((l: string) => !SKIP_PREFIXES.some(p => l.startsWith(p))).join("\n").trim();
                            const imgLine = lines.find((l: string) => l.startsWith("[revision_images]:"));
                            const revImgs = imgLine ? imgLine.replace("[revision_images]:", "").split(",").filter(Boolean) : [];
                            return (
                              <>
                                {cleanNotes ? <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-3 italic">"{cleanNotes}"</p> : null}
                                {revImgs.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">Reference images from our team:</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      {revImgs.map((url: string, i: number) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border aspect-square hover:opacity-90 transition-opacity">
                                          <img src={url} alt={`ref-${i + 1}`} className="w-full h-full object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          <div className="flex gap-2 flex-wrap">
                            {canPay(order) && stripeEnabled && (
                              <Button size="sm" className="gap-1.5" onClick={() => handleStripePayment(order.id, "quote")}>
                                <ExternalLink className="w-3.5 h-3.5" /> Pay Online
                              </Button>
                            )}
                            {canPay(order) && bankEnabled && (
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openBankTransfer(order.id, "quote", order.grand_total)}>
                                <Building className="w-3.5 h-3.5" /> Bank Transfer
                              </Button>
                            )}
                            {canPayArrival(order) && stripeEnabled && (
                              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => handleStripePayment(order.id, "arrival")}>
                                <ExternalLink className="w-3.5 h-3.5" /> Pay Arrival Charges
                              </Button>
                            )}
                            {canPayArrival(order) && bankEnabled && (
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openBankTransfer(order.id, "arrival", arrivalTotal)}>
                                <Building className="w-3.5 h-3.5" /> Bank — Arrival
                              </Button>
                            )}
                            {expired && order.status === "quoted" && (
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleReRequest(order.id)}>
                                <RefreshCcw className="w-3.5 h-3.5" /> Re-request Quote
                              </Button>
                            )}
                            {order.grand_total > 0 && ["quoted", "under_review", "approved", "sourcing", "arrived", "shipped", "completed"].includes(order.status) && (
                              <Button size="sm" variant="outline" className="gap-1.5"
                                disabled={downloadingInvoice === order.id}
                                onClick={() => handleDownloadInvoice(order)}>
                                <Download className="w-3.5 h-3.5" /> {downloadingInvoice === order.id ? "Generating…" : "Download Invoice"}
                              </Button>
                            )}
                            {/* Chat with support button */}
                            <Button size="sm" variant="outline" className="gap-1.5"
                              onClick={() => handleOpenChat(order)}>
                              <MessageSquare className="w-3.5 h-3.5" /> Chat with Support
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bank Transfer Dialog */}
      <Dialog open={!!bankTransferDialog?.open} onOpenChange={() => setBankTransferDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bank Transfer Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Amount to Pay</p>
              <p className="text-2xl font-bold text-primary">Rs. {bankTransferDialog?.amount.toLocaleString()}</p>
            </div>
            {bankAccounts && bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {bankAccounts.map((acc: any, i: number) => (
                  <div key={i} className="border border-border rounded-lg p-3 text-sm space-y-1">
                    <p className="font-semibold text-foreground">{acc.bank_name || acc.bankName}</p>
                    {(acc.account_name || acc.accountName) && <p className="text-muted-foreground">Account: {acc.account_name || acc.accountName}</p>}
                    {(acc.account_number || acc.accountNumber) && <p className="font-mono font-medium">{acc.account_number || acc.accountNumber}</p>}
                    {(acc.branch || acc.branch_name) && <p className="text-muted-foreground">Branch: {acc.branch || acc.branch_name}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-sm text-center py-4">No bank accounts configured.</p>}
            <div>
              <Label className="text-sm font-medium mb-2 block">Upload Payment Slip</Label>
              {slipUrl ? (
                <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" /> 
                    <span className="font-medium">Payment slip submitted — under review</span>
                  </div>
                  <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                    <img src={slipUrl} alt="Payment slip" className="max-h-40 rounded border border-green-200 object-contain bg-white w-full" onError={e => (e.currentTarget.style.display = "none")} />
                  </a>
                  <a href={slipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">View full slip ↗</a>
                  {/* Allow re-submission */}
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline cursor-pointer hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {slipUploading ? "Uploading..." : "Submit a different slip"}
                    <input type="file" accept="image/*,.pdf" className="hidden" disabled={slipUploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleSlipUpload(f); }} />
                  </label>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{slipUploading ? "Uploading..." : "Click to upload slip (JPG, PNG, PDF)"}</p>
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={slipUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleSlipUpload(f); }} />
                </label>
              )}
            </div>
            {!slipUrl && <p className="text-xs text-muted-foreground text-center">Once uploaded, your payment will show as "under review" until we confirm it.</p>}
            <Button onClick={() => setBankTransferDialog(null)} variant="outline" className="w-full">{slipUrl ? "Done" : "Cancel"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </>
  );
}

// ─── Per-Gerber Entry Card ───────────────────────────────────────────────────

interface GerberEntryCardProps {
  entry: GerberEntry;
  idx: number;
  onUpdate: (updates: Partial<GerberEntry>) => void;
  onRemove: () => void;
}

function GerberEntryCard({ entry, idx, onUpdate, onRemove }: GerberEntryCardProps) {
  const pnpRef = useRef<HTMLInputElement>(null);
  const bomRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{entry.file.name}</p>
            <p className="text-xs text-muted-foreground">Board {idx + 1} · {(entry.file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={() => onUpdate({ showPreview: !entry.showPreview })}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
            <Eye className="w-3 h-3" /> {entry.showPreview ? "Hide" : "Preview"}
          </button>
          <button onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Per-board specs */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Quantity <span className="text-primary">(min. 5)</span></Label>
          <Input type="number" min="5" value={entry.quantity}
            onChange={e => onUpdate({ quantity: e.target.value })}
            placeholder="min. 5" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Board Thickness</Label>
          <Select value={entry.board_thickness} onValueChange={v => onUpdate({ board_thickness: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {THICKNESSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Per-board Additional Services ── */}
      <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" /> Additional Services for this board
        </p>

        {/* Stencil */}
        <div className="flex items-center justify-between py-2 px-3 border border-border rounded-lg bg-background">
          <div>
            <p className="text-sm font-medium text-foreground">Stencil Needed</p>
            <p className="text-xs text-muted-foreground">Include a solder paste stencil</p>
          </div>
          <Switch checked={entry.stencil_needed} onCheckedChange={v => onUpdate({ stencil_needed: v })} />
        </div>

        {/* Assembly */}
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">PCB Assembly (PCBA)</p>
              <p className="text-xs text-muted-foreground">We solder components onto your board</p>
            </div>
            <Switch checked={entry.assembly_needed} onCheckedChange={v => onUpdate({ assembly_needed: v, pnpFile: null, bomFile: null })} />
          </div>
          <AnimatePresence>
            {entry.assembly_needed && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="border-t border-border px-3 py-3 bg-muted/30 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assembly Files</p>
                  {/* PnP */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Pick &amp; Place File (CSV/XLS) <span className="text-destructive">*</span>
                    </Label>
                    {entry.pnpFile ? (
                      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 text-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="flex-1 truncate text-foreground text-xs">{entry.pnpFile.name}</span>
                        <button onClick={() => onUpdate({ pnpFile: null })} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2 cursor-pointer hover:border-primary/50 transition-colors text-xs text-muted-foreground">
                        <Upload className="w-3.5 h-3.5" /><span>Upload PnP file</span>
                        <input ref={pnpRef} type="file" accept=".csv,.xls,.xlsx,.txt" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) onUpdate({ pnpFile: f }); }} />
                      </label>
                    )}
                  </div>
                  {/* BOM */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Bill of Materials (CSV/XLS) <span className="text-destructive">*</span>
                    </Label>
                    {entry.bomFile ? (
                      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 text-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="flex-1 truncate text-foreground text-xs">{entry.bomFile.name}</span>
                        <button onClick={() => onUpdate({ bomFile: null })} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2 cursor-pointer hover:border-primary/50 transition-colors text-xs text-muted-foreground">
                        <Upload className="w-3.5 h-3.5" /><span>Upload BOM file</span>
                        <input ref={bomRef} type="file" accept=".csv,.xls,.xlsx,.txt" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) onUpdate({ bomFile: f }); }} />
                      </label>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Gerber Preview */}
      <AnimatePresence>
        {entry.showPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            {/* Experimental banner */}
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">Experimental Preview</span>
              <span className="text-amber-600">— This is an approximate reference view only, not a final manufacturing preview.</span>
            </div>
            <div className="p-3">
              <GerberViewer file={entry.file} pcbColor={entry.pcb_color} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
