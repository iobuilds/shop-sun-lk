import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Building2, Truck, Shield, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Session } from "@supabase/supabase-js";

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
  });

  const shipping = subtotal >= 5000 ? 0 : 350;
  const total = subtotal + shipping;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth?redirect=/checkout");
      setLoading(false);
    });
  }, [navigate]);

  // Load profile address
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
              {/* Shipping & Payment */}
              <div className="lg:col-span-2 space-y-6">
                {/* Shipping Info */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-bold font-display text-foreground mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-secondary" /> Shipping Information
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Full Name *</Label>
                        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" required />
                      </div>
                      <div>
                        <Label>Phone *</Label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 7X XXX XXXX" required />
                      </div>
                    </div>
                    <div>
                      <Label>Address Line 1 *</Label>
                      <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="Street address" required />
                    </div>
                    <div>
                      <Label>Address Line 2</Label>
                      <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} placeholder="Apartment, suite, etc." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>City *</Label>
                        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Colombo" required />
                      </div>
                      <div>
                        <Label>Postal Code</Label>
                        <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="00100" />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Payment Method */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-bold font-display text-foreground mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-secondary" /> Payment Method
                  </h2>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === "stripe" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                      <RadioGroupItem value="stripe" />
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Credit / Debit Card</p>
                        <p className="text-xs text-muted-foreground">Visa, MasterCard via Stripe</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === "bank_transfer" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                      <RadioGroupItem value="bank_transfer" />
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Direct Bank Transfer</p>
                        <p className="text-xs text-muted-foreground">Transfer to bank account & upload receipt</p>
                      </div>
                    </label>
                  </RadioGroup>
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

                  <div className="border-t border-border pt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>Rs. {subtotal.toLocaleString()}</span>
                    </div>
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
