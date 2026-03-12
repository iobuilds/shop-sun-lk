import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { generateAdminInvoice } from "@/lib/generateAdminInvoice";
import {
  Clock, Truck, Save, StickyNote, CalendarDays, FileDown, Loader2,
  User, MapPin, Package, CreditCard, Eye, ExternalLink, Receipt, Tag
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  companySettings?: any;
}

const AdminOrderDetailDialog = ({ open, onOpenChange, order, companySettings }: Props) => {
  const queryClient = useQueryClient();
  const [deliveryForm, setDeliveryForm] = useState({
    status: "", tracking_number: "", courier_name: "", tracking_link: "",
    expected_delivery: "", delivery_note: "",
  });
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [referralUsage, setReferralUsage] = useState<{ code: string; discount_applied: number; code_purpose: string } | null>(null);

  useEffect(() => {
    if (!order || !open) return;
    setDeliveryForm({
      status: order.status || "pending",
      tracking_number: order.tracking_number || "",
      courier_name: order.courier_name || "",
      tracking_link: order.tracking_link || "",
      expected_delivery: order.expected_delivery || "",
      delivery_note: "",
    });
    // Load history
    setLoadingHistory(true);
    supabase.from("order_status_history" as any).select("*").eq("order_id", order.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setStatusHistory((data as any[]) || []); setLoadingHistory(false); });
    // Load customer profile
    supabase.from("profiles").select("*").eq("user_id", order.user_id).maybeSingle()
      .then(({ data }) => setCustomerProfile(data));
    // Load referral usage for this order
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

  const saveUpdate = async () => {
    if (!order) return;
    const prevStatus = order.status;
    const newStatus = deliveryForm.status;
    const { error } = await supabase.from("orders").update({
      status: newStatus,
      tracking_number: deliveryForm.tracking_number || null,
      courier_name: deliveryForm.courier_name || null,
      tracking_link: deliveryForm.tracking_link || null,
      expected_delivery: deliveryForm.expected_delivery || null,
      delivery_note: deliveryForm.delivery_note || null,
    } as any).eq("id", order.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: order.id, status: newStatus, note: deliveryForm.delivery_note || null,
      tracking_number: deliveryForm.tracking_number || null, courier_name: deliveryForm.courier_name || null,
      tracking_link: deliveryForm.tracking_link || null, expected_delivery: deliveryForm.expected_delivery || null,
      changed_by: session?.user?.id || null,
    } as any);
    if (newStatus !== prevStatus) {
      supabase.functions.invoke("send-order-sms", { body: { order_id: order.id, status: newStatus, tracking_number: deliveryForm.tracking_number || undefined } });
    }
    toast({ title: "Order updated successfully" });
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const handleDownloadInvoice = () => {
    if (!order) return;
    generateAdminInvoice(order, companySettings);
  };

  if (!order) return null;
  const addr = order.shipping_address || {};
  const items = order.order_items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order #{order.id.slice(0, 8).toUpperCase()}</span>
            <Button size="sm" variant="outline" onClick={handleDownloadInvoice}>
              <FileDown className="w-4 h-4 mr-1.5" /> Download Invoice
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Header */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border flex flex-wrap gap-4 items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Order Date</p>
              <p className="text-sm font-medium">{new Date(order.created_at!).toLocaleString()}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
              order.status === "delivered" ? "bg-secondary/10 text-secondary" :
              order.status === "cancelled" ? "bg-destructive/10 text-destructive" :
              "bg-accent/10 text-accent-foreground"
            }`}>{order.status?.replace(/_/g, " ")}</span>
            <div>
              <p className="text-xs text-muted-foreground">Payment</p>
              <p className={`text-sm font-medium capitalize ${order.payment_status === "paid" ? "text-secondary" : order.payment_status === "rejected" ? "text-destructive" : "text-foreground"}`}>
                {order.payment_status} ({order.payment_method === "stripe" ? "Card" : order.payment_method === "free" ? "Free (Wallet/Coupon)" : "Bank Transfer"})
              </p>
            </div>
          </div>

          {/* Customer + Shipping in 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Info */}
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><User className="w-4 h-4" /> Customer</h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{addr.full_name || customerProfile?.full_name || "—"}</p>
                <p className="text-muted-foreground">{addr.phone || customerProfile?.phone || "—"}</p>
                {addr.email && <p className="text-muted-foreground">{addr.email}</p>}
                <p className="text-xs text-muted-foreground font-mono mt-1">ID: {order.user_id.slice(0, 8)}</p>
              </div>
            </div>
            {/* Shipping Address */}
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Shipping Address</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                {addr.address_line1 && <p>{addr.address_line1}</p>}
                {addr.address_line2 && <p>{addr.address_line2}</p>}
                {(addr.city || addr.postal_code) && <p>{addr.city} {addr.postal_code}</p>}
                {!addr.address_line1 && <p className="italic">No address provided</p>}
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="rounded-lg border border-border overflow-hidden">
            <h3 className="text-sm font-semibold text-foreground p-3 bg-muted/30 flex items-center gap-1.5"><Package className="w-4 h-4" /> Order Items ({items.length})</h3>
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
              {items.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">No items found</p>}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Price Breakdown</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rs. {order.subtotal?.toLocaleString()}</span></div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</span><span className="text-secondary">-Rs. {order.discount_amount?.toLocaleString()}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_fee > 0 ? `Rs. ${order.shipping_fee?.toLocaleString()}` : "Free"}</span></div>
              <div className="border-t border-border pt-1.5 flex justify-between font-semibold text-base">
                <span>Total</span><span>Rs. {order.total?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Receipt (bank transfer) */}
          {order.receipt_url && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Receipt className="w-4 h-4" /> Bank Transfer Receipt</h3>
              <div className="flex items-center gap-3">
                <a href={order.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Eye className="w-4 h-4" /> View Receipt <ExternalLink className="w-3 h-3" />
                </a>
                <span className={`text-xs px-2 py-0.5 rounded-full ${order.payment_status === "paid" ? "bg-secondary/10 text-secondary" : order.payment_status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent-foreground"}`}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          )}

          {/* Delivery Management */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Truck className="w-4 h-4" /> Delivery Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5"><Clock className="w-3.5 h-3.5" /> Order Status</Label>
                <Select value={deliveryForm.status} onValueChange={(v) => setDeliveryForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending", "confirmed", "paid", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5"><CalendarDays className="w-3.5 h-3.5" /> Expected Delivery</Label>
                <Input value={deliveryForm.expected_delivery} onChange={(e) => setDeliveryForm(f => ({ ...f, expected_delivery: e.target.value }))} placeholder="e.g. 7-14 business days" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Tracking Number</Label><Input value={deliveryForm.tracking_number} onChange={(e) => setDeliveryForm(f => ({ ...f, tracking_number: e.target.value }))} placeholder="TRK123456" /></div>
              <div><Label>Courier</Label><Input value={deliveryForm.courier_name} onChange={(e) => setDeliveryForm(f => ({ ...f, courier_name: e.target.value }))} placeholder="DHL, FedEx..." /></div>
              <div><Label>Tracking Link</Label><Input value={deliveryForm.tracking_link} onChange={(e) => setDeliveryForm(f => ({ ...f, tracking_link: e.target.value }))} placeholder="https://..." /></div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><StickyNote className="w-3.5 h-3.5" /> Delivery Note</Label>
              <Textarea value={deliveryForm.delivery_note} onChange={(e) => setDeliveryForm(f => ({ ...f, delivery_note: e.target.value }))} rows={2} placeholder="Note visible to customer..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={saveUpdate}><Save className="w-4 h-4 mr-1.5" /> Save & Update</Button>
            </div>
          </div>

          {/* Timeline */}
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
                      <p className="text-sm font-medium text-foreground capitalize">{h.status?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                      {h.note && <p className="text-xs text-foreground mt-0.5 bg-muted/50 rounded px-2 py-1">{h.note}</p>}
                      {h.tracking_number && <p className="text-xs text-muted-foreground mt-0.5">Tracking: {h.tracking_number}{h.courier_name ? ` (${h.courier_name})` : ""}</p>}
                      {h.expected_delivery && <p className="text-xs text-muted-foreground">ETA: {h.expected_delivery}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No status history recorded yet</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOrderDetailDialog;
