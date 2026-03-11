import { useState } from "react";
import { Layers, Download, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Truck, Package, Cpu, ThumbsUp, ThumbsDown, DollarSign, FileDown, Search, User, Phone, AlertCircle, FileText, Info, Edit2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { generatePCBInvoice } from "@/lib/generatePCBInvoice";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const STATUS_OPTIONS = [
  { value: "pending",      label: "Pending Review",      color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "quoted",       label: "Quoted",               color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "under_review", label: "Approval Pending",     color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "approved",     label: "Approved",             color: "bg-green-100 text-green-800 border-green-300" },
  { value: "sourcing",     label: "Manufacturing",        color: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "arrived",      label: "Boards Ready",         color: "bg-secondary/20 text-secondary border-secondary/40" },
  { value: "shipped",      label: "Shipped",              color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { value: "completed",    label: "Completed",            color: "bg-green-100 text-green-900 border-green-400" },
  { value: "cancelled",    label: "Cancelled",            color: "bg-destructive/10 text-destructive border-destructive/30" },
];

interface AdminPCBOrdersProps {
  orders: any[];
  onRefresh: () => void;
  allProfiles: any[];
}

export default function AdminPCBOrders({ orders, onRefresh, allProfiles }: AdminPCBOrdersProps) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    status: "",
    admin_notes: "",
    unit_cost_total: "",
    shipping_fee: "",
    tax_amount: "",
    shipping_after_arrival: false,
    tax_after_arrival: false,
    price_revised: false, // track if admin is increasing price
  });
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [arrivalDialog, setArrivalDialog] = useState(false);
  const [arrivalTarget, setArrivalTarget] = useState<any>(null);
  const [arrivalForm, setArrivalForm] = useState({ shipping: "", tax: "" });
  const [arrivalSaving, setArrivalSaving] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings-invoice-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "company_info").maybeSingle();
      return (data as any)?.value as any || {};
    },
  });

  const getProfile = (userId: string) => allProfiles.find((p: any) => p.user_id === userId);

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const matchSearch = !searchQuery || o.id.toLowerCase().includes(searchQuery.toLowerCase().replace(/[^a-f0-9-]/g, ""));
    return matchStatus && matchSearch;
  });

  const openEdit = (order: any) => {
    setEditTarget(order);
    const prevGrand = parseFloat(order.grand_total) || 0;
    setEditForm({
      status: order.status,
      admin_notes: order.admin_notes
        ? order.admin_notes.split("\n").filter((l: string) => !l.startsWith("stripe_session:")).join("\n").trim()
        : "",
      unit_cost_total: order.unit_cost_total ? String(order.unit_cost_total) : "",
      shipping_fee: order.shipping_fee != null && order.shipping_fee !== -1 ? String(order.shipping_fee) : "",
      tax_amount: order.tax_amount != null && order.tax_amount !== -1 ? String(order.tax_amount) : "",
      shipping_after_arrival: order.shipping_fee === -1,
      tax_after_arrival: order.tax_amount === -1,
      price_revised: false,
    });
    setEditDialog(true);
  };

  // Compute new grand total live for comparison
  const computeNewGrand = () => {
    const unitCost = parseFloat(editForm.unit_cost_total) || 0;
    const shippingVal = editForm.shipping_after_arrival ? 0 : (parseFloat(editForm.shipping_fee) || 0);
    const taxVal = editForm.tax_after_arrival ? 0 : (parseFloat(editForm.tax_amount) || 0);
    return unitCost + shippingVal + taxVal;
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    const wasQuoted = editTarget.status !== "quoted" && editForm.status === "quoted";
    const prevGrand = parseFloat(editTarget.grand_total) || 0;
    try {
      const unitCost = parseFloat(editForm.unit_cost_total) || 0;
      const shippingVal = editForm.shipping_after_arrival ? -1 : (parseFloat(editForm.shipping_fee) || 0);
      const taxVal = editForm.tax_after_arrival ? -1 : (parseFloat(editForm.tax_amount) || 0);
      const grandTotal = unitCost + (shippingVal > 0 ? shippingVal : 0) + (taxVal > 0 ? taxVal : 0);

      // If existing order was already quoted and price increased → require user approval
      const priceIncreased = prevGrand > 0 && grandTotal > prevGrand && editTarget.status === "quoted";
      const newStatus = priceIncreased && editForm.status === "quoted" ? "under_review" : editForm.status;

      // Strip stripe_session lines from existing admin_notes before saving
      const existingNotesClean = (editTarget.admin_notes || "")
        .split("\n")
        .filter((l: string) => l.startsWith("stripe_session:"))
        .join("\n");

      const newAdminNotes = [editForm.admin_notes.trim(), existingNotesClean].filter(Boolean).join("\n") || null;

      const payload: any = {
        status: newStatus,
        admin_notes: newAdminNotes,
        unit_cost_total: unitCost,
        shipping_fee: shippingVal,
        tax_amount: taxVal,
      };
      if (!editForm.shipping_after_arrival && !editForm.tax_after_arrival) {
        payload.grand_total = grandTotal;
      } else if (unitCost > 0) {
        payload.grand_total = unitCost;
      }

      const { error } = await (supabase as any).from("pcb_order_requests").update(payload).eq("id", editTarget.id);
      if (error) throw error;

      const profile = getProfile(editTarget.user_id);
      const shortId = editTarget.id.slice(0, 8).toUpperCase();

      if (priceIncreased) {
        // Notify user approval required
        await supabase.from("user_notifications").insert({
          user_id: editTarget.user_id,
          title: "PCB Quote Updated — Approval Required",
          message: `The quote for PCB-${shortId} has been revised to Rs. ${grandTotal.toLocaleString()}. Please log in to review and approve.`,
          type: "order",
          link_url: "/pcb-order?tab=my",
        });
        if (profile?.phone) {
          await supabase.functions.invoke("send-sms", {
            body: {
              phone: profile.phone,
              message: `NanoCircuit.lk: Your PCB order PCB-${shortId} quote has been updated to Rs. ${grandTotal.toLocaleString()}. Please log in to approve and proceed.`,
              user_id: editTarget.user_id,
            },
          });
        }
        toast({ title: "Quote updated — user notified for approval" });
      } else if (wasQuoted) {
        await supabase.from("user_notifications").insert({
          user_id: editTarget.user_id,
          title: "PCB Order Quoted",
          message: `Your PCB order PCB-${shortId} has been quoted at Rs. ${grandTotal.toLocaleString()}. Valid for 48 hours.`,
          type: "order",
          link_url: "/pcb-order?tab=my",
        });
        if (profile?.phone) {
          await supabase.functions.invoke("send-sms", {
            body: {
              phone: profile.phone,
              message: `NanoCircuit.lk: Your PCB order PCB-${shortId} has been quoted at Rs. ${grandTotal.toLocaleString()}. Quote valid for 48 hours. Log in to view and pay.`,
              user_id: editTarget.user_id,
            },
          });
        }
        toast({ title: "PCB order updated & user notified" });
      } else {
        toast({ title: "PCB order updated" });
      }

      setEditDialog(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentReview = async (order: any, type: "quote" | "arrival", action: "approve" | "reject", rejectReason = "") => {
    setApprovingId(order.id + type);
    try {
      const shortId = order.id.slice(0, 8).toUpperCase();
      const profile = getProfile(order.user_id);

      if (type === "quote") {
        if (action === "approve") {
          await (supabase as any).from("pcb_order_requests").update({ payment_status: "paid", status: "approved" }).eq("id", order.id);
          await supabase.from("user_notifications").insert({
            user_id: order.user_id, title: "PCB Payment Approved",
            message: `Payment for PCB-${shortId} approved. We're now manufacturing your boards!`,
            type: "order", link_url: "/pcb-order?tab=my",
          });
          if (profile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: { phone: profile.phone, message: `NanoCircuit.lk: Payment approved for PCB-${shortId}. We are now manufacturing your boards!`, user_id: order.user_id },
            });
          }
          toast({ title: "Payment approved" });
        } else {
          await (supabase as any).from("pcb_order_requests").update({ payment_status: "unpaid", slip_url: null }).eq("id", order.id);
          await supabase.from("user_notifications").insert({
            user_id: order.user_id, title: "PCB Payment Slip Rejected",
            message: `Your payment slip for PCB-${shortId} was rejected.${rejectReason ? " Reason: " + rejectReason : ""} Please re-upload.`,
            type: "order", link_url: "/pcb-order?tab=my",
          });
          if (profile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: {
                phone: profile.phone,
                message: `NanoCircuit.lk: Your payment slip for PCB-${shortId} was rejected.${rejectReason ? " Reason: " + rejectReason : ""} Please re-upload at nanocircuit.lk/pcb-order`,
                user_id: order.user_id,
              },
            });
          }
          toast({ title: "Payment rejected — user notified by SMS" });
        }
      } else {
        if (action === "approve") {
          await (supabase as any).from("pcb_order_requests").update({ arrival_payment_status: "paid", status: "shipped" }).eq("id", order.id);
          await supabase.from("user_notifications").insert({
            user_id: order.user_id, title: "Arrival Payment Approved",
            message: `Arrival payment for PCB-${shortId} approved. Your boards are being shipped!`,
            type: "order", link_url: "/pcb-order?tab=my",
          });
          if (profile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: { phone: profile.phone, message: `NanoCircuit.lk: Arrival payment approved for PCB-${shortId}. Your boards are being shipped!`, user_id: order.user_id },
            });
          }
          toast({ title: "Arrival payment approved" });
        } else {
          await (supabase as any).from("pcb_order_requests").update({ arrival_payment_status: "unpaid", arrival_slip_url: null }).eq("id", order.id);
          await supabase.from("user_notifications").insert({
            user_id: order.user_id, title: "Arrival Payment Rejected",
            message: `Arrival payment slip for PCB-${shortId} rejected.${rejectReason ? " Reason: " + rejectReason : ""} Please re-upload.`,
            type: "order", link_url: "/pcb-order?tab=my",
          });
          if (profile?.phone) {
            await supabase.functions.invoke("send-sms", {
              body: {
                phone: profile.phone,
                message: `NanoCircuit.lk: Your arrival payment slip for PCB-${shortId} was rejected.${rejectReason ? " Reason: " + rejectReason : ""} Please re-upload at nanocircuit.lk/pcb-order`,
                user_id: order.user_id,
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

  const openArrivalCharges = (order: any) => {
    setArrivalTarget(order);
    setArrivalForm({ shipping: order.arrival_shipping_fee ? String(order.arrival_shipping_fee) : "", tax: order.arrival_tax_amount ? String(order.arrival_tax_amount) : "" });
    setArrivalDialog(true);
  };

  const handleArrivalSave = async () => {
    if (!arrivalTarget) return;
    setArrivalSaving(true);
    try {
      const shipping = parseFloat(arrivalForm.shipping) || 0;
      const tax = parseFloat(arrivalForm.tax) || 0;
      await (supabase as any).from("pcb_order_requests").update({ arrival_shipping_fee: shipping, arrival_tax_amount: tax, arrival_payment_status: "unpaid" }).eq("id", arrivalTarget.id);
      const shortId = arrivalTarget.id.slice(0, 8).toUpperCase();
      const total = shipping + tax;
      const profile = getProfile(arrivalTarget.user_id);
      await supabase.from("user_notifications").insert({
        user_id: arrivalTarget.user_id, title: "PCB Arrival Charges Ready",
        message: `Your PCB order PCB-${shortId} is ready! Arrival charges: Rs. ${total.toLocaleString()}. Please pay to proceed.`,
        type: "order", link_url: "/pcb-order?tab=my",
      });
      if (profile?.phone) {
        await supabase.functions.invoke("send-sms", {
          body: { phone: profile.phone, message: `NanoCircuit.lk: Your PCB order PCB-${shortId} boards have arrived! Arrival charges: Rs. ${total.toLocaleString()}. Log in to pay and complete your order.`, user_id: arrivalTarget.user_id },
        });
      }
      toast({ title: "Arrival charges saved & user notified" });
      setArrivalDialog(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setArrivalSaving(false);
    }
  };

  const markCompleted = async (orderId: string, userId: string) => {
    await (supabase as any).from("pcb_order_requests").update({ status: "completed" }).eq("id", orderId);
    const shortId = orderId.slice(0, 8).toUpperCase();
    await supabase.from("user_notifications").insert({
      user_id: userId, title: "PCB Order Delivered",
      message: `Your PCB order PCB-${shortId} has been marked as delivered!`,
      type: "order", link_url: "/pcb-order?tab=my",
    });
    toast({ title: "Marked as delivered" });
    onRefresh();
  };

  const handleDownloadInvoice = async (order: any) => {
    setDownloadingInvoice(order.id);
    try {
      const profile = getProfile(order.user_id);
      await generatePCBInvoice(order, siteSettings || {}, profile ? { full_name: profile.full_name, phone: profile.phone } : undefined);
    } catch (err: any) {
      toast({ title: "Failed to generate invoice", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const newGrand = computeNewGrand();
  const prevGrand = parseFloat(editTarget?.grand_total) || 0;
  const priceWillIncrease = prevGrand > 0 && newGrand > prevGrand && editTarget?.status === "quoted";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by order ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No PCB orders found</div>
      ) : filtered.map(order => {
        const profile = getProfile(order.user_id);
        const shortId = order.id.slice(0, 8).toUpperCase();
        const statusInfo = STATUS_OPTIONS.find(s => s.value === order.status);
        const isExpanded = expandedId === order.id;
        const arrivalTotal = (order.arrival_shipping_fee || 0) + (order.arrival_tax_amount || 0);
        const hasInvoice = order.grand_total > 0;

        return (
          <motion.div key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">PCB-{shortId}</span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusInfo?.color || ""}`}>{statusInfo?.label}</span>
                  {(order.payment_status === "under_review" || order.arrival_payment_status === "under_review") && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-300">Payment Review</span>
                  )}
                  {order.status === "under_review" && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-orange-100 text-orange-800 border-orange-300">User Approval Needed</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.quantity} pcs · {order.layer_count}L · {order.surface_finish} · {order.pcb_color} · {order.board_thickness}
                </p>
                {profile && (
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {profile.full_name || "Unknown"}</span>
                    {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.phone}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasInvoice && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                    disabled={downloadingInvoice === order.id}
                    onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(order); }}>
                    <Download className="w-3 h-3" />
                    {downloadingInvoice === order.id ? "…" : "Invoice"}
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Expanded */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Gerber Download */}
                    {order.gerber_file_url && (
                      <div className="flex items-center gap-3">
                        <a href={order.gerber_file_url} target="_blank" rel="noopener noreferrer" download>
                          <Button size="sm" variant="outline" className="gap-2">
                            <FileDown className="w-3.5 h-3.5" /> Download Gerber Files
                          </Button>
                        </a>
                        <span className="text-xs text-muted-foreground">{order.gerber_file_name}</span>
                      </div>
                    )}

                    {/* Under review — user approval alert */}
                    {order.status === "under_review" && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-orange-800">Waiting for customer approval</p>
                          <p className="text-orange-700 text-xs mt-0.5">The quote was revised and a notification was sent. Order will proceed once the customer approves.</p>
                        </div>
                      </div>
                    )}

                    {/* Quote details */}
                    {order.grand_total > 0 && (
                      <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                        <p className="font-medium text-foreground mb-2">Quote Summary</p>
                        <div className="flex justify-between"><span className="text-muted-foreground">Board Cost</span><span>Rs. {Number(order.unit_cost_total || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_fee === -1 ? "TBA" : `Rs. ${Number(order.shipping_fee || 0).toLocaleString()}`}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{order.tax_amount === -1 ? "TBA" : `Rs. ${Number(order.tax_amount || 0).toLocaleString()}`}</span></div>
                        <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Grand Total</span><span>Rs. {Number(order.grand_total).toLocaleString()}</span></div>
                      </div>
                    )}

                    {/* Arrival charges */}
                    {arrivalTotal > 0 && (
                      <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                        <p className="font-medium text-foreground mb-2">Arrival Charges</p>
                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Rs. {Number(order.arrival_shipping_fee || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>Rs. {Number(order.arrival_tax_amount || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>Rs. {arrivalTotal.toLocaleString()}</span></div>
                      </div>
                    )}

                    {/* Payment slips review */}
                    {order.payment_status === "under_review" && order.slip_url && (
                      <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-yellow-800 mb-2">Initial Payment Slip — Review Required</p>
                        <a href={order.slip_url} target="_blank" rel="noopener noreferrer">
                          <img src={order.slip_url} alt="Payment slip" className="max-h-40 rounded border border-yellow-200 mb-3 object-contain bg-white" onError={e => (e.currentTarget.style.display = "none")} />
                        </a>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={!!approvingId} onClick={() => handlePaymentReview(order, "quote", "approve")} className="gap-1.5 bg-green-600 hover:bg-green-700">
                            <ThumbsUp className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" disabled={!!approvingId} onClick={() => handlePaymentReview(order, "quote", "reject")} className="gap-1.5">
                            <ThumbsDown className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {order.arrival_payment_status === "under_review" && order.arrival_slip_url && (
                      <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-yellow-800 mb-2">Arrival Payment Slip — Review Required</p>
                        <a href={order.arrival_slip_url} target="_blank" rel="noopener noreferrer">
                          <img src={order.arrival_slip_url} alt="Arrival slip" className="max-h-40 rounded border border-yellow-200 mb-3 object-contain bg-white" onError={e => (e.currentTarget.style.display = "none")} />
                        </a>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={!!approvingId} onClick={() => handlePaymentReview(order, "arrival", "approve")} className="gap-1.5 bg-green-600 hover:bg-green-700">
                            <ThumbsUp className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" disabled={!!approvingId} onClick={() => handlePaymentReview(order, "arrival", "reject")} className="gap-1.5">
                            <ThumbsDown className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Customer note */}
                    {order.customer_note && (
                      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 italic">"{order.customer_note}"</div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(order)} className="gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" /> Quote / Update
                      </Button>
                      {order.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await (supabase as any).from("pcb_order_requests").update({ status: "sourcing" }).eq("id", order.id);
                          onRefresh();
                        }} className="gap-1.5">
                          <Cpu className="w-3.5 h-3.5" /> Mark Manufacturing
                        </Button>
                      )}
                      {(order.status === "sourcing" || order.status === "approved") && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await (supabase as any).from("pcb_order_requests").update({ status: "arrived" }).eq("id", order.id);
                          onRefresh();
                        }} className="gap-1.5">
                          <Package className="w-3.5 h-3.5" /> Mark Arrived
                        </Button>
                      )}
                      {order.status === "arrived" && (
                        <Button size="sm" variant="secondary" onClick={() => openArrivalCharges(order)} className="gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" /> Set Arrival Charges
                        </Button>
                      )}
                      {order.status === "shipped" && (
                        <Button size="sm" onClick={() => markCompleted(order.id, order.user_id)} className="gap-1.5 bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
                        </Button>
                      )}
                      {/* Invoice download in expanded view too */}
                      {hasInvoice && (
                        <Button size="sm" variant="outline" className="gap-1.5"
                          disabled={downloadingInvoice === order.id}
                          onClick={() => handleDownloadInvoice(order)}>
                          <FileText className="w-3.5 h-3.5" />
                          {downloadingInvoice === order.id ? "Generating…" : "Download Invoice PDF"}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Edit / Quote Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quote / Update PCB-{editTarget?.id.slice(0, 8).toUpperCase()}</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Price increase warning */}
            {priceWillIncrease && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-orange-800">Price Increase Detected</p>
                  <p className="text-orange-700 text-xs mt-0.5">
                    Previous: Rs. {prevGrand.toLocaleString()} → New: Rs. {newGrand.toLocaleString()}
                  </p>
                  <p className="text-orange-700 text-xs mt-1">
                    Saving will set status to <strong>"Approval Pending"</strong> and notify the customer for approval before they can pay.
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Board Cost (Rs.)</Label>
              <Input type="number" value={editForm.unit_cost_total} onChange={e => setEditForm(f => ({ ...f, unit_cost_total: e.target.value }))} placeholder="e.g. 3500" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Shipping Fee (Rs.)</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" value={editForm.shipping_fee} onChange={e => setEditForm(f => ({ ...f, shipping_fee: e.target.value }))} disabled={editForm.shipping_after_arrival} placeholder="0" />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={editForm.shipping_after_arrival} onChange={e => setEditForm(f => ({ ...f, shipping_after_arrival: e.target.checked, shipping_fee: "" }))} />
                  After arrival
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Tax / Customs (Rs.)</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" value={editForm.tax_amount} onChange={e => setEditForm(f => ({ ...f, tax_amount: e.target.value }))} disabled={editForm.tax_after_arrival} placeholder="0" />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={editForm.tax_after_arrival} onChange={e => setEditForm(f => ({ ...f, tax_after_arrival: e.target.checked, tax_amount: "" }))} />
                  After arrival
                </label>
              </div>
            </div>

            {/* Live grand total preview */}
            {newGrand > 0 && (
              <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                <span className="text-muted-foreground">Calculated Grand Total</span>
                <span className={`font-bold ${priceWillIncrease ? "text-orange-600" : "text-foreground"}`}>
                  Rs. {newGrand.toLocaleString()}
                  {priceWillIncrease && " ↑"}
                </span>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Admin Notes (visible to customer)</Label>
              <Textarea value={editForm.admin_notes} onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))} rows={3} placeholder="Notes for customer..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Saving..." : priceWillIncrease ? "Save & Request Approval" : "Save"}</Button>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Arrival Charges Dialog */}
      <Dialog open={arrivalDialog} onOpenChange={setArrivalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Arrival Charges</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Shipping (Rs.)</Label>
              <Input type="number" value={arrivalForm.shipping} onChange={e => setArrivalForm(f => ({ ...f, shipping: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Tax / Customs (Rs.)</Label>
              <Input type="number" value={arrivalForm.tax} onChange={e => setArrivalForm(f => ({ ...f, tax: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleArrivalSave} disabled={arrivalSaving} className="flex-1">{arrivalSaving ? "Saving..." : "Save & Notify"}</Button>
              <Button variant="outline" onClick={() => setArrivalDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
