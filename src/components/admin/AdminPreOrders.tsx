import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, ExternalLink, MessageSquare, Clock, ShoppingBag, Info, ChevronDown, ChevronUp, DollarSign, Truck, ReceiptText, FileDown, CheckCircle, XCircle, Search, User, Phone, AlertTriangle, CreditCard, Eye, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function hexToRgbPO(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
}

async function loadPreorderTemplate() {
  try {
    const { data } = await (supabase as any).from("site_settings").select("value").eq("key", "preorder_invoice_template").maybeSingle();
    return (data as any)?.value || {};
  } catch { return {}; }
}

function loadLogoImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const STATUS_OPTIONS = [
  { value: "pending",   label: "Pending Review",  color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "quoted",    label: "Quoted",           color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "approved",  label: "Approved",         color: "bg-green-100 text-green-800 border-green-300" },
  { value: "sourcing",  label: "Sourcing",         color: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "arrived",   label: "Arrived",          color: "bg-secondary/20 text-secondary border-secondary/40" },
  { value: "shipped",   label: "Shipped",          color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { value: "completed", label: "Completed",        color: "bg-green-100 text-green-900 border-green-400" },
  { value: "cancelled", label: "Cancelled",        color: "bg-destructive/10 text-destructive border-destructive/30" },
];

interface AdminPreOrdersProps {
  requests: any[];
  onRefresh: () => void;
  allProfiles: any[];
  onOpenConversation?: (conversationId: string) => void;
}

const generatePreOrderInvoice = async (req: any, profile: any, companySettings?: any) => {
  const tpl = await loadPreorderTemplate();

  const primaryColor = tpl.primaryColor || "#323232";
  const accentColor = tpl.accentColor || "#dddddd";
  const fontFamily = tpl.fontFamily || "helvetica";
  const paperSize = tpl.paperSize || "a4";
  const currencySymbol = tpl.currencySymbol || "Rs.";
  const logoUrl = tpl.logoUrl || companySettings?.logo_url || "";

  const primRgb = hexToRgbPO(primaryColor);
  const accRgb = hexToRgbPO(accentColor);

  const doc = new jsPDF({ format: paperSize });
  const storeName = companySettings?.store_name || "NanoCircuit.lk";
  const shortId = req.id.slice(0, 8).toUpperCase();

  // Header
  let headerY = 25;
  if (logoUrl) {
    try {
      const img = await loadLogoImage(logoUrl);
      doc.addImage(img, "PNG", 20, 12, 40, 16);
      headerY = 32;
    } catch {
      doc.setFontSize(22); doc.setFont(fontFamily, "bold"); doc.text(storeName, 20, 25);
    }
  } else {
    doc.setFontSize(22); doc.setFont(fontFamily, "bold"); doc.text(storeName, 20, 25);
  }

  doc.setFontSize(8); doc.setFont(fontFamily, "normal"); doc.setTextColor(120, 120, 120);
  let compY = headerY + 5;
  if (companySettings?.address) { doc.text(companySettings.address, 20, compY); compY += 4; }
  if (companySettings?.phone) { doc.text(`Tel: ${companySettings.phone}`, 20, compY); compY += 4; }
  if (companySettings?.email) { doc.text(companySettings.email, 20, compY); compY += 4; }

  doc.setFontSize(14); doc.setTextColor(0, 0, 0); doc.setFont(fontFamily, "bold");
  doc.text("PRE-ORDER INVOICE", 190, 22, { align: "right" });

  doc.setFontSize(9); doc.setFont(fontFamily, "normal"); doc.setTextColor(80, 80, 80);
  doc.text(`Invoice #: PRE-${shortId}`, 190, 30, { align: "right" });
  doc.text(`Date: ${new Date(req.updated_at || req.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 190, 37, { align: "right" });
  doc.text(`Status: ${STATUS_OPTIONS.find(s => s.value === req.status)?.label || req.status}`, 190, 44, { align: "right" });

  if (req.quoted_at) {
    doc.setTextColor(200, 50, 50);
    doc.text("* Quote valid for 48 hours from issue date.", 190, 51, { align: "right" });
    doc.setTextColor(80, 80, 80);
  }

  doc.setDrawColor(accRgb.r, accRgb.g, accRgb.b);
  doc.line(20, 56, 190, 56);

  doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont(fontFamily, "bold");
  doc.text("Customer:", 20, 65);
  doc.setFont(fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  let y = 71;
  if (profile?.full_name) { doc.text(profile.full_name, 20, y); y += 5; }
  if (profile?.phone) { doc.text(`Tel: ${profile.phone}`, 20, y); y += 5; }

  const tableData = (req.preorder_items || []).map((it: any, i: number) => [
    String(i + 1),
    it.product_name || "Item",
    it.external_url ? "External" : "Store",
    String(it.quantity),
    it.unit_price ? `${currencySymbol} ${Number(it.unit_price).toLocaleString()}` : "—",
    it.unit_price ? `${currencySymbol} ${(Number(it.unit_price) * (it.quantity || 1)).toLocaleString()}` : "—",
  ]);

  autoTable(doc, {
    startY: Math.max(y + 8, 89),
    head: [["#", "Item", "Type", "Qty", "Unit Price", "Subtotal"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [primRgb.r, primRgb.g, primRgb.b], textColor: 255, fontSize: 9, font: fontFamily },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60], font: fontFamily },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 65 },
      2: { cellWidth: 20 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 33, halign: "right" },
      5: { cellWidth: 33, halign: "right" },
    },
    margin: { left: 20, right: 20 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  let sY = finalY + 10;
  const xL = 130, xV = 185;

  // Quote Summary header
  doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont(fontFamily, "bold");
  doc.text("Quote Summary", 20, sY); sY += 8;

  doc.setFontSize(9); doc.setTextColor(80, 80, 80); doc.setFont(fontFamily, "normal");

  const unitTotal = Number(req.unit_cost_total) || 0;
  const shipping = Number(req.shipping_fee);
  const tax = Number(req.tax_amount);
  const shippingTBA = shipping === -1;
  const taxTBA = tax === -1;

  if (unitTotal > 0) {
    doc.text("Items Total:", xL, sY);
    doc.text(`${currencySymbol} ${unitTotal.toLocaleString()}`, xV, sY, { align: "right" });
    sY += 6;
  }
  doc.text("Shipping Fee:", xL, sY);
  doc.text(shippingTBA ? "TBA (After Arrival)" : `${currencySymbol} ${Math.max(0, shipping).toLocaleString()}`, xV, sY, { align: "right" });
  sY += 6;

  doc.text("Tax / Custom Duty:", xL, sY);
  doc.text(taxTBA ? "TBA (After Arrival)" : `${currencySymbol} ${Math.max(0, tax).toLocaleString()}`, xV, sY, { align: "right" });
  sY += 8;

  doc.setDrawColor(200, 200, 200); doc.line(xL, sY - 2, xV, sY - 2);
  doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont(fontFamily, "bold");
  const grand = unitTotal + (shippingTBA ? 0 : Math.max(0, shipping)) + (taxTBA ? 0 : Math.max(0, tax));
  doc.text("Grand Total:", xL, sY + 3);
  doc.text(`${currencySymbol} ${grand.toLocaleString()}`, xV, sY + 3, { align: "right" });
  sY += 14;

  // Arrival charges
  const arrShipping = Number(req.arrival_shipping_fee || 0);
  const arrTax = Number(req.arrival_tax_amount || 0);
  if (arrShipping > 0 || arrTax > 0) {
    doc.setFontSize(10); doc.setFont(fontFamily, "bold"); doc.setTextColor(0, 0, 0);
    doc.text("Arrival Charges", 20, sY); sY += 7;
    doc.setFontSize(9); doc.setFont(fontFamily, "normal"); doc.setTextColor(80, 80, 80);
    doc.text("Arrival Shipping:", xL, sY);
    doc.text(`${currencySymbol} ${arrShipping.toLocaleString()}`, xV, sY, { align: "right" }); sY += 6;
    doc.text("Arrival Tax / Customs:", xL, sY);
    doc.text(`${currencySymbol} ${arrTax.toLocaleString()}`, xV, sY, { align: "right" }); sY += 8;
    doc.setDrawColor(200, 200, 200); doc.line(xL, sY - 2, xV, sY - 2);
    doc.setFontSize(11); doc.setFont(fontFamily, "bold"); doc.setTextColor(0, 0, 0);
    doc.text("Arrival Total:", xL, sY + 3);
    doc.text(`${currencySymbol} ${(arrShipping + arrTax).toLocaleString()}`, xV, sY + 3, { align: "right" });
    sY += 14;
  }

  if (req.admin_notes) {
    const SKIP = ["stripe_session:", "[revision_images]:", "[revision_extra]:", "[revision_note]:", "[revision_slip]:"];
    const cleanNotes = req.admin_notes.split("\n").filter((l: string) => !SKIP.some(p => l.startsWith(p))).join("\n").trim();
    if (cleanNotes) {
      doc.setFontSize(8); doc.setFont(fontFamily, "italic"); doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(`Note: ${cleanNotes}`, 165);
      doc.text(lines, 20, sY); sY += lines.length * 5;
    }
  }

  const footerY = paperSize === "letter" ? 265 : 280;
  const footerBlock = tpl.blocks?.find((b: any) => b.type === "footer" && b.visible !== false);
  const footerText = footerBlock?.content || `Thank you for your pre-order! | ${storeName}`;
  doc.setFontSize(8); doc.setFont(fontFamily, "normal"); doc.setTextColor(150, 150, 150);
  doc.text(footerText, 105, footerY, { align: "center" });

  doc.save(`PreOrder-Invoice-PRE${shortId}.pdf`);
};

export default function AdminPreOrders({ requests, onRefresh, allProfiles, onOpenConversation }: AdminPreOrdersProps) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    status: "",
    admin_notes: "",
    shipping_fee: "",
    tax_amount: "",
    shipping_after_arrival: false,
    tax_after_arrival: false,
  });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Arrival charges dialog
  const [arrivalDialog, setArrivalDialog] = useState(false);
  const [arrivalTarget, setArrivalTarget] = useState<any>(null);
  const [arrivalForm, setArrivalForm] = useState({ shipping: "", tax: "" });
  const [arrivalSaving, setArrivalSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const getProfile = (userId: string) =>
    allProfiles.find((p: any) => p.user_id === userId);

  // Filter by status and search by order ID, customer name, or phone
  const filtered = requests.filter(r => {
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const profile = getProfile(r.user_id);
    const q = searchQuery.toLowerCase();
    const matchSearch = !searchQuery ||
      r.id.toLowerCase().includes(q.replace(/[^a-f0-9-]/g, '')) ||
      (profile?.full_name || "").toLowerCase().includes(q) ||
      (profile?.phone || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const bulkDeletePreOrders = async () => {
    if (selectedRequests.size === 0) return;
    if (!confirm(`Delete ${selectedRequests.size} selected pre-order(s)? This cannot be undone.`)) return;
    const ids = Array.from(selectedRequests);
    for (const id of ids) {
      await supabase.from("preorder_items").delete().eq("preorder_id", id);
      await supabase.from("preorder_requests").delete().eq("id", id);
    }
    toast({ title: `${ids.length} pre-order(s) deleted` });
    setSelectedRequests(new Set());
    onRefresh();
  };

  const toggleSelectRequest = (id: string) => {
    setSelectedRequests(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filtered.every((r: any) => selectedRequests.has(r.id))) {
      setSelectedRequests(prev => { const next = new Set(prev); filtered.forEach((r: any) => next.delete(r.id)); return next; });
    } else {
      setSelectedRequests(prev => { const next = new Set(prev); filtered.forEach((r: any) => next.add(r.id)); return next; });
    }
  };

  // Check if quote is expired (48hrs)
  const isQuoteExpired = (req: any) => {
    if (req.status !== "quoted" || !req.quoted_at) return false;
    const expiresAt = new Date(req.quoted_at).getTime() + 48 * 60 * 60 * 1000;
    return Date.now() > expiresAt;
  };

  const openEdit = (req: any) => {
    setEditTarget(req);
    setEditItems(req.preorder_items?.map((it: any) => ({ ...it })) || []);
    setEditForm({
      status: req.status,
      admin_notes: req.admin_notes || "",
      shipping_fee: req.shipping_fee != null && req.shipping_fee !== -1 ? String(req.shipping_fee) : "",
      tax_amount: req.tax_amount != null && req.tax_amount !== -1 ? String(req.tax_amount) : "",
      shipping_after_arrival: req.shipping_fee === -1,
      tax_after_arrival: req.tax_amount === -1,
    });
    setEditDialog(true);
  };

  const updateItemPrice = (itemId: string, price: string) => {
    setEditItems(prev => prev.map(it => it.id === itemId ? { ...it, unit_price: price } : it));
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    const wasQuoted = editTarget.status !== "quoted" && editForm.status === "quoted";
    try {
      // Update item prices
      for (const item of editItems) {
        if (item.unit_price !== null && item.unit_price !== undefined && item.unit_price !== "") {
          await supabase.from("preorder_items").update({ unit_price: parseFloat(item.unit_price) || 0 }).eq("id", item.id);
        }
      }

      const unitCostTotal = editItems.reduce((sum, it) => sum + ((parseFloat(it.unit_price) || 0) * (it.quantity || 1)), 0);
      const shippingVal = editForm.shipping_after_arrival ? -1 : (parseFloat(editForm.shipping_fee) || 0);
      const taxVal = editForm.tax_after_arrival ? -1 : (parseFloat(editForm.tax_amount) || 0);
      // For SMS/notification display — exclude TBA (-1) values
      const grandTotal = unitCostTotal
        + (shippingVal > 0 ? shippingVal : 0)
        + (taxVal > 0 ? taxVal : 0);

      // grand_total is a GENERATED column (auto-computed by DB) — never include it in update payload
      const updatePayload: any = {
        status: editForm.status,
        admin_notes: editForm.admin_notes || null,
        shipping_fee: shippingVal,
        tax_amount: taxVal,
        unit_cost_total: unitCostTotal,
      };

      const { error } = await supabase.from("preorder_requests").update(updatePayload).eq("id", editTarget.id);
      if (error) throw error;

      // If status just became "quoted", send SMS + notification
      if (wasQuoted) {
        const profile = getProfile(editTarget.user_id);
        const phone = profile?.phone;
        const shortId = editTarget.id.slice(0, 8).toUpperCase();
        if (phone) {
          const message = `NanoCircuit.lk: Your pre-order PO-${shortId} has been quoted. Grand Total: Rs. ${grandTotal.toLocaleString()}. Quote valid for 48 hours. ${editForm.admin_notes ? editForm.admin_notes + " " : ""}Please log in to view and pay.`;
          await supabase.functions.invoke("send-sms", {
            body: { phone, message, order_id: editTarget.id, user_id: editTarget.user_id },
          });
        }
        await supabase.from("user_notifications").insert({
          user_id: editTarget.user_id,
          title: "Pre-Order Quoted",
          message: `Your pre-order PO-${shortId} has been quoted at Rs. ${grandTotal.toLocaleString()}. Valid for 48 hours.`,
          type: "order",
          link_url: "/pre-order?tab=my",
        });
      }

      toast({ title: "Pre-order updated" });
      setEditDialog(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Approve or reject a payment slip
  const handlePaymentReview = async (req: any, paymentType: "quote" | "arrival", action: "approve" | "reject") => {
    setApprovingId(req.id + paymentType);
    try {
      const shortId = req.id.slice(0, 8).toUpperCase();

      if (paymentType === "quote") {
        if (action === "approve") {
          // Approve quote payment → move to "approved"
          const { error } = await supabase.from("preorder_requests").update({
            payment_status: "paid",
            status: "approved",
          }).eq("id", req.id);
          if (error) throw error;
          // Notify user
          const profile = getProfile(req.user_id);
          await supabase.from("user_notifications").insert({
            user_id: req.user_id,
            title: "Payment Approved",
            message: `Your payment for pre-order PO-${shortId} has been approved. We're now sourcing your items!`,
            type: "order",
            link_url: "/pre-order?tab=my",
          });
          if (profile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: { phone: profile.phone, message: `NanoCircuit.lk: Payment approved for PO-${shortId}. We're now sourcing your items!`, order_id: req.id, user_id: req.user_id },
            });
          }
          toast({ title: "Payment approved", description: "Order moved to Approved." });
        } else {
          // Reject → reset to quoted, clear slip
          const { error } = await supabase.from("preorder_requests").update({
            payment_status: "unpaid",
            slip_url: null,
          }).eq("id", req.id);
          if (error) throw error;
          await supabase.from("user_notifications").insert({
            user_id: req.user_id,
            title: "Payment Rejected",
            message: `Your payment slip for pre-order PO-${shortId} was rejected. Please re-upload a valid slip.`,
            type: "order",
            link_url: "/pre-order?tab=my",
          });
          // Send SMS to user on rejection
          const rejectProfile = getProfile(req.user_id);
          if (rejectProfile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: {
                phone: rejectProfile.phone,
                message: `NanoCircuit.lk: Your payment slip for pre-order PO-${shortId} was rejected. Please log in and re-upload a valid bank transfer slip. nanocircuit.lk/pre-order`,
                order_id: req.id,
                user_id: req.user_id,
              },
            });
          }
          toast({ title: "Payment rejected — user notified by SMS" });
        }
      } else {
        // arrival payment
        if (action === "approve") {
          const { error } = await supabase.from("preorder_requests").update({
            arrival_payment_status: "paid",
            status: "shipped",
          }).eq("id", req.id);
          if (error) throw error;
          const profile = getProfile(req.user_id);
          await supabase.from("user_notifications").insert({
            user_id: req.user_id,
            title: "Arrival Payment Approved",
            message: `Arrival payment for PO-${shortId} approved. Your order is being shipped!`,
            type: "order",
            link_url: "/pre-order?tab=my",
          });
          if (profile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: { phone: profile.phone, message: `NanoCircuit.lk: Arrival payment approved for PO-${shortId}. Your order is being shipped!`, order_id: req.id, user_id: req.user_id },
            });
          }
          toast({ title: "Arrival payment approved", description: "Order moved to Shipped." });
        } else {
          const { error } = await supabase.from("preorder_requests").update({
            arrival_payment_status: "unpaid",
            arrival_slip_url: null,
          }).eq("id", req.id);
          if (error) throw error;
          await supabase.from("user_notifications").insert({
            user_id: req.user_id,
            title: "Arrival Payment Rejected",
            message: `Your arrival payment slip for pre-order PO-${shortId} was rejected. Please re-upload.`,
            type: "order",
            link_url: "/pre-order?tab=my",
          });
          // Send SMS to user on arrival rejection
          const rejectProfile = getProfile(req.user_id);
          if (rejectProfile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: {
                phone: rejectProfile.phone,
                message: `NanoCircuit.lk: Your arrival payment slip for pre-order PO-${shortId} was rejected. Please re-upload a valid slip to proceed. nanocircuit.lk/pre-order`,
                order_id: req.id,
                user_id: req.user_id,
              },
            });
          }
          toast({ title: "Arrival payment rejected — user notified by SMS" });
        }
      }

      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const openArrivalCharges = (req: any) => {
    setArrivalTarget(req);
    setArrivalForm({
      shipping: req.arrival_shipping_fee ? String(req.arrival_shipping_fee) : "",
      tax: req.arrival_tax_amount ? String(req.arrival_tax_amount) : "",
    });
    setArrivalDialog(true);
  };

  const handleArrivalSave = async () => {
    if (!arrivalTarget) return;
    setArrivalSaving(true);
    try {
      const shipping = parseFloat(arrivalForm.shipping) || 0;
      const tax = parseFloat(arrivalForm.tax) || 0;
      const { error } = await supabase.from("preorder_requests").update({
        arrival_shipping_fee: shipping,
        arrival_tax_amount: tax,
        arrival_payment_status: "unpaid",
        status: "arrived", // Auto-advance to arrived, same as PCB flow
      }).eq("id", arrivalTarget.id);
      if (error) throw error;

      const shortId = arrivalTarget.id.slice(0, 8).toUpperCase();
      const total = shipping + tax;
      await supabase.from("user_notifications").insert({
        user_id: arrivalTarget.user_id,
        title: "Items Arrived — Pay Arrival Charges",
        message: `Your pre-order PO-${shortId} items have arrived! Arrival charges: Rs. ${total.toLocaleString()}. Please log in and pay to complete.`,
        type: "order",
        link_url: "/pre-order?tab=my",
      });

      const profile = getProfile(arrivalTarget.user_id);
      if (profile?.phone) {
        await supabase.functions.invoke("send-sms", {
          body: {
            phone: profile.phone,
            message: `NanoCircuit.lk: Your pre-order PO-${shortId} items have arrived! Arrival charges: Rs. ${total.toLocaleString()}. Log in to pay & complete your order. nanocircuit.lk/pre-order`,
            order_id: arrivalTarget.id,
            user_id: arrivalTarget.user_id,
          },
        });
      }

      toast({ title: "Arrival charges saved — order moved to 'Arrived' & user notified" });
      setArrivalDialog(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setArrivalSaving(false);
    }
  };

  const openConversation = async (req: any) => {
    let convId = req.conversation_id;
    try {
      if (!convId) {
        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .insert({ user_id: req.user_id, subject: `Pre-Order #${req.id.slice(0, 8).toUpperCase()}` })
          .select().single();
        if (convError) throw convError;
        await supabase.from("preorder_requests").update({ conversation_id: conv.id }).eq("id", req.id);
        convId = conv.id;
        onRefresh();
      }
      if (onOpenConversation) {
        onOpenConversation(convId);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const statusInfo = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">Pre-Order Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{requests.length} total requests</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 w-48 text-xs"
              placeholder="Search by ID, name, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Flow guide */}
      <div className="mb-4 bg-muted/40 border border-border rounded-lg px-4 py-2.5 text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-foreground">Flow:</span>
        {["Pending", "Quoted", "User Pays", "✓ Approve", "Sourcing", "Arrived", "User Pays Arrival", "✓ Approve", "Shipped", "Completed"].map((step, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-border">→</span>}
            <span className={step.startsWith("✓") ? "text-green-600 font-semibold" : ""}>{step}</span>
          </span>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No pre-order requests found</p>
        </div>
      ) : (
        <>
          {selectedRequests.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Checkbox checked={filtered.every((r: any) => selectedRequests.has(r.id))} onCheckedChange={toggleSelectAll} />
              <span className="text-sm font-medium text-primary">{selectedRequests.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={bulkDeletePreOrders}>
                  <XCircle className="w-3.5 h-3.5" /> Delete Selected
                </Button>
                <button onClick={() => setSelectedRequests(new Set())} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>
              </div>
            </div>
          )}
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const profile = getProfile(req.user_id);
            const si = statusInfo(req.status);
            const isExpanded = expandedId === req.id;
            const shipping = Number(req.shipping_fee) || 0;
            const tax = Number(req.tax_amount) || 0;
            const grandTotal = (parseFloat(req.unit_cost_total) || 0) + (shipping === -1 ? 0 : Math.max(0, shipping)) + (tax === -1 ? 0 : Math.max(0, tax));
            const isQuoted = ["quoted", "approved", "sourcing", "arrived", "shipped", "completed"].includes(req.status);
            const expired = isQuoteExpired(req);
            const hasQuoteSlip = !!req.slip_url;
            const hasArrivalSlip = !!req.arrival_slip_url;

            return (
              <div key={req.id} className={`border rounded-xl bg-card overflow-hidden transition-colors ${selectedRequests.has(req.id) ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <Checkbox
                    checked={selectedRequests.has(req.id)}
                    onCheckedChange={() => toggleSelectRequest(req.id)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">#{req.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${si.color}`}>{si.label}</span>
                      {expired && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Expired
                        </span>
                      )}
                      {req.payment_status === "paid" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-green-300 bg-green-100 text-green-800 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> Paid
                        </span>
                      )}
                      {req.payment_status === "under_review" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" /> Slip Under Review
                        </span>
                      )}
                      {req.arrival_payment_status === "under_review" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-orange-300 bg-orange-100 text-orange-800 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" /> Arrival Slip Review
                        </span>
                      )}
                      {grandTotal > 0 && (
                        <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full">
                          Rs. {grandTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                      <User className="w-3 h-3" />
                      <span className="font-medium text-foreground">{profile?.full_name || "Unknown"}</span>
                      {profile?.phone && <><Phone className="w-3 h-3 ml-1" /><span>{profile.phone}</span></>}
                      {profile?.city && <span>· {profile.city}</span>}
                      <span>· {new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(req.status === "sourcing" || req.status === "arrived") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openArrivalCharges(req)}>
                        <Truck className="w-3 h-3" /> {req.status === "sourcing" ? "Items Arrived?" : "Edit Charges"}
                      </Button>
                    )}
                    {isQuoted && grandTotal > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => generatePreOrderInvoice(req, profile)}>
                        <FileDown className="w-3 h-3" /> Invoice PDF
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openConversation(req)}>
                      <MessageSquare className="w-3 h-3" />
                      {req.conversation_id ? "Open Chat" : "Message"}
                    </Button>
                    <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={() => openEdit(req)}>
                      <DollarSign className="w-3 h-3" /> Quote
                    </Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : req.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Items preview */}
                <div className="px-4 py-2.5 space-y-1">
                  {req.preorder_items?.slice(0, isExpanded ? undefined : 2).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {it.external_url
                          ? <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                          : <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                        }
                        <span className="text-foreground">{it.product_name}</span>
                        {it.external_url && (
                          <a href={it.external_url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">link</a>
                        )}
                        {it.unit_price && (
                          <span className="text-muted-foreground">@ Rs. {Number(it.unit_price).toLocaleString()}</span>
                        )}
                      </div>
                      <span className="text-muted-foreground">×{it.quantity}</span>
                    </div>
                  ))}
                  {!isExpanded && req.preorder_items?.length > 2 && (
                    <p className="text-xs text-muted-foreground">+{req.preorder_items.length - 2} more items</p>
                  )}
                </div>

                {/* Slip review banners — always visible even when collapsed */}
                {req.payment_status === "under_review" && hasQuoteSlip && (
                  <div className="mx-4 mb-3 border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Quote Payment Slip — Awaiting Review
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={req.slip_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline hover:no-underline">
                        <Eye className="w-3 h-3" /> View Slip
                      </a>
                      <Button
                        size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={approvingId === req.id + "quote"}
                        onClick={() => handlePaymentReview(req, "quote", "approve")}
                      >
                        <ThumbsUp className="w-3 h-3" /> Approve Payment
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-destructive/10"
                        disabled={approvingId === req.id + "quote"}
                        onClick={() => handlePaymentReview(req, "quote", "reject")}
                      >
                        <ThumbsDown className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {req.arrival_payment_status === "under_review" && hasArrivalSlip && (
                  <div className="mx-4 mb-3 border border-orange-200 bg-orange-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Arrival Payment Slip — Awaiting Review
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={req.arrival_slip_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline hover:no-underline">
                        <Eye className="w-3 h-3" /> View Slip
                      </a>
                      <Button
                        size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={approvingId === req.id + "arrival"}
                        onClick={() => handlePaymentReview(req, "arrival", "approve")}
                      >
                        <ThumbsUp className="w-3 h-3" /> Approve & Ship
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-destructive/10"
                        disabled={approvingId === req.id + "arrival"}
                        onClick={() => handlePaymentReview(req, "arrival", "reject")}
                      >
                        <ThumbsDown className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expanded extra info */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="px-4 py-3 space-y-2">
                        {/* Customer details card */}
                        <div className="text-xs bg-muted/40 rounded-lg p-2 space-y-1">
                          <p className="font-semibold text-foreground flex items-center gap-1"><User className="w-3 h-3" /> Customer Details</p>
                          <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                            <span>Name: <span className="text-foreground">{profile?.full_name || "—"}</span></span>
                            <span>Phone: <span className="text-foreground">{profile?.phone || "—"}</span></span>
                            <span>City: <span className="text-foreground">{profile?.city || "—"}</span></span>
                            <span>Address: <span className="text-foreground">{profile?.address_line1 || "—"}</span></span>
                          </div>
                        </div>
                        {req.customer_note && (
                          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
                            <span className="font-medium text-foreground">Customer note: </span>{req.customer_note}
                          </div>
                        )}
                        {req.admin_notes && (
                          <div className="text-xs text-muted-foreground bg-secondary/5 border border-secondary/20 rounded-lg p-2">
                            <span className="font-medium text-foreground">Admin note: </span>{req.admin_notes}
                          </div>
                        )}
                        {/* Quote expiry info */}
                        {req.quoted_at && req.status === "quoted" && (
                          <div className={`text-xs rounded-lg p-2 flex items-center gap-1 ${expired ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                            <Clock className="w-3 h-3" />
                            {expired
                              ? "Quote expired — user can re-request pricing."
                              : `Quote expires: ${new Date(new Date(req.quoted_at).getTime() + 48 * 60 * 60 * 1000).toLocaleString()}`}
                          </div>
                        )}

                        {/* Payment status summary */}
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-32">Quote Payment:</span>
                            <span className={`font-medium ${req.payment_status === "paid" ? "text-green-600" : req.payment_status === "under_review" ? "text-amber-600" : "text-muted-foreground"}`}>
                              {req.payment_status === "paid" ? "✓ Paid" : req.payment_status === "under_review" ? "⏳ Under Review" : req.payment_status || "Unpaid"}
                            </span>
                          </div>
                          {(req.arrival_shipping_fee > 0 || req.arrival_tax_amount > 0) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground w-32">Arrival Payment:</span>
                              <span className={`font-medium ${req.arrival_payment_status === "paid" ? "text-green-600" : req.arrival_payment_status === "under_review" ? "text-amber-600" : "text-muted-foreground"}`}>
                                {req.arrival_payment_status === "paid" ? "✓ Paid" : req.arrival_payment_status === "under_review" ? "⏳ Under Review" : "Unpaid"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Arrival charges */}
                        {(req.arrival_shipping_fee > 0 || req.arrival_tax_amount > 0) && (
                          <div className="text-xs bg-secondary/5 border border-secondary/20 rounded-lg p-2 space-y-0.5">
                            <p className="font-semibold text-foreground">Arrival Charges</p>
                            {req.arrival_shipping_fee > 0 && <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Rs. {Number(req.arrival_shipping_fee).toLocaleString()}</span></div>}
                            {req.arrival_tax_amount > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>Rs. {Number(req.arrival_tax_amount).toLocaleString()}</span></div>}
                            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                              <span>Total</span><span>Rs. {((Number(req.arrival_shipping_fee) || 0) + (Number(req.arrival_tax_amount) || 0)).toLocaleString()}</span>
                            </div>
                          </div>
                        )}

                        {grandTotal > 0 && (
                          <div className="text-xs space-y-0.5 bg-muted/30 rounded-lg p-2">
                            {req.unit_cost_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Items total</span><span>Rs. {Number(req.unit_cost_total).toLocaleString()}</span></div>}
                            {req.shipping_fee === -1
                              ? <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-secondary font-medium">Price after arrival</span></div>
                              : req.shipping_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Rs. {Number(req.shipping_fee).toLocaleString()}</span></div>}
                            {req.tax_amount === -1
                              ? <div className="flex justify-between"><span className="text-muted-foreground">Tax / Custom duty</span><span className="text-secondary font-medium">Price after arrival</span></div>
                              : req.tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax / Custom duty</span><span>Rs. {Number(req.tax_amount).toLocaleString()}</span></div>}
                            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                              <span>Grand Total</span><span>Rs. {grandTotal.toLocaleString()}{(req.shipping_fee === -1 || req.tax_amount === -1) ? " + TBA" : ""}</span>
                            </div>
                          </div>
                        )}

                        {/* Payment slips */}
                        {(req.slip_url || req.arrival_slip_url) && (
                          <div className="text-xs bg-muted/30 rounded-lg p-2 space-y-1">
                            <p className="font-semibold text-foreground">Payment Slips</p>
                            {req.slip_url && (
                              <a href={req.slip_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary underline hover:no-underline">
                                <Eye className="w-3 h-3" /> View Quote Payment Slip
                              </a>
                            )}
                            {req.arrival_slip_url && (
                              <a href={req.arrival_slip_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary underline hover:no-underline">
                                <Eye className="w-3 h-3" /> View Arrival Payment Slip
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Edit / Quote Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Pre-Order #{editTarget?.id?.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 mt-2">
              {/* Customer info summary */}
              {(() => {
                const profile = getProfile(editTarget.user_id);
                return profile ? (
                  <div className="text-xs bg-muted/40 rounded-lg p-2 flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{profile.full_name || "Unknown"}</span>
                      {profile.phone && <span className="text-muted-foreground ml-2">{profile.phone}</span>}
                      {profile.city && <span className="text-muted-foreground ml-2">· {profile.city}</span>}
                    </div>
                  </div>
                ) : null;
              })()}

              <div>
                <Label className="text-sm">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 border-b border-border text-xs font-semibold text-foreground flex items-center gap-1">
                  <ReceiptText className="w-3.5 h-3.5" /> Item Pricing
                </div>
                <div className="divide-y divide-border">
                  {editItems.map((it: any) => (
                    <div key={it.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground line-clamp-1">{it.product_name}</p>
                        <p className="text-[11px] text-muted-foreground">×{it.quantity}</p>
                        {it.external_url && (
                          <a href={it.external_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-secondary hover:underline flex items-center gap-0.5">
                            <ExternalLink className="w-3 h-3" /> View link
                          </a>
                        )}
                        {it.notes && <p className="text-[11px] text-muted-foreground italic">{it.notes}</p>}
                      </div>
                      <div className="w-28 shrink-0">
                        <Label className="text-[10px] text-muted-foreground">Unit Price (Rs.)</Label>
                        <Input
                          type="number"
                          min={0}
                          className="h-7 text-xs mt-0.5"
                          placeholder="0"
                          value={it.unit_price ?? ""}
                          onChange={e => updateItemPrice(it.id, e.target.value)}
                        />
                      </div>
                      <div className="w-20 text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">Subtotal</p>
                        <p className="text-xs font-semibold text-foreground">
                          {it.unit_price ? `Rs. ${(parseFloat(it.unit_price) * (it.quantity || 1)).toLocaleString()}` : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Shipping Fee (Rs.)</Label>
                  <div className="flex items-center gap-2 mt-1 mb-1">
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, shipping_after_arrival: !f.shipping_after_arrival, shipping_fee: "" }))}
                      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors ${editForm.shipping_after_arrival ? "bg-secondary/10 border-secondary/40 text-secondary font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      <Clock className="w-3 h-3" />
                      Price after arrival
                    </button>
                  </div>
                  <Input
                    type="number" min={0} className="text-sm"
                    placeholder="0"
                    disabled={editForm.shipping_after_arrival}
                    value={editForm.shipping_after_arrival ? "" : editForm.shipping_fee}
                    onChange={e => setEditForm(f => ({ ...f, shipping_fee: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Tax / Custom Duty (Rs.)</Label>
                  <div className="flex items-center gap-2 mt-1 mb-1">
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, tax_after_arrival: !f.tax_after_arrival, tax_amount: "" }))}
                      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors ${editForm.tax_after_arrival ? "bg-secondary/10 border-secondary/40 text-secondary font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      <Clock className="w-3 h-3" />
                      Price after arrival
                    </button>
                  </div>
                  <Input
                    type="number" min={0} className="text-sm"
                    placeholder="0"
                    disabled={editForm.tax_after_arrival}
                    value={editForm.tax_after_arrival ? "" : editForm.tax_amount}
                    onChange={e => setEditForm(f => ({ ...f, tax_amount: e.target.value }))}
                  />
                </div>
              </div>

              {(() => {
                const itemsTotal = editItems.reduce((s, it) => s + ((parseFloat(it.unit_price) || 0) * (it.quantity || 1)), 0);
                const shippingV = editForm.shipping_after_arrival ? 0 : (parseFloat(editForm.shipping_fee) || 0);
                const taxV = editForm.tax_after_arrival ? 0 : (parseFloat(editForm.tax_amount) || 0);
                const grand = itemsTotal + shippingV + taxV;
                const hasTBA = editForm.shipping_after_arrival || editForm.tax_after_arrival;
                return (itemsTotal > 0 || hasTBA) ? (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                    {itemsTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>Items</span><span>Rs. {itemsTotal.toLocaleString()}</span></div>}
                    {editForm.shipping_after_arrival
                      ? <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="text-secondary font-medium">Price after arrival</span></div>
                      : shippingV > 0 && <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Rs. {shippingV.toLocaleString()}</span></div>}
                    {editForm.tax_after_arrival
                      ? <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="text-secondary font-medium">Price after arrival</span></div>
                      : taxV > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>Rs. {taxV.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold text-foreground border-t border-border pt-1">
                      <span>Grand Total</span>
                      <span>Rs. {grand.toLocaleString()}{hasTBA ? " + TBA" : ""}</span>
                    </div>
                  </div>
                ) : null;
              })()}

              <div>
                <Label className="text-sm">Admin Note (visible to customer)</Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={2}
                  placeholder="e.g. ETA 2-3 weeks, payment required upfront…"
                  value={editForm.admin_notes}
                  onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setEditDialog(false);
                    if (editTarget) openConversation(editTarget);
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {editTarget?.conversation_id ? "Open Chat" : "Message Customer"}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save Quote"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Arrival Charges Dialog */}
      <Dialog open={arrivalDialog} onOpenChange={setArrivalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Arrival Charges #{arrivalTarget?.id?.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Set shipping & tax charges once items have arrived. This will <strong>move the order to "Arrived"</strong> and notify the user to pay.</p>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-sm">Shipping Fee (Rs.)</Label>
              <Input type="number" min={0} className="mt-1" placeholder="0" value={arrivalForm.shipping} onChange={e => setArrivalForm(f => ({ ...f, shipping: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Tax / Custom Duty (Rs.)</Label>
              <Input type="number" min={0} className="mt-1" placeholder="0" value={arrivalForm.tax} onChange={e => setArrivalForm(f => ({ ...f, tax: e.target.value }))} />
            </div>
            {(parseFloat(arrivalForm.shipping) > 0 || parseFloat(arrivalForm.tax) > 0) && (
              <div className="bg-muted/40 rounded-lg p-2 text-sm flex justify-between font-semibold">
                <span>Total</span>
                <span>Rs. {((parseFloat(arrivalForm.shipping) || 0) + (parseFloat(arrivalForm.tax) || 0)).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setArrivalDialog(false)}>Cancel</Button>
              <Button onClick={handleArrivalSave} disabled={arrivalSaving}>
                {arrivalSaving ? "Saving…" : "Save & Notify User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
