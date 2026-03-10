import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Upload, ChevronRight, Clock, CheckCircle, XCircle, Truck, Package, Info, ShoppingBag, AlertCircle, FileDown, CreditCard, RefreshCcw, AlertTriangle, Building, Layers, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "Pending Review",              color: "text-yellow-600 bg-yellow-50 border-yellow-200",    icon: Clock },
  quoted:    { label: "Quoted",                      color: "text-blue-600 bg-blue-50 border-blue-200",          icon: Info },
  approved:  { label: "Approved — Payment Confirmed", color: "text-green-600 bg-green-50 border-green-200",      icon: CheckCircle },
  sourcing:  { label: "Manufacturing",               color: "text-purple-600 bg-purple-50 border-purple-200",   icon: Cpu },
  arrived:   { label: "Boards Ready — Pay Charges",  color: "text-secondary bg-secondary/10 border-secondary/30", icon: Package },
  shipped:   { label: "Shipped",                     color: "text-indigo-600 bg-indigo-50 border-indigo-200",    icon: Truck },
  completed: { label: "Delivered",                   color: "text-green-700 bg-green-50 border-green-300",       icon: CheckCircle },
  cancelled: { label: "Cancelled",                   color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
};

const SURFACE_FINISHES = ["HASL", "HASL Lead-Free", "ENIG", "OSP", "ENEPIG"];
const PCB_COLORS = ["Green", "Red", "Blue", "Black", "White", "Yellow"];
const THICKNESSES = ["0.8mm", "1.0mm", "1.2mm", "1.6mm", "2.0mm", "2.4mm"];
const LAYER_COUNTS = [1, 2, 4, 6, 8];

export default function PCBOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<any>(null);
  const [tab, setTab] = useState<"new" | "my">(searchParams.get("tab") === "my" ? "my" : "new");

  // Form state
  const [form, setForm] = useState({
    quantity: "5",
    layer_count: "2",
    surface_finish: "HASL",
    board_thickness: "1.6mm",
    pcb_color: "Green",
    customer_note: "",
  });
  const [gerberFile, setGerberFile] = useState<File | null>(null);
  const [gerberDragging, setGerberDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Payment state
  const [bankTransferDialog, setBankTransferDialog] = useState<{ open: boolean; orderId: string; type: "quote" | "arrival"; amount: number } | null>(null);
  const [slipUploading, setSlipUploading] = useState(false);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const { data: myOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["my-pcb-orders", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data } = await (supabase as any)
        .from("pcb_order_requests")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!session?.user?.id,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-pcb"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("*").eq("key", "bank_details").maybeSingle();
      const val = (data as any)?.value;
      if (Array.isArray(val)) return val as any[];
      if (val && typeof val === "object" && Array.isArray(val.accounts)) return val.accounts as any[];
      if (val && typeof val === "object" && !Array.isArray(val)) return [val] as any[];
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

  const bankEnabled = paymentSettings?.bank_transfer_enabled === true || paymentSettings?.bank_transfer === true;

  const isQuoteExpired = (order: any) => {
    if (order.status !== "quoted" || !order.quoted_at) return false;
    const expiresAt = new Date(order.quoted_at).getTime() + 48 * 60 * 60 * 1000;
    return Date.now() > expiresAt;
  };

  const getQuoteTimeLeft = (order: any) => {
    if (!order.quoted_at) return "";
    const expiresAt = new Date(order.quoted_at).getTime() + 48 * 60 * 60 * 1000;
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}m left`;
  };

  const handleGerberDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setGerberDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetGerber(file);
  };

  const validateAndSetGerber = (file: File) => {
    const allowed = [".zip", ".rar", ".gbr", ".ger", ".gtl", ".gbl", ".gbs", ".gts", ".gko"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      toast({ title: "Invalid file type", description: "Please upload a ZIP, RAR, or Gerber file.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB allowed.", variant: "destructive" });
      return;
    }
    setGerberFile(file);
  };

  const handleSubmit = async () => {
    if (!session) { navigate("/auth"); return; }
    if (!gerberFile) {
      toast({ title: "Gerber file required", description: "Please upload your Gerber files.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Upload Gerber file
      const ext = gerberFile.name.split(".").pop();
      const path = `pcb-gerbers/${session.user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("images").upload(path, gerberFile, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);

      const { error } = await (supabase as any).from("pcb_order_requests").insert({
        user_id: session.user.id,
        quantity: parseInt(form.quantity) || 1,
        layer_count: parseInt(form.layer_count) || 2,
        surface_finish: form.surface_finish,
        board_thickness: form.board_thickness,
        pcb_color: form.pcb_color,
        customer_note: form.customer_note.trim() || null,
        gerber_file_url: urlData.publicUrl,
        gerber_file_name: gerberFile.name,
      });
      if (error) throw error;

      toast({ title: "✅ PCB order submitted!", description: "We'll review and provide a quote shortly." });
      setForm({ quantity: "5", layer_count: "2", surface_finish: "HASL", board_thickness: "1.6mm", pcb_color: "Green", customer_note: "" });
      setGerberFile(null);
      setTab("my");
      refetchOrders();
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

  const handleSlipUpload = async (file: File) => {
    if (!bankTransferDialog) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB.", variant: "destructive" });
      return;
    }
    setSlipUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pcb-slips/${bankTransferDialog.orderId}-${bankTransferDialog.type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setSlipUrl(publicUrl);

      const field = bankTransferDialog.type === "arrival" ? "arrival_slip_url" : "slip_url";
      const statusField = bankTransferDialog.type === "arrival" ? "arrival_payment_status" : "payment_status";
      await (supabase as any).from("pcb_order_requests").update({
        [field]: publicUrl,
        [statusField]: "under_review",
      }).eq("id", bankTransferDialog.orderId);

      toast({ title: "Slip uploaded!", description: "Your payment is under review. We'll notify you once approved." });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setSlipUploading(false);
    }
  };

  const handleReRequest = async (orderId: string) => {
    try {
      await (supabase as any).from("pcb_order_requests").update({
        status: "pending", payment_status: "unpaid", quoted_at: null,
      }).eq("id", orderId);
      toast({ title: "Re-requested", description: "We'll update the quote shortly." });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const canPay = (order: any) =>
    order.status === "quoted" &&
    !isQuoteExpired(order) &&
    order.payment_status !== "paid" &&
    order.payment_status !== "under_review" &&
    order.grand_total > 0;

  const canPayArrival = (order: any) =>
    order.status === "arrived" &&
    order.arrival_payment_status !== "paid" &&
    order.arrival_payment_status !== "under_review" &&
    (order.arrival_shipping_fee || 0) + (order.arrival_tax_amount || 0) > 0;

  return (
    <>
      <SEOHead title="PCB Manufacturing Order | NanoCircuit.lk" description="Submit your PCB design for manufacturing. Upload Gerber files, specify board specs, and get a quote." />
      <Navbar />
      <div className="min-h-screen bg-background pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span>PCB Order</span>
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

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8">
            {(["new", "my"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "new" ? "New PCB Order" : "My Orders"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "new" && (
              <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {/* Gerber Upload */}
                <div className="bg-card border border-border rounded-xl p-5 mb-5">
                  <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" /> Upload Gerber Files
                  </h2>
                  <div
                    onDragOver={e => { e.preventDefault(); setGerberDragging(true); }}
                    onDragLeave={() => setGerberDragging(false)}
                    onDrop={handleGerberDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${gerberDragging ? "border-primary bg-primary/5" : gerberFile ? "border-green-400 bg-green-50" : "border-border hover:border-primary/50 hover:bg-muted/50"}`}
                  >
                    {gerberFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <p className="font-medium text-foreground">{gerberFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(gerberFile.size / 1024).toFixed(1)} KB</p>
                        <button onClick={e => { e.stopPropagation(); setGerberFile(null); }}
                          className="text-xs text-destructive hover:underline mt-1">Remove file</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="font-medium text-foreground">Drop Gerber files here</p>
                        <p className="text-xs text-muted-foreground">or click to browse — ZIP, RAR, GBR supported (max 50MB)</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept=".zip,.rar,.gbr,.ger,.gtl,.gbl,.gbs,.gts,.gko"
                      onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetGerber(f); }} />
                  </div>
                </div>

                {/* Board Specs */}
                <div className="bg-card border border-border rounded-xl p-5 mb-5">
                  <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" /> Board Specifications
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Quantity</Label>
                      <Input type="number" min="1" value={form.quantity}
                        onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                        placeholder="e.g. 5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Layer Count</Label>
                      <Select value={form.layer_count} onValueChange={v => setForm(f => ({ ...f, layer_count: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LAYER_COUNTS.map(l => <SelectItem key={l} value={String(l)}>{l} Layer{l > 1 ? "s" : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Surface Finish</Label>
                      <Select value={form.surface_finish} onValueChange={v => setForm(f => ({ ...f, surface_finish: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SURFACE_FINISHES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Board Thickness</Label>
                      <Select value={form.board_thickness} onValueChange={v => setForm(f => ({ ...f, board_thickness: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {THICKNESSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground mb-1.5 block">PCB Color</Label>
                      <div className="flex gap-2 flex-wrap">
                        {PCB_COLORS.map(c => (
                          <button key={c} onClick={() => setForm(f => ({ ...f, pcb_color: c }))}
                            className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-all ${form.pcb_color === c ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Additional Notes (optional)</Label>
                    <Textarea value={form.customer_note} onChange={e => setForm(f => ({ ...f, customer_note: e.target.value }))}
                      placeholder="e.g. special requirements, IPC class, controlled impedance..." rows={3} />
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5 text-sm text-muted-foreground flex gap-3">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>We'll review your Gerber files and send a quote within 24 hours. Quotes are valid for 48 hours. Payment follows a two-step flow: initial cost, then arrival shipping &amp; tax.</div>
                </div>

                <Button onClick={handleSubmit} disabled={submitting || !gerberFile} className="w-full" size="lg">
                  {submitting ? "Submitting..." : "Submit PCB Order"}
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

                      return (
                        <motion.div key={order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-card border border-border rounded-xl p-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="font-semibold text-foreground">PCB-{shortId}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {order.quantity} pcs · {order.layer_count} Layer · {order.surface_finish} · {order.pcb_color}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {expired && order.status === "quoted" ? "Quote Expired" : statusInfo.label}
                            </span>
                          </div>

                          {/* Gerber file link */}
                          {order.gerber_file_url && (
                            <a href={order.gerber_file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3">
                              <FileDown className="w-3.5 h-3.5" /> {order.gerber_file_name || "Gerber File"}
                            </a>
                          )}

                          {/* Quote details */}
                          {(order.status === "quoted" || order.grand_total > 0) && !expired && (
                            <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm space-y-1">
                              {order.unit_cost_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Board Cost</span><span>Rs. {Number(order.unit_cost_total).toLocaleString()}</span></div>}
                              {order.shipping_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Rs. {Number(order.shipping_fee).toLocaleString()}</span></div>}
                              {order.shipping_fee === -1 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-secondary font-medium">After arrival</span></div>}
                              {order.tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>Rs. {Number(order.tax_amount).toLocaleString()}</span></div>}
                              {order.grand_total > 0 && <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>Rs. {Number(order.grand_total).toLocaleString()}</span></div>}
                              {order.quoted_at && <p className="text-xs text-muted-foreground pt-1">⏱ {getQuoteTimeLeft(order)}</p>}
                            </div>
                          )}

                          {/* Arrival charges */}
                          {order.status === "arrived" && arrivalTotal > 0 && (
                            <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-3 mb-3 text-sm space-y-1">
                              <p className="font-medium text-secondary mb-1">Arrival Charges</p>
                              {order.arrival_shipping_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Rs. {Number(order.arrival_shipping_fee).toLocaleString()}</span></div>}
                              {order.arrival_tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax / Customs</span><span>Rs. {Number(order.arrival_tax_amount).toLocaleString()}</span></div>}
                              <div className="flex justify-between font-semibold pt-1 border-t border-secondary/20"><span>Total Due</span><span>Rs. {arrivalTotal.toLocaleString()}</span></div>
                            </div>
                          )}

                          {/* Payment statuses */}
                          {order.payment_status === "under_review" && (
                            <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3">
                              <Clock className="w-3.5 h-3.5" /> Payment slip submitted — under review
                              {order.slip_url && <a href={order.slip_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary hover:underline">View slip</a>}
                            </div>
                          )}
                          {order.payment_status === "unpaid" && order.slip_url === null && order.status === "quoted" && !expired && (
                            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-3">
                              <AlertTriangle className="w-3.5 h-3.5" /> Your payment slip was rejected. Please re-upload.
                            </div>
                          )}
                          {order.arrival_payment_status === "under_review" && (
                            <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3">
                              <Clock className="w-3.5 h-3.5" /> Arrival payment under review
                              {order.arrival_slip_url && <a href={order.arrival_slip_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary hover:underline">View slip</a>}
                            </div>
                          )}

                          {/* Admin notes */}
                          {order.admin_notes && (
                            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-3 italic">"{order.admin_notes}"</p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 flex-wrap">
                            {canPay(order) && bankEnabled && (
                              <Button size="sm" className="gap-1.5" onClick={() => openBankTransfer(order.id, "quote", order.grand_total)}>
                                <Building className="w-3.5 h-3.5" /> Bank Transfer
                              </Button>
                            )}
                            {canPayArrival(order) && bankEnabled && (
                              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => openBankTransfer(order.id, "arrival", arrivalTotal)}>
                                <Building className="w-3.5 h-3.5" /> Pay Arrival Charges
                              </Button>
                            )}
                            {expired && order.status === "quoted" && (
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleReRequest(order.id)}>
                                <RefreshCcw className="w-3.5 h-3.5" /> Re-request Quote
                              </Button>
                            )}
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
          <DialogHeader>
            <DialogTitle>Bank Transfer Payment</DialogTitle>
          </DialogHeader>
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
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No bank accounts configured.</p>
            )}
            <div>
              <Label className="text-sm font-medium mb-2 block">Upload Payment Slip</Label>
              {slipUrl ? (
                <div className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" /> Slip uploaded successfully
                  <a href={slipUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary text-xs hover:underline">View</a>
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
            <Button onClick={() => setBankTransferDialog(null)} variant="outline" className="w-full">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </>
  );
}
