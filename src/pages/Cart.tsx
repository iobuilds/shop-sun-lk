import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, ShoppingCart, ArrowRight, Truck, Shield, Tag, Loader2, Wallet, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { Session } from "@supabase/supabase-js";

const Cart = () => {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const [session, setSession] = useState<Session | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; description?: string; category_message?: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  // Wallet balance
  const { data: walletData } = useQuery({
    queryKey: ["cart-wallet", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", session!.user.id).maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id,
  });
  const walletBalance = Number((walletData as any)?.balance || 0);

  // Available coupons
  const { data: availableCoupons } = useQuery({
    queryKey: ["available-coupons", session?.user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      // Public active coupons
      const { data: publicCoupons } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .eq("coupon_type", "public")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .or(`starts_at.is.null,starts_at.lte.${now}`);

      // Private coupons assigned to user
      let privateCoupons: any[] = [];
      if (session?.user?.id) {
        const { data: assignments } = await supabase
          .from("coupon_assignments")
          .select("coupon_id, used, coupons(*)")
          .eq("used", false);

        if (assignments) {
          privateCoupons = assignments
            .filter((a: any) => a.coupons?.is_active && (!a.coupons?.expires_at || new Date(a.coupons.expires_at) > new Date()))
            .map((a: any) => a.coupons);
        }
      }

      // Combine and deduplicate
      const all = [...(publicCoupons || []), ...privateCoupons];
      const unique = Array.from(new Map(all.map((c: any) => [c.id, c])).values());
      return unique;
    },
    enabled: !!session?.user?.id,
    staleTime: 60 * 1000,
  });

  const discount = appliedCoupon?.discount || 0;
  const shipping = subtotal >= 5000 ? 0 : 350;
  const walletCredit = useWallet ? Math.min(walletBalance, Math.max(0, subtotal - discount + shipping)) : 0;
  const total = Math.max(0, subtotal - discount - walletCredit + shipping);

  const applyCoupon = async (code?: string) => {
    const codeToApply = code || couponCode;
    if (!codeToApply.trim()) return;
    if (!session) {
      toast.error("Please log in to apply coupons");
      return;
    }
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold font-display text-foreground mb-6 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" /> Shopping Cart
            <span className="text-sm font-normal text-muted-foreground">({items.length} items)</span>
          </h1>

          {items.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <ShoppingCart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground text-sm mb-6">Browse our products and add items to your cart.</p>
              <Button asChild variant="default"><Link to="/">Continue Shopping</Link></Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-3">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-xl border border-border p-4 flex gap-4"
                  >
                    <Link to={`/product/${item.slug}`}>
                      <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link to={`/product/${item.slug}`}>
                            <h3 className="text-sm font-semibold text-foreground line-clamp-1 hover:text-secondary transition-colors">{item.name}</h3>
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">In Stock</p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-border rounded-lg">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-l-lg">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-r-lg">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-base font-bold text-foreground">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div>
                <div className="bg-card rounded-xl border border-border p-6 sticky top-44 space-y-4">
                  <h2 className="text-lg font-bold font-display text-foreground">Order Summary</h2>

                  {/* Coupon Code */}
                  <div>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-secondary" />
                          <span className="text-sm font-medium text-secondary">{appliedCoupon.code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">-Rs. {appliedCoupon.discount.toLocaleString()}</span>
                          <button onClick={removeCoupon} className="p-0.5 hover:bg-secondary/10 rounded"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
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
                        <Button variant="outline" size="sm" onClick={() => applyCoupon()} disabled={validatingCoupon || !couponCode.trim()}>
                          {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Available Coupons */}
                  {session && !appliedCoupon && availableCoupons && availableCoupons.length > 0 && (
                    <div>
                      <button
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
                                {c.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{c.description}</p>}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2 shrink-0 ml-2"
                                onClick={() => applyCoupon(c.code)}
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

                  {/* Wallet Credit */}
                  {session && walletBalance > 0 && (
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
                  )}

                  {/* Totals */}
                  <div className="space-y-2 text-sm border-t border-border pt-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>Rs. {subtotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>Coupon Discount</span>
                        <span>-Rs. {discount.toLocaleString()}</span>
                      </div>
                    )}
                    {appliedCoupon?.category_message && (
                      <p className="text-[10px] text-amber-600">{appliedCoupon.category_message}</p>
                    )}
                    {walletCredit > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>Wallet Credit</span>
                        <span>-Rs. {walletCredit.toLocaleString()}</span>
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

                  {shipping > 0 && subtotal < 5000 && (
                    <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                      Add Rs. {(5000 - subtotal).toLocaleString()} more for free shipping
                    </p>
                  )}

                  <Button className="w-full gap-2" size="lg" asChild>
                    <Link to="/checkout">Proceed to Checkout <ArrowRight className="w-4 h-4" /></Link>
                  </Button>

                  <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Free over Rs. 5K</div>
                    <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secure Checkout</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Cart;
