import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Package, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const method = searchParams.get("method");
  const [verifying, setVerifying] = useState(method !== "bank");
  const [paymentStatus, setPaymentStatus] = useState(method === "bank" ? "pending" : "unknown");

  useEffect(() => {
    if (!orderId || method === "bank") return;

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { order_id: orderId },
        });
        if (!error && data) {
          setPaymentStatus(data.status || "unknown");
        }
      } catch {
        setPaymentStatus("unknown");
      } finally {
        setVerifying(false);
      }
    };

    // Small delay to let Stripe process
    const timer = setTimeout(verify, 2000);
    return () => clearTimeout(timer);
  }, [orderId, method]);

  const isBankTransfer = method === "bank";
  const isPaid = paymentStatus === "paid";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto text-center"
          >
            {verifying ? (
              <div className="space-y-4">
                <Loader2 className="w-16 h-16 text-secondary mx-auto animate-spin" />
                <h1 className="text-2xl font-bold font-display text-foreground">Verifying Payment...</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
                  isPaid || isBankTransfer ? "bg-secondary/10" : "bg-accent/10"
                }`}>
                  {isPaid ? (
                    <CheckCircle className="w-10 h-10 text-secondary" />
                  ) : isBankTransfer ? (
                    <Clock className="w-10 h-10 text-accent" />
                  ) : (
                    <Package className="w-10 h-10 text-accent" />
                  )}
                </div>

                <div>
                  <h1 className="text-2xl font-bold font-display text-foreground mb-2">
                    {isPaid
                      ? "Payment Successful!"
                      : isBankTransfer
                      ? "Order Placed!"
                      : "Order Created!"}
                  </h1>
                  <p className="text-muted-foreground">
                    {isPaid
                      ? "Your payment has been confirmed. We'll start processing your order right away."
                      : isBankTransfer
                      ? "Please transfer the payment to our bank account. Your order will be confirmed after payment verification."
                      : "Your order has been created. Payment status will be updated shortly."}
                  </p>
                </div>

                {orderId && (
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Order ID</p>
                    <p className="text-sm font-mono font-medium text-foreground">{orderId.slice(0, 8).toUpperCase()}</p>
                  </div>
                )}

                {isBankTransfer && (
                  <div className="bg-card rounded-xl border border-border p-5 text-left space-y-3">
                    <h3 className="text-sm font-bold text-foreground">Bank Transfer Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium text-foreground">Commercial Bank of Ceylon</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Name</span>
                        <span className="font-medium text-foreground">TechLK (Pvt) Ltd</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account No</span>
                        <span className="font-medium text-foreground">8012345678</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Branch</span>
                        <span className="font-medium text-foreground">Colombo Fort</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Please include your Order ID as the reference. Upload your payment receipt via your profile &gt; Order History.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button asChild variant="default">
                    <Link to="/profile" className="gap-2">
                      <Package className="w-4 h-4" /> View Orders
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/" className="gap-2">
                      Continue Shopping <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default OrderSuccess;
