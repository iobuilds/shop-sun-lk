import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { generateAdminInvoice } from "@/lib/generateAdminInvoice";
import {
  Clock, Truck, Save, StickyNote, CalendarDays, FileDown, Loader2,
  User, MapPin, Package, CreditCard, Eye, ExternalLink, Receipt, Tag, CheckCircle2,
  AlertTriangle, ChevronRight, XCircle, RotateCcw, CheckCircle, Lock
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  companySettings?: any;
}

// ── Strict sequential flow ──────────────────────────────────────────────────
// Normal flow (cannot skip or reverse):
const MAIN_FLOW = ["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"];
// Terminal states (can only be set from eligible states)
const TERMINAL = ["cancelled", "returned"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Payment Verified & Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: "Order placed, awaiting payment verification",
  confirmed: "Payment verified by admin — order confirmed",
  processing: "Order is being prepared",
  packed: "Items packed and ready for dispatch",
  shipped: "Order dispatched with courier",
  out_for_delivery: "Out for delivery to customer",
  delivered: "Successfully delivered",
  cancelled: "Order cancelled",
  returned: "Order returned",
};

function getNextStatus(current: string): string | null {
  const idx = MAIN_FLOW.indexOf(current);
  if (idx === -1 || idx === MAIN_FLOW.length - 1) return null;
  return MAIN_FLOW[idx + 1];
}

function canMarkTerminal(current: string): boolean {
  // Can only cancel/return from non-terminal states and not after delivered
  return !TERMINAL.includes(current) && current !== "delivered";
}

function statusColor(status: string) {
  if (status === "delivered") return "bg-secondary/15 text-secondary border-secondary/30";
  if (status === "cancelled" || status === "returned") return "bg-destructive/15 text-destructive border-destructive/30";
  if (status === "shipped" || status === "out_for_delivery") return "bg-primary/15 text-primary border-primary/30";
  if (status === "confirmed" || status === "processing" || status === "packed") return "bg-accent/15 text-accent-foreground border-accent/30";
  return "bg-muted text-muted-foreground border-border";
}

const AdminOrderDetailDialog = ({ open, onOpenChange, order, companySettings }: Props) => {
  const queryClient = useQueryClient();
  const [trackingForm, setTrackingForm] = useState({
    tracking_number: "", courier_name: "", tracking_link: "",
    expected_delivery: "", note: "",
  });
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [referralUsage, setReferralUsage] = useState<{ code: string; discount_applied: number; code_purpose: string } | null>(null);
  const [markingCodPaid, setMarkingCodPaid] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [terminalTarget, setTerminalTarget] = useState<"cancelled" | "returned" | null>(null);
  const [terminalNote, setTerminalNote] = useState("");
  const [rejectingPayment, setRejectingPayment] = useState(false);
  const [paymentRejectNote, setPaymentRejectNote] = useState("");

  useEffect(() => {
    if (!order || !open) return;
    setTrackingForm({
      tracking_number: order.tracking_number || "",
      courier_name: order.courier_name || "",
      tracking_link: order.tracking_link || "",
      expected_delivery: order.expected_delivery || "",
      note: "",
    });
    setTerminalTarget(null);
    setTerminalNote("");
    setRejectingPayment(false);
    setPaymentRejectNote("");

    setLoadingHistory(true);
    supabase.from("order_status_history" as any).select("*").eq("order_id", order.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setStatusHistory((data as any[]) || []); setLoadingHistory(false); });

    supabase.from("profiles").select("*").eq("user_id", order.user_id).maybeSingle()
      .then(({ data }) => setCustomerProfile(data));

    setReferralUsage(null);
    (supabase as any)
      .from("referral_code_usage")
      .select("discount_applied, referral_codes(code, code_purpose)")
      .eq("order_id", order.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setReferralUsage({
            code: data.referral_codes?.code || "",
            discount_applied: data.discount_applied || 0,
            code_purpose: data.referral_codes?.code_purpose || "discount",
          });
        }
      });
  }, [order, open]);

  // ── Core status advance (one step forward only) ──────────────────────────
  const advanceStatus = async () => {
    if (!order) return;
    const next = getNextStatus(order.status);
    if (!next) return;
    setAdvancing(true);
    const { error } = await supabase.from("orders").update({
      status: next,
      payment_status: next === "confirmed" ? "paid" : order.payment_status,
      tracking_number: trackingForm.tracking_number || null,
      courier_name: trackingForm.courier_name || null,
      tracking_link: trackingForm.tracking_link || null,
      expected_delivery: trackingForm.expected_delivery || null,
    } as any).eq("id", order.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setAdvancing(false); return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: order.id, status: next,
      note: trackingForm.note || null,
      tracking_number: trackingForm.tracking_number || null,
      courier_name: trackingForm.courier_name || null,
      tracking_link: trackingForm.tracking_link || null,
      expected_delivery: trackingForm.expected_delivery || null,
      changed_by: session?.user?.id || null,
    } as any);
    // Notify
    try {
      const smsRes = await supabase.functions.invoke("send-order-sms", {
        body: { order_id: order.id, status: next, tracking_code: trackingForm.tracking_number || undefined },
      });
      const smsData = smsRes.data;
      toast({
        title: `✅ Status → ${STATUS_LABELS[next]}`,
        description: smsData?.sms_status === "sent" ? "Customer notified via SMS." : "Order updated. SMS may not have sent.",
      });
    } catch {
      toast({ title: `✅ Status → ${STATUS_LABELS[next]}` });
    }
    setAdvancing(false);
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  // ── Reject payment (stay on pending, mark payment rejected) ─────────────
  const rejectPayment = async () => {
    if (!order || !paymentRejectNote.trim()) {
      toast({ title: "Please enter a reason for rejection", variant: "destructive" });
      return;
    }
    setRejectingPayment(false);
    const { error } = await supabase.from("orders").update({ payment_status: "rejected" } as any).eq("id", order.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: order.id, status: order.status,
      note: `❌ Payment rejected: ${paymentRejectNote}`,
      changed_by: session?.user?.id || null,
    } as any);
    toast({ title: "Payment rejected", description: "Customer will need to re-upload receipt." });
    setPaymentRejectNote("");
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  // ── Mark terminal (cancel / return) ─────────────────────────────────────
  const markTerminal = async () => {
    if (!order || !terminalTarget) return;
    const { error } = await supabase.from("orders").update({ status: terminalTarget } as any).eq("id", order.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: order.id, status: terminalTarget,
      note: terminalNote || `Order ${terminalTarget} by admin`,
      changed_by: session?.user?.id || null,
    } as any);
    toast({ title: `Order ${terminalTarget}` });
    setTerminalTarget(null);
    setTerminalNote("");
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  // ── COD payment ──────────────────────────────────────────────────────────
  const markCodPaid = async () => {
    if (!order) return;
    setMarkingCodPaid(true);
    const { error } = await supabase.from("orders").update({ payment_status: "paid" } as any).eq("id", order.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setMarkingCodPaid(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: order.id, status: order.status,
      note: "COD payment collected — marked as paid by admin",
      changed_by: session?.user?.id || null,
    } as any);
    toast({ title: "COD payment marked as received" });
    setMarkingCodPaid(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    onOpenChange(false);
  };

  const handleDownloadInvoice = () => {
    if (!order) return;
    generateAdminInvoice({
      ...order,
      referral_code: referralUsage?.code || null,
      referral_discount: referralUsage?.discount_applied || 0,
    }, companySettings);
  };

  if (!order) return null;
  const addr = order.shipping_address || {};
  const items = order.order_items || [];
  const nextStatus = getNextStatus(order.status);
  const isTerminal = TERMINAL.includes(order.status);
  const isDone = order.status === "delivered";
  const currentIdx = MAIN_FLOW.indexOf(order.status);

  // Does this order need payment verification? (bank transfer, not yet confirmed/paid)
  const needsPaymentVerify =
    order.payment_method === "bank_transfer" &&
    order.status === "pending" &&
    order.payment_status !== "paid" &&
    order.payment_status !== "rejected";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order #{order.id.slice(0, 8).toUpperCase()}</span>
            <Button size="sm" variant="outline" onClick={handleDownloadInvoice}>
              <FileDown className="w-4 h-4 mr-1.5" /> Invoice
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Status Progress Bar ─────────────────────────────────────── */}
          <div className="bg-muted/30 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Order Status
              </h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColor(order.status)}`}>
                {STATUS_LABELS[order.status] ?? order.status?.replace(/_/g, " ")}
              </span>
            </div>

            {/* Step track — only for main flow */}
            {!isTerminal && (
              <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
                {MAIN_FLOW.map((s, i) => {
                  const done = currentIdx > i;
                  const active = currentIdx === i;
                  return (
                    <div key={s} className="flex items-center gap-0.5 flex-shrink-0">
                      <div className={`flex flex-col items-center gap-0.5`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                          done ? "bg-secondary border-secondary text-secondary-foreground" :
                          active ? "bg-primary border-primary text-primary-foreground" :
                          "bg-background border-border text-muted-foreground"
                        }`}>
                          {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <span className={`text-[9px] font-medium text-center leading-tight max-w-[52px] ${
                          done ? "text-secondary" : active ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {s === "confirmed" ? "Verified" : s === "out_for_delivery" ? "Out" : STATUS_LABELS[s]?.split(" ")[0]}
                        </span>
                      </div>
                      {i < MAIN_FLOW.length - 1 && (
                        <div className={`h-0.5 w-4 flex-shrink-0 mt-[-14px] ${done ? "bg-secondary" : "bg-border"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isTerminal && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="w-4 h-4" />
                <span>This order has been <strong>{order.status}</strong> and requires no further action.</span>
              </div>
            )}
          </div>

          {/* ── Order header info ───────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Date</p>
              <p className="font-medium text-foreground">{new Date(order.created_at!).toLocaleDateString()}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Payment</p>
              <p className={`font-medium capitalize ${order.payment_status === "paid" ? "text-secondary" : order.payment_status === "rejected" ? "text-destructive" : "text-accent-foreground"}`}>
                {order.payment_status}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{order.payment_method === "bank_transfer" ? "Bank" : order.payment_method === "cod" ? "COD" : order.payment_method === "stripe" ? "Card" : "Free"}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="font-bold text-foreground">Rs. {order.total?.toLocaleString()}</p>
            </div>
          </div>

          {/* ── Customer + Shipping ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><User className="w-4 h-4" /> Customer</h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{addr.full_name || customerProfile?.full_name || "—"}</p>
                <p className="text-muted-foreground">{addr.phone || customerProfile?.phone || "—"}</p>
                {addr.email && <p className="text-muted-foreground">{addr.email}</p>}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Shipping</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                {addr.address_line1 && <p>{addr.address_line1}</p>}
                {addr.address_line2 && <p>{addr.address_line2}</p>}
                {(addr.city || addr.postal_code) && <p>{addr.city} {addr.postal_code}</p>}
                {!addr.address_line1 && <p className="italic">No address</p>}
              </div>
            </div>
          </div>

          {/* ── Order Items ─────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <h3 className="text-sm font-semibold text-foreground p-3 bg-muted/30 flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Items ({items.length})
            </h3>
            <div className="divide-y divide-border">
              {items.map((item: any, i: number) => (
                <div key={item.id || i} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.products?.name || "Unknown Product"}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} × Rs. {item.unit_price?.toLocaleString()}</p>
                  </div>
                  <p className="font-medium text-foreground shrink-0 ml-4">Rs. {item.total_price?.toLocaleString()}</p>
                </div>
              ))}
              {items.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">No items</p>}
            </div>
          </div>

          {/* ── Price Breakdown ─────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Price Breakdown</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rs. {order.subtotal?.toLocaleString()}</span></div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Coupon {order.coupon_code ? `(${order.coupon_code})` : ""}</span><span className="text-secondary">-Rs. {order.discount_amount?.toLocaleString()}</span></div>
              )}
              {referralUsage && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Referral <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{referralUsage.code}</span>
                  </span>
                  {referralUsage.code_purpose === "discount" && referralUsage.discount_applied > 0 ? (
                    <span className="text-secondary font-medium">-Rs. {referralUsage.discount_applied?.toLocaleString()}</span>
                  ) : <span className="text-xs text-muted-foreground italic">tracked</span>}
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_fee > 0 ? `Rs. ${order.shipping_fee?.toLocaleString()}` : "Free"}</span></div>
              <div className="border-t border-border pt-1.5 flex justify-between font-bold text-base">
                <span>Total</span><span>Rs. {order.total?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── Receipt ─────────────────────────────────────────────────── */}
          {order.receipt_url && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Receipt className="w-4 h-4" /> Bank Transfer Receipt</h3>
              <a href={order.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                <Eye className="w-4 h-4" /> View Receipt <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ACTION ZONE — context-aware per status
          ══════════════════════════════════════════════════════════════ */}

          {/* COD: collect payment */}
          {order.payment_method === "cod" && order.payment_status !== "paid" && !isTerminal && (
            <div className="bg-accent/20 border border-accent/40 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Cash on Delivery</p>
                <p className="text-xs text-muted-foreground">Confirm once delivery person collected payment</p>
              </div>
              <Button onClick={markCodPaid} disabled={markingCodPaid} size="sm" className="shrink-0">
                {markingCodPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Mark Paid
              </Button>
            </div>
          )}

          {/* Bank transfer: verify or reject payment */}
          {needsPaymentVerify && (
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Payment Slip Uploaded — Verification Required</p>
                  <p className="text-xs text-muted-foreground">Review the receipt above, then verify or reject. Verifying will advance to "Confirmed".</p>
                </div>
              </div>
              {rejectingPayment ? (
                <div className="space-y-2">
                  <Label className="text-xs">Rejection reason <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={paymentRejectNote}
                    onChange={(e) => setPaymentRejectNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Amount mismatch, blurry image..."
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={rejectPayment} disabled={!paymentRejectNote.trim()}>
                      <XCircle className="w-4 h-4 mr-1.5" /> Confirm Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectingPayment(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={advanceStatus} disabled={advancing} className="gap-1.5">
                    {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Verify Payment & Confirm Order
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectingPayment(true)} className="gap-1.5">
                    <XCircle className="w-4 h-4" /> Reject Payment
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Normal advance — tracking form + next step button */}
          {!isDone && !isTerminal && nextStatus && !needsPaymentVerify && (
            <div className="rounded-xl border border-border p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Truck className="w-4 h-4" /> Advance to Next Step
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${statusColor(nextStatus)}`}>{STATUS_LABELS[nextStatus]}</span>
                </span>
              </h3>

              {/* Tracking fields — shown when shipping-related */}
              {["shipped", "out_for_delivery", "delivered"].includes(nextStatus) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><Label className="text-xs">Tracking #</Label><Input value={trackingForm.tracking_number} onChange={(e) => setTrackingForm(f => ({ ...f, tracking_number: e.target.value }))} placeholder="TRK123456" className="mt-1 h-8 text-sm" /></div>
                  <div><Label className="text-xs">Courier</Label><Input value={trackingForm.courier_name} onChange={(e) => setTrackingForm(f => ({ ...f, courier_name: e.target.value }))} placeholder="DHL, FedEx..." className="mt-1 h-8 text-sm" /></div>
                  <div><Label className="text-xs">Tracking Link</Label><Input value={trackingForm.tracking_link} onChange={(e) => setTrackingForm(f => ({ ...f, tracking_link: e.target.value }))} placeholder="https://..." className="mt-1 h-8 text-sm" /></div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Expected Delivery</Label>
                  <Input value={trackingForm.expected_delivery} onChange={(e) => setTrackingForm(f => ({ ...f, expected_delivery: e.target.value }))} placeholder="e.g. 3-5 business days" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><StickyNote className="w-3 h-3" /> Note to Customer</Label>
                  <Input value={trackingForm.note} onChange={(e) => setTrackingForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional note..." className="mt-1 h-8 text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" /> Steps are locked — cannot skip or reverse
                </div>
                <Button onClick={advanceStatus} disabled={advancing} className="gap-1.5">
                  {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {advancing ? "Updating..." : `Mark as ${STATUS_LABELS[nextStatus]}`}
                </Button>
              </div>
            </div>
          )}

          {/* Delivered — done state */}
          {isDone && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-secondary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-secondary">Order Delivered Successfully</p>
                <p className="text-xs text-muted-foreground">This order has completed its lifecycle.</p>
              </div>
            </div>
          )}

          {/* Terminal actions (cancel / return) */}
          {canMarkTerminal(order.status) && (
            <div className="rounded-xl border border-destructive/20 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Cancel or Return Order
              </h3>
              {terminalTarget ? (
                <div className="space-y-2">
                  <Label className="text-xs">Reason for {terminalTarget} <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={terminalNote}
                    onChange={(e) => setTerminalNote(e.target.value)}
                    rows={2}
                    placeholder="Provide a reason..."
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={markTerminal} disabled={!terminalNote.trim()}>
                      <XCircle className="w-4 h-4 mr-1.5" /> Confirm {terminalTarget === "cancelled" ? "Cancellation" : "Return"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setTerminalTarget(null); setTerminalNote(""); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setTerminalTarget("cancelled")}>
                    <XCircle className="w-4 h-4 mr-1.5" /> Cancel Order
                  </Button>
                  {["shipped", "out_for_delivery", "delivered"].includes(order.status) && (
                    <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setTerminalTarget("returned")}>
                      <RotateCcw className="w-4 h-4 mr-1.5" /> Mark Returned
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Status Timeline</h3>
            {loadingHistory ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : statusHistory.length > 0 ? (
              <div className="space-y-0 relative ml-3">
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-border" />
                {statusHistory.map((h: any, i: number) => (
                  <div key={h.id} className="flex gap-3 relative pb-4">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10 ${i === statusHistory.length - 1 ? "bg-secondary" : "bg-muted-foreground/40"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground capitalize">{STATUS_LABELS[h.status] ?? h.status?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                      {h.note && <p className="text-xs text-foreground mt-0.5 bg-muted/50 rounded px-2 py-1">{h.note}</p>}
                      {h.tracking_number && <p className="text-xs text-muted-foreground mt-0.5">Tracking: {h.tracking_number}{h.courier_name ? ` (${h.courier_name})` : ""}</p>}
                      {h.expected_delivery && <p className="text-xs text-muted-foreground">ETA: {h.expected_delivery}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOrderDetailDialog;
