import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { User, Package, MapPin, LogOut, Loader2, Upload, CheckCircle, Clock, Download, MessageSquare } from "lucide-react";
import { generateInvoice } from "@/lib/generateInvoice";
import type { Session } from "@supabase/supabase-js";

type ProfileTab = "details" | "orders" | "address";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>((searchParams.get("tab") as ProfileTab) || "details");
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) navigate("/auth");
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth");
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        address_line1: profile.address_line1 || "",
        address_line2: profile.address_line2 || "",
        city: profile.city || "",
        postal_code: profile.postal_code || "",
      });
    }
  }, [profile]);

  const { data: orders } = useQuery({
    queryKey: ["user-orders", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name, images, slug))")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  // SMS Balance
  const { data: smsBalance } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sms-balance");
      if (error) return null;
      return data;
    },
    staleTime: 300000, // 5 min cache
    enabled: !!session?.user?.id,
  });

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name || null,
        phone: form.phone || null,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
      })
      .eq("user_id", session.user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  const handleReceiptUpload = async (orderId: string, file: File) => {
    setUploadingReceipt(orderId);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `receipts/${orderId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("orders")
        .update({ receipt_url: urlData.publicUrl })
        .eq("id", orderId);
      if (updateError) throw updateError;

      toast.success("Receipt uploaded successfully!");
      queryClient.invalidateQueries({ queryKey: ["user-orders"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload receipt");
    } finally {
      setUploadingReceipt(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  const tabs = [
    { id: "details" as ProfileTab, label: "Account Details", icon: User },
    { id: "orders" as ProfileTab, label: "Order History", icon: Package },
    { id: "address" as ProfileTab, label: "Address", icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-36 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar */}
            <aside className="w-full md:w-64 shrink-0">
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{form.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                </div>
                <nav className="space-y-1">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        tab === t.id ? "bg-secondary/10 text-secondary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </nav>
              </div>
            </aside>

            {/* Content */}
            <main className="flex-1 min-w-0">
              {/* Account Details */}
              {tab === "details" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* SMS Balance Card */}
                  <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SMS Credits Remaining</p>
                      <p className="text-2xl font-bold text-foreground">
                        {smsBalance?.balance !== null && smsBalance?.balance !== undefined
                          ? Number(smsBalance.balance).toLocaleString()
                          : "Unlimited"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-lg font-bold font-display text-foreground mb-5">Account Details</h2>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <Label>Email</Label>
                        <Input value={session?.user?.email || ""} disabled className="bg-muted" />
                      </div>
                      <div>
                        <Label>Full Name</Label>
                        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 7X XXX XXXX" />
                      </div>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Address */}
              {tab === "address" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-bold font-display text-foreground mb-5">Shipping Address</h2>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <Label>Address Line 1</Label>
                      <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="Street address" />
                    </div>
                    <div>
                      <Label>Address Line 2</Label>
                      <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} placeholder="Apartment, suite, etc." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>City</Label>
                        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Colombo" />
                      </div>
                      <div>
                        <Label>Postal Code</Label>
                        <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="00100" />
                      </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Address"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Orders */}
              {tab === "orders" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h2 className="text-lg font-bold font-display text-foreground mb-5">Order History</h2>
                  {orders && orders.length > 0 ? (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="bg-card rounded-xl border border-border p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div>
                              <p className="text-sm font-medium text-foreground">Order #{order.id.slice(0, 8)}</p>
                              <p className="text-xs text-muted-foreground">{new Date(order.created_at!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => generateInvoice({
                                  ...order,
                                  order_items: (order.order_items as any[])?.map((item: any) => ({
                                    quantity: item.quantity,
                                    unit_price: item.unit_price,
                                    total_price: item.total_price,
                                    products: item.products,
                                  })) || [],
                                })}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Download Invoice"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                                order.status === "completed" || order.status === "delivered" ? "bg-secondary/10 text-secondary" :
                                order.status === "pending" ? "bg-accent text-accent-foreground" :
                                order.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                                "bg-muted text-muted-foreground"
                              }`}>{order.status}</span>
                              <span className="text-sm font-bold text-foreground">Rs. {order.total.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(order.order_items as any[])?.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3">
                                <img
                                  src={item.products?.images?.[0] || "/placeholder.svg"}
                                  alt=""
                                  className="w-12 h-12 rounded-lg object-cover border border-border"
                                />
                                <div className="flex-1 min-w-0">
                                  <Link
                                    to={`/product/${item.products?.slug || ""}`}
                                    className="text-sm font-medium text-foreground hover:text-secondary transition-colors line-clamp-1"
                                  >
                                    {item.products?.name || "Product"}
                                  </Link>
                                  <p className="text-xs text-muted-foreground">
                                    Qty: {item.quantity} × Rs. {item.unit_price.toLocaleString()}
                                  </p>
                                </div>
                                <p className="text-sm font-medium text-foreground">Rs. {item.total_price.toLocaleString()}</p>
                              </div>
                            ))}
                          </div>

                          {/* Receipt Upload for Bank Transfer Orders */}
                          {order.payment_method === "bank_transfer" && (
                            <div className="mt-4 pt-4 border-t border-border">
                              {(order as any).receipt_url ? (
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-secondary" />
                                  <span className="text-sm text-secondary font-medium">Receipt uploaded</span>
                                  <a
                                    href={(order as any).receipt_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground underline hover:text-foreground ml-auto"
                                  >
                                    View receipt
                                  </a>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-accent" />
                                  <span className="text-sm text-muted-foreground">Upload payment receipt</span>
                                  <label className="ml-auto">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity">
                                      <Upload className="w-3.5 h-3.5" />
                                      {uploadingReceipt === order.id ? "Uploading..." : "Upload"}
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/*,.pdf"
                                      className="hidden"
                                      disabled={uploadingReceipt === order.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleReceiptUpload(order.id, file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-card rounded-xl border border-border p-12 text-center">
                      <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground mb-4">No orders yet</p>
                      <Link to="/">
                        <Button variant="outline" size="sm">Start Shopping</Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
