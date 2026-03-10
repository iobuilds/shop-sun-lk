import { useState } from "react";
import { Package, ExternalLink, MessageSquare, Clock, ShoppingBag, Info, ChevronDown, ChevronUp, DollarSign, Truck, ReceiptText, FileDown, CheckCircle, XCircle } from "lucide-react";
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

const STATUS_OPTIONS = [
  { value: "pending",   label: "Pending Review",  color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "quoted",    label: "Quoted",           color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "approved",  label: "Approved",         color: "bg-green-100 text-green-800 border-green-300" },
  { value: "sourcing",  label: "Sourcing",         color: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "arrived",   label: "Arrived",          color: "bg-secondary/20 text-secondary border-secondary/40" },
  { value: "completed", label: "Completed",        color: "bg-green-100 text-green-900 border-green-400" },
  { value: "cancelled", label: "Cancelled",        color: "bg-destructive/10 text-destructive border-destructive/30" },
];

interface AdminPreOrdersProps {
  requests: any[];
  onRefresh: () => void;
  allProfiles: any[];
  onOpenConversation?: (conversationId: string) => void;
}

const generatePreOrderInvoice = (req: any, profile: any) => {
  const doc = new jsPDF();
  const shortId = req.id.slice(0, 8).toUpperCase();

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NanoCircuit.lk", 20, 25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Electronics & Components | Sri Lanka", 20, 32);

  // Title
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("PRE-ORDER QUOTE", 145, 25);

  // Meta
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Quote #: PO-${shortId}`, 145, 33);
  doc.text(`Date: ${new Date(req.updated_at || req.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 145, 39);
  doc.text(`Status: ${STATUS_OPTIONS.find(s => s.value === req.status)?.label || req.status}`, 145, 45);

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 52, 190, 52);

  // Customer
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Customer:", 20, 61);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let y = 67;
  if (profile?.full_name) { doc.text(profile.full_name, 20, y); y += 5; }
  if (profile?.phone) { doc.text(`Tel: ${profile.phone}`, 20, y); y += 5; }

  // Items table
  const tableData = (req.preorder_items || []).map((it: any, i: number) => [
    String(i + 1),
    it.product_name || "Item",
    it.external_url ? "External" : "Store",
    String(it.quantity),
    it.unit_price ? `Rs. ${Number(it.unit_price).toLocaleString()}` : "—",
    it.unit_price ? `Rs. ${(Number(it.unit_price) * (it.quantity || 1)).toLocaleString()}` : "—",
  ]);

  autoTable(doc, {
    startY: Math.max(y + 8, 85),
    head: [["#", "Item", "Type", "Qty", "Unit Price", "Subtotal"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
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

  // Summary
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  let sY = finalY + 10;
  const xL = 130, xV = 185;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");

  const unitTotal = Number(req.unit_cost_total) || 0;
  const shipping = Number(req.shipping_fee);
  const tax = Number(req.tax_amount);
  const shippingTBA = shipping === -1;
  const taxTBA = tax === -1;
  const grand = unitTotal + (shippingTBA ? 0 : Math.max(0, shipping)) + (taxTBA ? 0 : Math.max(0, tax));

  if (unitTotal > 0) {
    doc.text("Items Total:", xL, sY);
    doc.text(`Rs. ${unitTotal.toLocaleString()}`, xV, sY, { align: "right" });
    sY += 6;
  }
  if (!shippingTBA && shipping > 0) {
    doc.text("Shipping Fee:", xL, sY);
    doc.text(`Rs. ${shipping.toLocaleString()}`, xV, sY, { align: "right" });
    sY += 6;
  } else if (shippingTBA) {
    doc.text("Shipping Fee:", xL, sY);
    doc.text("Price after arrival", xV, sY, { align: "right" });
    sY += 6;
  }
  if (!taxTBA && tax > 0) {
    doc.text("Tax / Custom Duty:", xL, sY);
    doc.text(`Rs. ${tax.toLocaleString()}`, xV, sY, { align: "right" });
    sY += 6;
  } else if (taxTBA) {
    doc.text("Tax / Custom Duty:", xL, sY);
    doc.text("Price after arrival", xV, sY, { align: "right" });
    sY += 6;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(xL, sY - 2, xV, sY - 2);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Grand Total:", xL, sY + 3);
  doc.text(`Rs. ${grand.toLocaleString()}`, xV, sY + 3, { align: "right" });

  if (req.admin_notes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Note: ${req.admin_notes}`, 20, sY + 12);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your pre-order request! | NanoCircuit.lk", 105, 280, { align: "center" });

  doc.save(`PreOrder-Quote-PO${shortId}.pdf`);
};

export default function AdminPreOrders({ requests, onRefresh, allProfiles, onOpenConversation }: AdminPreOrdersProps) {
  const [filterStatus, setFilterStatus] = useState("all");
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

  const filtered = filterStatus === "all" ? requests : requests.filter(r => r.status === filterStatus);

  const getProfile = (userId: string) =>
    allProfiles.find((p: any) => p.user_id === userId);

  const openEdit = (req: any) => {
    setEditTarget(req);
    setEditItems(req.preorder_items?.map((it: any) => ({ ...it })) || []);
    setEditForm({
      status: req.status,
      admin_notes: req.admin_notes || "",
      shipping_fee: req.shipping_fee ? String(req.shipping_fee) : "",
      tax_amount: req.tax_amount ? String(req.tax_amount) : "",
      shipping_after_arrival: req.shipping_fee === -1 || req.shipping_fee === null && req.status !== "pending",
      tax_after_arrival: req.tax_amount === -1 || req.tax_amount === null && req.status !== "pending",
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
      // Update each item's unit_price
      for (const item of editItems) {
        if (item.unit_price !== null && item.unit_price !== undefined && item.unit_price !== "") {
          await supabase.from("preorder_items").update({ unit_price: parseFloat(item.unit_price) || 0 }).eq("id", item.id);
        }
      }

      // Calculate total from items
      const unitCostTotal = editItems.reduce((sum, it) => sum + ((parseFloat(it.unit_price) || 0) * (it.quantity || 1)), 0);
      const shippingVal = editForm.shipping_after_arrival ? -1 : (parseFloat(editForm.shipping_fee) || 0);
      const taxVal = editForm.tax_after_arrival ? -1 : (parseFloat(editForm.tax_amount) || 0);
      const grandTotal = unitCostTotal
        + (shippingVal > 0 ? shippingVal : 0)
        + (taxVal > 0 ? taxVal : 0);

      const { error } = await supabase.from("preorder_requests").update({
        status: editForm.status,
        admin_notes: editForm.admin_notes || null,
        shipping_fee: shippingVal,
        tax_amount: taxVal,
        unit_cost_total: unitCostTotal,
        grand_total: grandTotal,
      }).eq("id", editTarget.id);

      if (error) throw error;

      // If status just became "quoted", send SMS to customer
      if (wasQuoted) {
        const profile = getProfile(editTarget.user_id);
        const phone = profile?.phone;
        if (phone) {
          const shortId = editTarget.id.slice(0, 8).toUpperCase();
          const message = `NanoCircuit.lk: Your pre-order PO-${shortId} has been quoted. Grand Total: Rs. ${grandTotal.toLocaleString()}. ${editForm.admin_notes ? editForm.admin_notes + " " : ""}Please log in to view your quote and details.`;
          await supabase.functions.invoke("send-sms", {
            body: { phone, message, order_id: editTarget.id, user_id: editTarget.user_id },
          });
        }
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

  const openConversation = async (req: any) => {
    let convId = req.conversation_id;
    try {
      if (!convId) {
        // Create a new conversation linked to this pre-order
        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .insert({ user_id: req.user_id, subject: `Pre-Order #${req.id.slice(0, 8).toUpperCase()}` })
          .select().single();
        if (convError) throw convError;
        await supabase.from("preorder_requests").update({ conversation_id: conv.id }).eq("id", req.id);
        convId = conv.id;
        onRefresh();
      }
      // Navigate to contacts tab with this conversation pre-selected
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">Pre-Order Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{requests.length} total requests</p>
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

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No pre-order requests yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const profile = getProfile(req.user_id);
            const si = statusInfo(req.status);
            const isExpanded = expandedId === req.id;
            const grandTotal = (parseFloat(req.unit_cost_total) || 0) + (parseFloat(req.shipping_fee) || 0) + (parseFloat(req.tax_amount) || 0);
            const isQuoted = ["quoted", "approved", "sourcing", "arrived", "completed"].includes(req.status);

            return (
              <div key={req.id} className="border border-border rounded-xl bg-card overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">#{req.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${si.color}`}>{si.label}</span>
                      {grandTotal > 0 && (
                        <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full">
                          Rs. {grandTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {profile?.full_name || "Unknown"} {profile?.phone && `· ${profile.phone}`}
                      {" · "}{new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isQuoted && grandTotal > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => generatePreOrderInvoice(req, profile)}>
                        <FileDown className="w-3 h-3" /> PDF
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
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Quote Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Pre-Order #{editTarget?.id?.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 mt-2">
              {/* Status */}
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

              {/* Per-item pricing */}
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

              {/* Shipping & Tax */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Shipping Fee (Rs.)</Label>
                  <div className="flex items-center gap-2 mt-1 mb-1">
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, shipping_after_arrival: !f.shipping_after_arrival, shipping_fee: f.shipping_after_arrival ? f.shipping_fee : "" }))}
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
                      onClick={() => setEditForm(f => ({ ...f, tax_after_arrival: !f.tax_after_arrival, tax_amount: f.tax_after_arrival ? f.tax_amount : "" }))}
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

              {/* Grand total preview */}
              {(() => {
                const itemsTotal = editItems.reduce((s, it) => s + ((parseFloat(it.unit_price) || 0) * (it.quantity || 1)), 0);
                const shipping = editForm.shipping_after_arrival ? 0 : (parseFloat(editForm.shipping_fee) || 0);
                const tax = editForm.tax_after_arrival ? 0 : (parseFloat(editForm.tax_amount) || 0);
                const grand = itemsTotal + shipping + tax;
                const hasTBA = editForm.shipping_after_arrival || editForm.tax_after_arrival;
                return (itemsTotal > 0 || hasTBA) ? (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                    {itemsTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>Items</span><span>Rs. {itemsTotal.toLocaleString()}</span></div>}
                    {editForm.shipping_after_arrival
                      ? <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="text-secondary font-medium">Price after arrival</span></div>
                      : shipping > 0 && <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Rs. {shipping.toLocaleString()}</span></div>}
                    {editForm.tax_after_arrival
                      ? <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="text-secondary font-medium">Price after arrival</span></div>
                      : tax > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>Rs. {tax.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold text-foreground border-t border-border pt-1">
                      <span>Grand Total</span>
                      <span>Rs. {grand.toLocaleString()}{hasTBA ? " + TBA" : ""}</span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Admin notes */}
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

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Quote"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
