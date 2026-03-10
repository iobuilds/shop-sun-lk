import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Send, Package, ExternalLink, Clock, CheckCircle, XCircle, Truck, Search, ChevronRight, MessageSquare, ShoppingBag, Info, AlertCircle, FileDown, Store, CreditCard, RefreshCcw, AlertTriangle, Building } from "lucide-react";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "Pending Review",  color: "text-yellow-600 bg-yellow-50 border-yellow-200",    icon: Clock },
  quoted:    { label: "Quoted",          color: "text-blue-600 bg-blue-50 border-blue-200",           icon: Info },
  approved:  { label: "Approved",        color: "text-green-600 bg-green-50 border-green-200",        icon: CheckCircle },
  sourcing:  { label: "Sourcing",        color: "text-purple-600 bg-purple-50 border-purple-200",     icon: ShoppingBag },
  arrived:   { label: "Arrived",         color: "text-secondary bg-secondary/10 border-secondary/30", icon: Package },
  completed: { label: "Completed",       color: "text-green-700 bg-green-50 border-green-300",        icon: CheckCircle },
  cancelled: { label: "Cancelled",       color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
};

const generateUserPreOrderPDF = (req: any) => {
  const doc = new jsPDF();
  const shortId = req.id.slice(0, 8).toUpperCase();

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NanoCircuit.lk", 20, 25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Electronics & Components | Sri Lanka", 20, 32);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("PRE-ORDER QUOTE", 145, 25);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Quote #: PO-${shortId}`, 145, 33);
  doc.text(`Date: ${new Date(req.updated_at || req.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 145, 39);

  if (req.quoted_at) {
    doc.setTextColor(200, 50, 50);
    doc.text("* Valid for 48 hours from issue date", 145, 45);
    doc.setTextColor(80, 80, 80);
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 50, 190, 50);

  const tableData = (req.preorder_items || []).map((it: any, i: number) => [
    String(i + 1),
    it.product_name || "Item",
    String(it.quantity),
    it.unit_price ? `Rs. ${Number(it.unit_price).toLocaleString()}` : "—",
    it.unit_price ? `Rs. ${(Number(it.unit_price) * (it.quantity || 1)).toLocaleString()}` : "—",
  ]);

  autoTable(doc, {
    startY: 58,
    head: [["#", "Item", "Qty", "Unit Price", "Subtotal"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 85 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 20, right: 20 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 180;
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

  if (unitTotal > 0) { doc.text("Items Total:", xL, sY); doc.text(`Rs. ${unitTotal.toLocaleString()}`, xV, sY, { align: "right" }); sY += 6; }
  if (!shippingTBA && shipping > 0) { doc.text("Shipping Fee:", xL, sY); doc.text(`Rs. ${shipping.toLocaleString()}`, xV, sY, { align: "right" }); sY += 6; }
  else if (shippingTBA) { doc.text("Shipping Fee:", xL, sY); doc.text("Price after arrival", xV, sY, { align: "right" }); sY += 6; }
  if (!taxTBA && tax > 0) { doc.text("Tax / Custom Duty:", xL, sY); doc.text(`Rs. ${tax.toLocaleString()}`, xV, sY, { align: "right" }); sY += 6; }
  else if (taxTBA) { doc.text("Tax / Custom Duty:", xL, sY); doc.text("Price after arrival", xV, sY, { align: "right" }); sY += 6; }

  doc.setDrawColor(200, 200, 200);
  doc.line(xL, sY - 2, xV, sY - 2);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Grand Total:", xL, sY + 3);
  doc.text(`Rs. ${grand.toLocaleString()}${(shippingTBA || taxTBA) ? " + TBA" : ""}`, xV, sY + 3, { align: "right" });

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

interface PreOrderItem {
  type: "store" | "external";
  product_id?: string;
  product_name: string;
  product_image?: string;
  external_url?: string;
  quantity: number;
  expected_date?: string;
  notes?: string;
}

const emptyItem = (): PreOrderItem => ({
  type: "store",
  product_name: "",
  quantity: 1,
});

export default function PreOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [tab, setTab] = useState<"new" | "my">(searchParams.get("tab") === "my" ? "my" : "new");
  const [customerNote, setCustomerNote] = useState("");
  const [items, setItems] = useState<PreOrderItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [productSearchOpen, setProductSearchOpen] = useState<Record<number, boolean>>({});
  const [viewRequest, setViewRequest] = useState<any>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [bankTransferDialog, setBankTransferDialog] = useState<{open: boolean; preorderId: string; type: string; amount: number} | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Handle payment success/cancel from Stripe redirect
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const preorderId = searchParams.get("id");
    const paymentType = searchParams.get("type");

    if (paymentStatus === "success" && preorderId) {
      // Verify payment
      const verify = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-preorder-payment", {
            body: { preorder_id: preorderId, payment_type: paymentType || "quote" },
          });
          if (data?.status === "paid") {
            toast({ title: "✅ Payment successful!", description: "Your payment has been confirmed." });
          } else {
            toast({ title: "Payment processing", description: "Your payment is being verified." });
          }
        } catch (err) {
          console.error("Payment verification error:", err);
        }
        refetchRequests();
      };
      verify();
      setTab("my");
      // Clean URL
      window.history.replaceState({}, '', '/pre-order?tab=my');
    } else if (paymentStatus === "cancel") {
      toast({ title: "Payment cancelled", variant: "destructive" });
      window.history.replaceState({}, '', '/pre-order?tab=my');
      setTab("my");
    }
  }, [searchParams]);

  const { data: allProducts } = useQuery({
    queryKey: ["preorder-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price, images, sku")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    staleTime: 60000,
  });

  const { data: myRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["my-preorder-requests", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data } = await supabase
        .from("preorder_requests")
        .select("*, preorder_items(*)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!session?.user?.id,
  });

  // Fetch bank accounts for bank transfer option
  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-preorder"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "bank_details").single();
      const val = data?.value as any;
      // value is directly an array of account objects
      if (Array.isArray(val)) return val;
      if (Array.isArray(val?.accounts)) return val.accounts;
      return [];
    },
    staleTime: 60000,
  });

  // Fetch payment methods setting
  const { data: paymentSettings } = useQuery({
    queryKey: ["payment-settings-preorder"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "payment_methods").single();
      return data?.value as any || {};
    },
    staleTime: 60000,
  });

  const stripeEnabled = paymentSettings?.stripe_enabled === true || paymentSettings?.stripe === true;
  const bankEnabled = paymentSettings?.bank_transfer_enabled === true || paymentSettings?.bank_transfer === true;

  const filteredProducts = (idx: number) => {
    const q = (productSearch[idx] || "").toLowerCase();
    if (!q || !allProducts) return [];
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    ).slice(0, 8);
  };

  const updateItem = (idx: number, patch: Partial<PreOrderItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const selectProduct = (idx: number, p: any) => {
    updateItem(idx, {
      product_id: p.id,
      product_name: p.name,
      product_image: p.images?.[0],
      type: "store",
    });
    setProductSearch(prev => ({ ...prev, [idx]: p.name }));
    setProductSearchOpen(prev => ({ ...prev, [idx]: false }));
  };

  const handleSubmit = async () => {
    if (!session) { navigate("/auth"); return; }
    const validItems = items.filter(it => it.product_name.trim() || it.external_url?.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const { data: req, error } = await supabase
        .from("preorder_requests")
        .insert({ user_id: session.user.id, customer_note: customerNote.trim() || null })
        .select()
        .single();
      if (error) throw error;

      const itemRows = validItems.map(it => ({
        preorder_id: req.id,
        product_id: it.product_id || null,
        product_name: it.product_name || "Custom Item",
        external_url: it.external_url || null,
        quantity: it.quantity,
        expected_date: it.expected_date || null,
        notes: it.notes || null,
      }));
      const { error: itemsError } = await supabase.from("preorder_items").insert(itemRows);
      if (itemsError) throw itemsError;

      toast({ title: "✅ Pre-order submitted!", description: "We'll review and get back to you with a quote." });
      setItems([emptyItem()]);
      setCustomerNote("");
      setTab("my");
      refetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Check if quote is expired (48hrs)
  const isQuoteExpired = (req: any) => {
    if (req.status !== "quoted" || !req.quoted_at) return false;
    const expiresAt = new Date(req.quoted_at).getTime() + 48 * 60 * 60 * 1000;
    return Date.now() > expiresAt;
  };

  const getQuoteTimeLeft = (req: any) => {
    if (!req.quoted_at) return "";
    const expiresAt = new Date(req.quoted_at).getTime() + 48 * 60 * 60 * 1000;
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}m left`;
  };

  // Re-request quote (resets to pending)
  const handleReRequest = async (reqId: string) => {
    try {
      const { error } = await supabase.from("preorder_requests").update({
        status: "pending",
        payment_status: "unpaid",
        quoted_at: null,
      }).eq("id", reqId);
      if (error) throw error;
      toast({ title: "Re-request sent", description: "We'll update the quote shortly." });
      refetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Pay via Stripe
  const handleStripePayment = async (preorderId: string, paymentType: "quote" | "arrival") => {
    setPayingId(preorderId);
    try {
      const { data, error } = await supabase.functions.invoke("preorder-checkout", {
        body: { preorder_id: preorderId, payment_type: paymentType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
    } finally {
      setPayingId(null);
    }
  };

  // Open bank transfer dialog
  const openBankTransfer = (preorderId: string, type: "quote" | "arrival", amount: number) => {
    setBankTransferDialog({ open: true, preorderId, type, amount });
  };

  return (
    <>
      <SEOHead title="Pre-Order Request | NanoCircuit.lk" description="Request items not in stock. Our team will source them for you." />
      <Navbar />
      <div className="min-h-screen bg-background pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span>Pre-Order</span>
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground">Pre-Order Request</h1>
            <p className="text-muted-foreground text-sm mt-1">Can't find what you need? Submit a pre-order — we'll source it for you and provide a price quote.</p>
          </div>

          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
            {[
              { id: "new", label: "New Request" },
              { id: "my",  label: `My Requests${myRequests?.length ? ` (${myRequests.length})` : ""}` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "new" && (
              <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {!session && (
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 mb-6 flex items-center gap-3 text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Please <Link to="/auth" className="font-semibold underline">sign in</Link> to submit a pre-order request.</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                      <span className="font-semibold text-sm text-foreground">Items to Pre-Order</span>
                      <Button size="sm" variant="outline" onClick={addItem} className="gap-1 h-7 text-xs">
                        <Plus className="w-3 h-3" /> Add Item
                      </Button>
                    </div>

                    <div className="divide-y divide-border">
                      {items.map((item, idx) => (
                        <div key={idx} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                            {items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {(["store", "external"] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => updateItem(idx, { type: t, product_id: undefined, product_name: "", external_url: "" })}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-all ${
                                  item.type === t
                                    ? "bg-secondary text-secondary-foreground border-secondary"
                                    : "bg-background text-muted-foreground border-border hover:border-secondary/50"
                                }`}
                              >
                                {t === "store" ? "From Our Store" : "External Link"}
                              </button>
                            ))}
                          </div>

                          {item.type === "store" ? (
                            <div className="relative">
                              <Label className="text-xs mb-1 block">Search Product</Label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  className="pl-8 text-sm h-9"
                                  placeholder="Search by name or SKU…"
                                  value={productSearch[idx] ?? item.product_name}
                                  onChange={e => {
                                    setProductSearch(prev => ({ ...prev, [idx]: e.target.value }));
                                    setProductSearchOpen(prev => ({ ...prev, [idx]: true }));
                                    if (!e.target.value) updateItem(idx, { product_id: undefined, product_name: "" });
                                  }}
                                  onFocus={() => setProductSearchOpen(prev => ({ ...prev, [idx]: true }))}
                                />
                              </div>
                              {productSearchOpen[idx] && filteredProducts(idx).length > 0 && (
                                <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                                  {filteredProducts(idx).map(p => (
                                    <button
                                      key={p.id}
                                      onMouseDown={() => selectProduct(idx, p)}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                                    >
                                      <img src={p.images?.[0] || "/placeholder.svg"} alt="" className="w-8 h-8 rounded object-cover shrink-0 border border-border" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-foreground line-clamp-1">{p.name}</p>
                                        {p.sku && <p className="text-[10px] text-muted-foreground">SKU: {p.sku}</p>}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {item.type === "store" && !item.product_id && (
                                <p className="text-[11px] text-muted-foreground mt-1">Can't find it? Switch to "External Link" or type the name below.</p>
                              )}
                              {!item.product_id && (
                                <Input
                                  className="mt-2 text-sm h-9"
                                  placeholder="Or type product name manually"
                                  value={item.product_name}
                                  onChange={e => updateItem(idx, { product_name: e.target.value })}
                                />
                              )}
                              {item.product_id && item.product_image && (
                                <div className="mt-2 flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
                                  <img src={item.product_image} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                                  <span className="text-xs font-medium text-foreground">{item.product_name}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs mb-1 block">Product Link (URL)</Label>
                                <Input
                                  className="text-sm h-9"
                                  placeholder="https://aliexpress.com/... or any URL"
                                  value={item.external_url || ""}
                                  onChange={e => updateItem(idx, { external_url: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Product Name</Label>
                                <Input
                                  className="text-sm h-9"
                                  placeholder="Name or description of the item"
                                  value={item.product_name}
                                  onChange={e => updateItem(idx, { product_name: e.target.value })}
                                />
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs mb-1 block">Quantity</Label>
                              <Input
                                type="number"
                                min={1}
                                className="text-sm h-9"
                                value={item.quantity}
                                onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Expected By (optional)</Label>
                              <Input
                                type="date"
                                className="text-sm h-9"
                                value={item.expected_date || ""}
                                onChange={e => updateItem(idx, { expected_date: e.target.value })}
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs mb-1 block">Note for this item (optional)</Label>
                            <Input
                              className="text-sm h-9"
                              placeholder="e.g. colour, spec, variant…"
                              value={item.notes || ""}
                              onChange={e => updateItem(idx, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Overall Note (optional)</Label>
                    <Textarea
                      className="mt-1 text-sm"
                      rows={3}
                      placeholder="Any additional context, deadline, budget range, etc."
                      value={customerNote}
                      onChange={e => setCustomerNote(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Submitting…</span>
                    ) : (
                      <><Send className="w-4 h-4" /> Submit Pre-Order Request</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {tab === "my" && (
              <motion.div key="my" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {!session ? (
                  <div className="text-center py-16">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">Sign in to see your pre-order requests</p>
                    <Button asChild><Link to="/auth">Sign In</Link></Button>
                  </div>
                ) : !myRequests?.length ? (
                  <div className="text-center py-16">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-foreground">No requests yet</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Submit your first pre-order request above.</p>
                    <Button variant="outline" onClick={() => setTab("new")}>Make a Request</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myRequests.map((req: any) => {
                      const s = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
                      const Icon = s.icon;
                      const isQuoted = ["quoted", "approved", "sourcing", "arrived", "completed"].includes(req.status);
                      const hasQuote = req.unit_cost_total > 0 || req.grand_total > 0;
                      const expired = isQuoteExpired(req);
                      const canPay = req.status === "quoted" && !expired && req.payment_status !== "paid" && req.grand_total > 0;
                      const arrivalChargesTotal = (Number(req.arrival_shipping_fee) || 0) + (Number(req.arrival_tax_amount) || 0);
                      const canPayArrival = req.status === "arrived" && arrivalChargesTotal > 0 && req.arrival_payment_status !== "paid";
                      const shipping = Number(req.shipping_fee);
                      const tax = Number(req.tax_amount);
                      const shippingTBA = shipping === -1;
                      const taxTBA = tax === -1;

                      return (
                        <div key={req.id} className="border border-border rounded-xl overflow-hidden bg-card hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground font-mono">#{req.id.slice(0, 8).toUpperCase()}</span>
                              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>
                                <Icon className="w-3 h-3" /> {s.label}
                              </span>
                              {expired && (
                                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
                                  <AlertTriangle className="w-3 h-3" /> Expired
                                </span>
                              )}
                              {req.payment_status === "paid" && (
                                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-green-300 bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3" /> Paid
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isQuoted && hasQuote && (
                                <button
                                  onClick={() => generateUserPreOrderPDF(req)}
                                  className="inline-flex items-center gap-1 text-xs text-secondary hover:underline"
                                >
                                  <FileDown className="w-3 h-3" /> Download Quote
                                </button>
                              )}
                              <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="px-4 py-3 space-y-1.5">
                            {req.preorder_items?.map((it: any) => (
                              <div key={it.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  {it.external_url
                                    ? <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    : <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  }
                                  <span className="text-foreground">{it.product_name}</span>
                                  {it.external_url && (
                                    <a href={it.external_url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline text-xs">link</a>
                                  )}
                                </div>
                                <span className="text-muted-foreground text-xs">×{it.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {/* Quote section */}
                          {hasQuote && (
                            <div className="px-4 pb-3 pt-2 border-t border-border bg-muted/30 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-foreground">Quote from Admin</p>
                                {req.quoted_at && req.status === "quoted" && !expired && (
                                  <span className="text-[11px] text-blue-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {getQuoteTimeLeft(req)}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {req.unit_cost_total > 0 && <div className="flex justify-between"><span>Items</span><span>Rs. {Number(req.unit_cost_total).toLocaleString()}</span></div>}
                                {shippingTBA
                                  ? <div className="flex justify-between"><span>Shipping</span><span className="text-secondary font-medium">Price after arrival</span></div>
                                  : shipping > 0 && <div className="flex justify-between"><span>Shipping</span><span>Rs. {shipping.toLocaleString()}</span></div>}
                                {taxTBA
                                  ? <div className="flex justify-between"><span>Tax</span><span className="text-secondary font-medium">Price after arrival</span></div>
                                  : tax > 0 && <div className="flex justify-between"><span>Tax</span><span>Rs. {tax.toLocaleString()}</span></div>}
                                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                                  <span>Total</span><span>Rs. {Number(req.grand_total).toLocaleString()}{(shippingTBA || taxTBA) ? " + TBA" : ""}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Arrival charges section */}
                          {arrivalChargesTotal > 0 && (
                            <div className="px-4 pb-3 pt-2 border-t border-border bg-secondary/5 space-y-1">
                              <p className="text-xs font-semibold text-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Arrival Charges</p>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {req.arrival_shipping_fee > 0 && <div className="flex justify-between"><span>Shipping</span><span>Rs. {Number(req.arrival_shipping_fee).toLocaleString()}</span></div>}
                                {req.arrival_tax_amount > 0 && <div className="flex justify-between"><span>Tax</span><span>Rs. {Number(req.arrival_tax_amount).toLocaleString()}</span></div>}
                                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                                  <span>Total</span><span>Rs. {arrivalChargesTotal.toLocaleString()}</span>
                                </div>
                              </div>
                              {req.arrival_payment_status === "paid" ? (
                                <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid</p>
                              ) : canPayArrival && (
                                <div className="flex gap-2 mt-2">
                                  {stripeEnabled && (
                                    <Button size="sm" className="gap-1 text-xs h-7" onClick={() => handleStripePayment(req.id, "arrival")} disabled={payingId === req.id}>
                                      <CreditCard className="w-3 h-3" /> {payingId === req.id ? "Processing…" : "Pay with Card"}
                                    </Button>
                                  )}
                                  {bankEnabled && (
                                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => openBankTransfer(req.id, "arrival", arrivalChargesTotal)}>
                                      <Building className="w-3 h-3" /> Bank Transfer
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Payment actions */}
                          {canPay && (
                            <div className="px-4 pb-3 pt-2 border-t border-border">
                              <div className="flex items-center gap-2 flex-wrap">
                                {stripeEnabled && (
                                  <Button size="sm" className="gap-1 text-xs" onClick={() => handleStripePayment(req.id, "quote")} disabled={payingId === req.id}>
                                    <CreditCard className="w-3 h-3" /> {payingId === req.id ? "Processing…" : "Pay with Card"}
                                  </Button>
                                )}
                                {bankEnabled && (
                                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openBankTransfer(req.id, "quote", Number(req.grand_total))}>
                                    <Building className="w-3 h-3" /> Bank Transfer
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Expired → re-request */}
                          {expired && req.payment_status !== "paid" && (
                            <div className="px-4 pb-3 pt-2 border-t border-border">
                              <div className="flex items-center gap-2 text-xs text-destructive mb-2">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Quote expired. You can request a new quote.</span>
                              </div>
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleReRequest(req.id)}>
                                <RefreshCcw className="w-3 h-3" /> Re-Request Quote
                              </Button>
                            </div>
                          )}

                          {req.admin_notes && (
                            <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-border pt-2">
                              <span className="font-medium text-foreground">Admin note: </span>{req.admin_notes}
                            </div>
                          )}
                          {req.conversation_id && (
                            <div className="px-4 pb-3">
                              <Link
                                to={`/profile?tab=messages&convo=${req.conversation_id}`}
                                className="inline-flex items-center gap-1 text-xs text-secondary hover:underline"
                              >
                                <MessageSquare className="w-3 h-3" /> View Conversation
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bank Transfer Dialog */}
          <Dialog open={!!bankTransferDialog?.open} onOpenChange={() => setBankTransferDialog(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Bank Transfer Payment</DialogTitle>
              </DialogHeader>
              {bankTransferDialog && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Transfer <strong className="text-foreground">Rs. {bankTransferDialog.amount.toLocaleString()}</strong> to one of the following accounts.
                    After transfer, please send your receipt via the conversation chat.
                  </p>
                  {bankAccounts?.length > 0 ? (
                    <div className="space-y-2">
                      {bankAccounts.map((acc: any, i: number) => (
                        <div key={i} className="border border-border rounded-lg p-3 text-xs space-y-0.5">
                          <p className="font-semibold text-foreground">{acc.bank_name}</p>
                          {acc.branch && <p className="text-muted-foreground">Branch: {acc.branch}</p>}
                          <p className="text-muted-foreground">A/C: <span className="font-mono text-foreground">{acc.account_number}</span></p>
                          {acc.account_name && <p className="text-muted-foreground">Name: {acc.account_name}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Bank account details not available. Please contact us.</p>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => setBankTransferDialog(null)}>Close</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Footer />
    </>
  );
}
