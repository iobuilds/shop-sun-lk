import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Building2, Truck, Shield, Loader2, ArrowLeft, Tag, X, Wallet, CheckCircle, ChevronDown, ChevronUp, Users, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useShippingCalculation } from "@/hooks/useShippingCalculation";

// Fetch payment method settings
const usePaymentMethodSettings = () => useQuery({
  queryKey: ["payment-methods-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "payment_methods").maybeSingle();
    if (error) throw error;
    return (data as any)?.value as any || { stripe_enabled: true, bank_transfer_enabled: true, payhere_enabled: false, payhere_sandbox: true };
  },
  staleTime: 5 * 60 * 1000,
});

// Fetch shipping settings — now handled by useShippingCalculation hook
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Session } from "@supabase/supabase-js";

// Declare payhere global loaded from CDN
declare global {
  interface Window {
    payhere: any;
  }
}

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { data: pmSettings } = usePaymentMethodSettings();
  const { shipping, shippingNote, freeShippingGap, hasOverseas } = useShippingCalculation(items, subtotal);
  const stripeEnabled = pmSettings?.stripe_enabled !== false;
  const bankEnabled = pmSettings?.bank_transfer_enabled !== false;
  const payhereEnabled = pmSettings?.payhere_enabled === true;
  const [paymentMethod, setPaymentMethod] = useState("");
  const payhereScriptLoaded = useRef(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; description?: string; category_message?: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);

  // Referral code state
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferral, setAppliedReferral] = useState<{ code: string; discount: number; name?: string } | null>(null);
  const [validatingReferral, setValidatingReferral] = useState(false);

  // Available coupons
  const { data: availableCoupons } = useQuery({
    queryKey: ["checkout-available-coupons", session?.user?.id, subtotal],
    queryFn: async () => {
      const now = new Date().toISOString();
      const userId = session!.user.id;

      // Fetch user's coupon usage counts
      const { data: usageData } = await supabase
        .from("coupon_usage")
        .select("coupon_id")
        .eq("user_id", userId);
      const usageCounts = new Map<string, number>();
      (usageData || []).forEach((u: any) => {
        usageCounts.set(u.coupon_id, (usageCounts.get(u.coupon_id) || 0) + 1);
      });

      // Public coupons
      const { data: publicCoupons } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .eq("coupon_type", "public")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .or(`starts_at.is.null,starts_at.lte.${now}`);

      // Private coupons assigned to user
      let privateCoupons: any[] = [];
      const { data: assignments } = await supabase
        .from("coupon_assignments")
        .select("coupon_id, used, coupons(*)")
        .eq("used", false);
      if (assignments) {
        privateCoupons = assignments
          .filter((a: any) => a.coupons?.is_active && (!a.coupons?.expires_at || new Date(a.coupons.expires_at) > new Date()))
          .map((a: any) => a.coupons);
      }

      const all = [...(publicCoupons || []), ...privateCoupons];
      const unique = Array.from(new Map(all.map((c: any) => [c.id, c])).values());

      // Filter out used-up coupons
      return unique.filter((c: any) => {
        // Check global max uses
        if (c.max_uses && c.used_count >= c.max_uses) return false;
        // Check per-user limit
        const userUses = usageCounts.get(c.id) || 0;
        if (c.per_user_limit && userUses >= c.per_user_limit) return false;
        // Check min order amount
        if (c.min_order_amount && subtotal < c.min_order_amount) return false;
        return true;
      });
    },
    enabled: !!session?.user?.id,
    staleTime: 30 * 1000,
  });

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

  // Wallet balance
  const { data: walletData } = useQuery({
    queryKey: ["checkout-wallet", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets" as any).select("balance").eq("user_id", session!.user.id).maybeSingle();
      return data as any;
    },
    enabled: !!session?.user?.id,
  });
  const walletBalance = Number(walletData?.balance || 0);

  const discount = appliedCoupon?.discount || 0;
  const referralDiscount = appliedReferral?.discount || 0;
  const totalDiscount = discount + referralDiscount;
  const payableBeforeWallet = Math.max(0, subtotal + shipping - totalDiscount);
  const couponExtraCredit = totalDiscount > (subtotal + shipping) ? totalDiscount - (subtotal + shipping) : 0;
  const walletCredit = useWallet ? Math.min(walletBalance, payableBeforeWallet) : 0;
  const total = Math.max(0, payableBeforeWallet - walletCredit);


  // Set default payment method based on enabled options
  useEffect(() => {
    if (!paymentMethod && pmSettings) {
      if (stripeEnabled) setPaymentMethod("stripe");
      else if (payhereEnabled) setPaymentMethod("payhere");
      else if (bankEnabled) setPaymentMethod("bank_transfer");
    }
  }, [pmSettings, stripeEnabled, bankEnabled, payhereEnabled, paymentMethod]);

  // Load PayHere JS SDK from CDN when needed
  useEffect(() => {
    if (!payhereEnabled || payhereScriptLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://www.payhere.lk/lib/payhere.js";
    script.async = true;
    script.onload = () => { payhereScriptLoaded.current = true; };
    document.body.appendChild(script);
  }, [payhereEnabled]);

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

  const applyCoupon = async (codeArg?: string) => {
    const codeToApply = codeArg || couponCode;
    if (!codeToApply.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: { code: codeToApply, subtotal, cart_items: items.map(i => ({ id: i.id, quantity: i.quantity })) },
      });
      if (error) throw error;
      if (!data.valid) throw new Error(data.error);
      setAppliedCoupon({ code: data.code, discount: data.discount, description: data.description, category_message: data.category_message });
      setCouponCode(data.code);
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

  const applyReferral = async () => {
    if (!referralCode.trim()) return;
    setValidatingReferral(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-referral-code", {
        body: { code: referralCode, subtotal },
      });
      if (error) throw error;
      if (!data.valid) throw new Error(data.error);
      setAppliedReferral({ code: data.code, discount: data.discount, name: data.name });
      setReferralCode(data.code);
      toast.success(`Referral code applied! You save Rs. ${data.discount.toLocaleString()}`);
    } catch (err: any) {
      toast.error(err.message || "Invalid referral code");
    } finally {
      setValidatingReferral(false);
    }
  };

  const removeReferral = () => {
    setAppliedReferral(null);
    setReferralCode("");
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
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setSubmitting(true);

    // ── PayHere ───────────────────────────────────────────────
    if (paymentMethod === "payhere") {
      try {
        const { data, error } = await supabase.functions.invoke("payhere-generate-hash", {
          body: {
            items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
            shipping_address: form,
            coupon_code: appliedCoupon?.code || null,
            referral_code: appliedReferral?.code || null,
            wallet_amount: walletCredit > 0 ? walletCredit : null,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to initialise PayHere");

        // First create the order record via create-checkout with payhere method
        const { data: orderData, error: orderError } = await supabase.functions.invoke("create-checkout", {
          body: {
            items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
            shipping_address: form,
            payment_method: "payhere",
            coupon_code: appliedCoupon?.code || null,
            referral_code: appliedReferral?.code || null,
            wallet_amount: walletCredit > 0 ? walletCredit : null,
          },
        });
        if (orderError || orderData?.error) throw new Error(orderData?.error || orderError?.message || "Failed to create order");

        const orderId = orderData.order_id;

        if (!window.payhere) throw new Error("PayHere script not loaded. Please refresh and try again.");

        const origin = window.location.origin;

        window.payhere.onCompleted = async (completedOrderId: string) => {
          clearCart();
          navigate(`/order-success?order_id=${orderId}&method=payhere`);
        };

        window.payhere.onDismissed = () => {
          toast.error("Payment was dismissed. You can try again.");
          setSubmitting(false);
        };

        window.payhere.onError = (error: string) => {
          toast.error(`PayHere error: ${error}`);
          setSubmitting(false);
        };

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const notifyUrl = `https://${projectId}.supabase.co/functions/v1/payhere-notify`;

        window.payhere.startPayment({
          sandbox: data.sandbox,
          merchant_id: data.merchant_id,
          return_url: `${origin}/order-success?order_id=${orderId}&method=payhere`,
          cancel_url: `${origin}/checkout`,
          notify_url: notifyUrl,
          order_id: orderId,
          items: items.map((i: any) => i.name || "Item").join(", ").slice(0, 100),
          amount: data.amount,
          currency: data.currency,
          hash: data.hash,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          country: data.country,
          delivery_address: data.delivery_address,
          delivery_city: data.delivery_city,
          delivery_country: data.delivery_country,
        });
      } catch (err: any) {
        toast.error(err.message || "PayHere checkout failed");
        setSubmitting(false);
      }
      return;
    }

    // ── Stripe / Bank ─────────────────────────────────────────
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          shipping_address: form,
          payment_method: paymentMethod,
          coupon_code: appliedCoupon?.code || null,
          referral_code: appliedReferral?.code || null,
          wallet_amount: walletCredit > 0 ? walletCredit : null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      clearCart();

      // Show wallet credit message if applicable
      if (data.coupon_wallet_credit > 0) {
        toast.success(`Your coupon covered the full order. Extra Rs. ${data.coupon_wallet_credit.toLocaleString()} has been added to your wallet.`, { duration: 6000 });
      }

      if (data.type === "free") {
        navigate(`/order-success?order_id=${data.order_id}&method=free${data.coupon_wallet_credit > 0 ? `&wallet_credit=${data.coupon_wallet_credit}` : ""}`);
      } else if (data.type === "stripe" && data.url) {
        window.location.href = data.url;
      } else if (data.type === "bank_transfer") {
        navigate(`/order-success?order_id=${data.order_id}&method=bank${data.coupon_wallet_credit > 0 ? `&wallet_credit=${data.coupon_wallet_credit}` : ""}`);
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
                    {payhereEnabled && (
                      <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === "payhere" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                        <RadioGroupItem value="payhere" />
                        <Smartphone className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">PayHere</p>
                          <p className="text-xs text-muted-foreground">Visa, Master, eZ Cash, mCash, GENIE & more</p>
                        </div>
                        <img src="https://www.payhere.lk/downloads/images/payhere_long_banner.png" alt="PayHere" className="h-5 object-contain opacity-80" />
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
                        <Button type="button" variant="outline" size="sm" onClick={() => applyCoupon()} disabled={validatingCoupon || !couponCode.trim()}>
                          {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Available Coupons */}
                  {!appliedCoupon && availableCoupons && availableCoupons.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCoupons(!showCoupons)}
                        className="flex items-center gap-1 text-xs text-secondary hover:underline font-medium"
                      >
                        <Tag className="w-3 h-3" />
                        {availableCoupons.length} coupon{availableCoupons.length > 1 ? "s" : ""} available
                        {showCoupons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {showCoupons && (
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                          {availableCoupons.map((c: any) => (
                            <div key={c.id} className="border border-border rounded-lg p-2.5 flex items-center justify-between bg-muted/30">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{c.code}</span>
                                  {c.coupon_type === "private" && <span className="text-[9px] bg-secondary/10 text-secondary px-1 py-0.5 rounded">For You</span>}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {c.discount_type === "percentage" ? `${c.discount_value}% off` : `Rs. ${c.discount_value} off`}
                                  {c.min_order_amount ? ` • Min Rs. ${Number(c.min_order_amount).toLocaleString()}` : ""}
                                  {c.expires_at ? ` • Expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2 shrink-0 ml-2"
                                onClick={() => { setCouponCode(c.code); applyCoupon(c.code); }}
                                disabled={validatingCoupon}
                              >
                                Apply
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                   {/* Referral Code */}
                  <div className="border-t border-border pt-3">
                    {appliedReferral ? (
                      <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-secondary" />
                          <div>
                            <span className="text-sm font-medium text-secondary">{appliedReferral.code}</span>
                            {appliedReferral.name && <span className="text-xs text-muted-foreground ml-1">({appliedReferral.name})</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">-Rs. {appliedReferral.discount.toLocaleString()}</span>
                          <button type="button" onClick={removeReferral} className="p-0.5 hover:bg-secondary/10 rounded"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          placeholder="Referral code"
                          className="text-sm"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyReferral())}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={applyReferral} disabled={validatingReferral || !referralCode.trim()}>
                          {validatingReferral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">Have a referral code? Enter it above for a discount.</p>
                  </div>

                  {/* Wallet Credit */}

                  {walletBalance > 0 && (
                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-secondary" />
                          <div>
                            <span className="text-sm font-medium text-foreground">Wallet</span>
                            <span className="text-xs text-muted-foreground ml-1">Rs. {walletBalance.toLocaleString()}</span>
                          </div>
                        </div>
                        <Switch checked={useWallet} onCheckedChange={setUseWallet} />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>Rs. {subtotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>Coupon Discount</span>
                        <span>-Rs. {Math.min(discount, subtotal + shipping).toLocaleString()}</span>
                      </div>
                    )}
                    {referralDiscount > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>Referral Discount</span>
                        <span>-Rs. {referralDiscount.toLocaleString()}</span>
                      </div>
                    )}

                    {appliedCoupon?.category_message && (
                      <p className="text-[10px] text-amber-600">{appliedCoupon.category_message}</p>
                    )}
                    {couponExtraCredit > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet credit to be added</span>
                        <span>+Rs. {couponExtraCredit.toLocaleString()}</span>
                      </div>
                    )}
                    {walletCredit > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>Wallet Credit</span>
                        <span>-Rs. {walletCredit.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span>{shipping === 0 ? <span className="text-secondary font-medium">Free</span> : `Rs. ${shipping.toLocaleString()}`}</span>
                    </div>
                    {shippingNote && (
                      <p className="text-[10px] text-muted-foreground">{shippingNote}</p>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground text-base">
                      <span>Total</span>
                      <span>Rs. {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting || (total > 0 && !paymentMethod)}>
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : total === 0 ? (
                      <><CheckCircle className="w-4 h-4" /> Place Order (Fully Covered)</>
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
