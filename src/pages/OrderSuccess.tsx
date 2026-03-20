import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Package, ArrowRight, Loader2, Upload, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const orderId = searchParams.get("order_id");
  const method = searchParams.get("method");
  const [verifying, setVerifying] = useState(method !== "bank");
  const [paymentStatus, setPaymentStatus] = useState(method === "bank" ? "pending" : "unknown");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const { data: bankDetails } = useQuery({
    queryKey: ["site-bank-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "bank_details")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing receipt if any
  const { data: orderData } = useQuery({
    queryKey: ["order-receipt", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("receipt_url")
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  useEffect(() => {
    if (orderData?.receipt_url) setReceiptUrl(orderData.receipt_url);
  }, [orderData]);

  useEffect(() => {
    if (!orderId || method === "bank") return;
    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { order_id: orderId },
        });
        if (!error && data) setPaymentStatus(data.status || "unknown");
      } catch {
        setPaymentStatus("unknown");
      } finally {
        setVerifying(false);
      }
    };
    const timer = setTimeout(verify, 2000);
    return () => clearTimeout(timer);
  }, [orderId, method]);

  const isBankTransfer = method === "bank";
  const isPaid = paymentStatus === "paid";

  const handleFileSelect = (file: File) => {
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPendingPreview(url);
  };

  const handleUploadReceipt = async () => {
    if (!orderId || !pendingFile) return;
    setUploadingReceipt(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const fileName = `receipts/${orderId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("images").upload(fileName, pendingFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from("orders")
        .update({ receipt_url: urlData.publicUrl })
        .eq("id", orderId);
      if (updateError) throw updateError;
      setReceiptUrl(urlData.publicUrl);
      setPendingFile(null);
      setPendingPreview(null);
      toast.success("රිසිට්පත සාර්ථකව upload කරන ලදි / Receipt uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const clearPending = () => {
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
  };

  const bankAccounts: any[] = bankDetails
    ? Array.isArray(bankDetails) ? bankDetails : [bankDetails]
    : [{ bank_name: "Commercial Bank of Ceylon", account_name: "NanoCircuit.lk (Pvt) Ltd", account_number: "8012345678", branch: "Colombo Fort" }];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[120px] md:pt-[152px]">
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
                    {isPaid ? "Payment Successful!" : isBankTransfer ? "Order Placed!" : "Order Created!"}
                  </h1>
                  <p className="text-muted-foreground">
                    {isPaid
                      ? "Your payment has been confirmed. We'll start processing your order right away."
                      : isBankTransfer
                      ? "කරුණාකර පහත බැංකු ගිණුමට මුදල් මාරු කරන්න. ගෙවීම තහවුරු කිරීමෙන් පසු ඔබේ ඇණවුම තහවුරු වනු ඇත."
                      : "Your order has been created. Payment status will be updated shortly."}
                  </p>
                </div>

                {orderId && (
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">ඇණවුම් අංකය / Order ID</p>
                    <p className="text-sm font-mono font-medium text-foreground">{orderId.slice(0, 8).toUpperCase()}</p>
                  </div>
                )}

                {isBankTransfer && (
                  <div className="bg-card rounded-xl border border-border p-5 text-left space-y-4">
                    <h3 className="text-sm font-bold text-foreground">බැංකු මාරු විස්තර / Bank Transfer Details</h3>
                    {bankAccounts.map((bank: any, idx: number) => (
                      <div key={idx} className="space-y-2 text-sm">
                        {bankAccounts.length > 1 && (
                          <p className="text-xs font-bold text-foreground pt-2 first:pt-0 border-t first:border-t-0 border-border">
                            ගිණුම / Account #{idx + 1}
                          </p>
                        )}
                        {[
                          { si: "බැංකුව", en: "Bank", value: bank.bank_name },
                          { si: "ගිණුම් නම", en: "Account Name", value: bank.account_name },
                          { si: "ගිණුම් අංකය", en: "Account No", value: bank.account_number },
                          { si: "ශාඛාව", en: "Branch", value: bank.branch },
                        ].map((r) => (
                          <div key={r.en} className="flex justify-between">
                            <span className="text-muted-foreground">{r.si} / {r.en}</span>
                            <span className="font-medium text-foreground">{r.value}</span>
                          </div>
                        ))}
                        {bank.additional_info && (
                          <p className="text-xs text-muted-foreground pt-1 border-t border-border">{bank.additional_info}</p>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      කරුණාකර ඔබේ ඇණවුම් අංකය reference ලෙස ඇතුළත් කරන්න / Please include your Order ID as the payment reference.
                    </p>

                    {/* Receipt upload section with preview & change */}
                    <div className="border-t border-border pt-3 mt-3 space-y-3">
                      {/* Show pending file preview */}
                      {pendingPreview && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">Selected file preview:</p>
                          <div className="relative">
                            <img src={pendingPreview} alt="Receipt preview" className="w-full max-h-40 object-contain rounded-lg border border-border bg-muted/30" />
                            <button onClick={clearPending} className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"><X className="w-3 h-3" /></button>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUploadReceipt} disabled={uploadingReceipt} className="gap-1.5">
                              {uploadingReceipt ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</> : <><Upload className="w-3.5 h-3.5" /> Submit Receipt</>}
                            </Button>
                            <label>
                              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium cursor-pointer hover:bg-muted transition-colors text-muted-foreground">
                                Change File
                              </span>
                              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Show uploaded receipt */}
                      {!pendingPreview && receiptUrl && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-secondary" />
                            <span className="text-sm text-secondary font-medium">රිසිට්පත upload කරන ලදි / Receipt uploaded</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground">
                              <Eye className="w-3 h-3" /> View receipt
                            </a>
                            <label>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium cursor-pointer hover:bg-muted transition-colors text-muted-foreground">
                                <Upload className="w-3 h-3" /> Re-upload
                              </span>
                              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Initial upload state */}
                      {!pendingPreview && !receiptUrl && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">ගෙවීම් රිසිට්පත upload කරන්න (දැන් හෝ පසුව Profile &gt; Orders වෙතින්) / Upload payment receipt now or later from Profile &gt; Orders</p>
                          <label>
                            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity">
                              <Upload className="w-3.5 h-3.5" /> Select Receipt / රිසිට්පත තෝරන්න
                            </span>
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button asChild variant="default">
                    <Link to="/profile?tab=orders" className="gap-2">
                      <Package className="w-4 h-4" /> ඇණවුම් බලන්න / View Orders
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