import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Building2, Truck, Shield, Loader2, ArrowLeft, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

// Fetch payment method settings
const usePaymentMethodSettings = () => useQuery({
  queryKey: ["payment-methods-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "payment_methods").maybeSingle();
    if (error) throw error;
    return (data as any)?.value as any || { stripe_enabled: true, bank_transfer_enabled: true };
  },
  staleTime: 5 * 60 * 1000,
});

// Fetch shipping settings
const useShippingSettings = () => useQuery({
  queryKey: ["shipping-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "shipping_settings").maybeSingle();
    if (error) throw error;
    return (data as any)?.value as any || { local_fee: 350, overseas_fee: 1500, free_shipping_threshold: 5000 };
  },
  staleTime: 5 * 60 * 1000,
});
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Session } from "@supabase/supabase-js";

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { data: pmSettings } = usePaymentMethodSettings();
  const { data: shipSettings } = useShippingSettings();
  const stripeEnabled = pmSettings?.stripe_enabled !== false;
  const bankEnabled = pmSettings?.bank_transfer_enabled !== false;
  const [paymentMethod, setPaymentMethod] = useState("");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; description?: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
  });

  // Bank details for preview
  const { data: bankDetails } = useQuery({
    queryKey: ["site-bank-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "bank_details")
        .maybeSingle();
      if (error) throw error;
      const val = (data as any)?.value;
      if (val && !Array.isArray(val)) return [val];
      return (val as any[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const discount = appliedCoupon?.discount || 0;
  const localFee = shipSettings?.local_fee ?? 350;
  const overseasFee = shipSettings?.overseas_fee ?? 1500;
  const freeThreshold = shipSettings?.free_shipping_threshold ?? 5000;
  const hasOverseas = items.some(item => (item as any).specifications?._shipping_type === "overseas");
  const shipping = hasOverseas ? overseasFee : (subtotal >= freeThreshold ? 0 : localFee);
  const total = Math.max(0, subtotal - discount + shipping);

  // Set default payment method based on enabled options
  useEffect(() => {
    if (!paymentMethod && pmSettings) {
      if (stripeEnabled) setPaymentMethod("stripe");
      else if (bankEnabled) setPaymentMethod("bank_transfer");
    }
  }, [pmSettings, stripeEnabled, bankEnabled, paymentMethod]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth?redirect=/checkout");
      setLoading(false);
    });
  }, [navigate]);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            full_name: data.full_name || "",
            phone: data.phone || "",
            address_line1: data.address_line1 || "",
            address_line2: data.address_line2 || "",
            city: data.city || "",
            postal_code: data.postal_code || "",
          });
        }
      });
  }, [session?.user?.id]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: { code: couponCode, subtotal },
      });
      if (error) throw error;
      if (!data.valid) throw new Error(data.error);
      setAppliedCoupon({ code: data.code, discount: data.discount, description: data.description });
      toast.success(`Coupon applied! You save Rs. ${data.discount.toLocaleString()}`);
    } catch (err: any) {
      toast.error(err.message || "Invalid coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (items.length === 0) {
    navigate("/cart");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.address_line1 || !form.city) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          shipping_address: form,
          payment_method: paymentMethod,
          coupon_code: appliedCoupon?.code || null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      clearCart();

      if (data.type === "stripe" && data.url) {
        window.location.href = data.url;
      } else if (data.type === "bank_transfer") {
        navigate(`/order-success?order_id=${data.order_id}&method=bank`);
      }
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8">
          <button onClick={() => navigate("/cart")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Cart
          </button>

          <h1 className="text-2xl font-bold font-display text-foreground mb-8">Checkout</h1>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Shipping Info */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-bold font-display text-foreground mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-secondary" /> Shipping Information
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" required /></div>
                      <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 7X XXX XXXX" required /></div>
                    </div>
                    <div><Label>Address Line 1 *</Label><Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="Street address" required /></div>
                    <div><Label>Address Line 2</Label><Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} placeholder="Apartment, suite, etc." /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>City *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Colombo" required /></div>
                      <div><Label>Postal Code</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="00100" /></div>
                    </div>
                  </div>
                </motion.div>

                {/* Payment Method */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-bold font-display text-foreground mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-secondary" /> Payment Method
                  </h2>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    {stripeEnabled && (
                      <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === "stripe" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                        <RadioGroupItem value="stripe" />
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Credit / Debit Card</p>
                          <p className="text-xs text-muted-foreground">Visa, MasterCard via Stripe</p>
                        </div>
                      </label>
                    )}
                    {bankEnabled && (
                      <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === "bank_transfer" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                        <RadioGroupItem value="bank_transfer" />
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Direct Bank Transfer</p>
                          <p className="text-xs text-muted-foreground">Transfer to bank account & upload receipt</p>
                        </div>
                      </label>
                    )}
                  </RadioGroup>

                  {/* Bank Details Preview when bank_transfer selected */}
                  <AnimatePresence>
                    {paymentMethod === "bank_transfer" && bankDetails && bankDetails.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-muted/50 rounded-lg p-4 mt-3 space-y-3">
                          <p className="text-xs font-semibold text-foreground">බැංකු මාරු විස්තර / Bank Transfer Details</p>
                          {bankDetails.map((bank: any, idx: number) => (
                            <div key={idx} className="space-y-1.5 text-sm">
                              {bankDetails.length > 1 && (
                                <p className="text-xs font-bold text-muted-foreground pt-1 first:pt-0">ගිණුම / Account #{idx + 1}</p>
                              )}
                              {[
                                { si: "බැංකුව", en: "Bank", value: bank.bank_name },
                                { si: "ගිණුම් නම", en: "Account Name", value: bank.account_name },
                                { si: "ගිණුම් අංකය", en: "Account No", value: bank.account_number },
                                { si: "ශාඛාව", en: "Branch", value: bank.branch },
                              ].map((r) => (
                                <div key={r.en} className="flex justify-between">
                                  <span className="text-muted-foreground text-xs">{r.si} / {r.en}</span>
                                  <span className="font-medium text-foreground text-xs">{r.value}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                          <p className="text-[10px] text-muted-foreground">ඇණවුම තහවුරු කිරීමෙන් පසු ඔබට මුදල් මාරු කිරීම සඳහා මෙම විස්තර ලැබෙනු ඇත / After placing the order, use these details to transfer payment.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Order Summary */}
              <div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl border border-border p-6 sticky top-44 space-y-4">
                  <h2 className="text-lg font-bold font-display text-foreground">Order Summary</h2>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-border" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Coupon Code */}
                  <div className="border-t border-border pt-3">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-secondary" />
                          <span className="text-sm font-medium text-secondary">{appliedCoupon.code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">-Rs. {appliedCoupon.discount.toLocaleString()}</span>
                          <button type="button" onClick={removeCoupon} className="p-0.5 hover:bg-secondary/10 rounded"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Coupon code"
                          className="text-sm"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyCoupon())}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={applyCoupon} disabled={validatingCoupon || !couponCode.trim()}>
                          {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>Rs. {subtotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>Discount</span>
                        <span>-Rs. {discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span>{shipping === 0 ? <span className="text-secondary font-medium">Free</span> : `Rs. ${shipping}`}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground text-base">
                      <span>Total</span>
                      <span>Rs. {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : paymentMethod === "stripe" ? (
                      <><CreditCard className="w-4 h-4" /> Pay Rs. {total.toLocaleString()}</>
                    ) : (
                      <><Building2 className="w-4 h-4" /> Place Order</>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-1">
                    <Shield className="w-3.5 h-3.5" /> Secure checkout
                  </div>
                </motion.div>
              </div>
            </div>
          </form>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Checkout;
