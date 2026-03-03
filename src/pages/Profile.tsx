import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { User, Package, MapPin, LogOut, Loader2, Upload, CheckCircle, Clock, Download, MessageSquare, Send, ChevronLeft } from "lucide-react";
import { generateInvoice } from "@/lib/generateInvoice";
import type { Session } from "@supabase/supabase-js";

type ProfileTab = "details" | "orders" | "address" | "messages";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>((searchParams.get("tab") as ProfileTab) || "details");
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Conversations query
  const { data: conversations } = useQuery({
    queryKey: ["user-conversations", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations" as any)
        .select("*")
        .eq("user_id", session!.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!session?.user?.id,
  });

  // Messages for selected conversation
  const { data: convoMessages } = useQuery({
    queryKey: ["convo-messages", selectedConvo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_messages" as any)
        .select("*")
        .eq("conversation_id", selectedConvo!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedConvo,
    refetchInterval: 5000,
  });

  // Mark messages as read when viewing
  useEffect(() => {
    if (selectedConvo && convoMessages && session?.user) {
      const unreadAdminMsgs = convoMessages.filter((m: any) => m.sender_type === "admin" && !m.is_read);
      if (unreadAdminMsgs.length > 0) {
        const ids = unreadAdminMsgs.map((m: any) => m.id);
        supabase
          .from("conversation_messages" as any)
          .update({ is_read: true })
          .in("id", ids)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["convo-messages", selectedConvo] });
          });
      }
    }
  }, [convoMessages, selectedConvo]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convoMessages]);

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

  const sendReply = async () => {
    if (!newMessage.trim() || !selectedConvo || !session?.user) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from("conversation_messages" as any)
        .insert({
          conversation_id: selectedConvo,
          sender_id: session.user.id,
          sender_type: "user",
          message: newMessage.trim(),
        });
      if (error) throw error;
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["convo-messages", selectedConvo] });
      queryClient.invalidateQueries({ queryKey: ["user-conversations"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const tabs = [
    { id: "details" as ProfileTab, label: "Account Details", icon: User },
    { id: "orders" as ProfileTab, label: "Order History", icon: Package },
    { id: "messages" as ProfileTab, label: "Messages", icon: MessageSquare },
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

              {/* Messages */}
              {tab === "messages" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {selectedConvo ? (
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      {/* Thread header */}
                      <div className="p-4 border-b border-border flex items-center gap-3">
                        <button onClick={() => setSelectedConvo(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">
                            {conversations?.find((c: any) => c.id === selectedConvo)?.subject || "Conversation"}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {conversations?.find((c: any) => c.id === selectedConvo)?.status === "closed" ? "Closed" : "Open"}
                          </p>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                        {convoMessages?.map((m: any) => (
                          <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                              m.sender_type === "user"
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-muted text-foreground"
                            }`}>
                              <p className="whitespace-pre-wrap">{m.message}</p>
                              <p className={`text-[10px] mt-1 ${m.sender_type === "user" ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>
                                {new Date(m.created_at).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                        ))}
                        {(!convoMessages || convoMessages.length === 0) && (
                          <p className="text-center text-muted-foreground text-sm py-8">No messages yet</p>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Reply box */}
                      {conversations?.find((c: any) => c.id === selectedConvo)?.status !== "closed" && (
                        <div className="p-3 border-t border-border flex gap-2">
                          <Input
                            placeholder="Type your reply..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                            className="flex-1"
                          />
                          <Button onClick={sendReply} disabled={sendingMessage || !newMessage.trim()} size="icon">
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-lg font-bold font-display text-foreground mb-5">Messages</h2>
                      {conversations && conversations.length > 0 ? (
                        <div className="space-y-3">
                          {conversations.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedConvo(c.id)}
                              className="w-full text-left bg-card rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-foreground text-sm truncate">{c.subject}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {new Date(c.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                </div>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  c.status === "open" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                                }`}>
                                  {c.status}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-card rounded-xl border border-border p-12 text-center">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-muted-foreground mb-4">No messages yet</p>
                          <Link to="/contact">
                            <Button variant="outline" size="sm">Contact Us</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}


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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <CheckCircle className="w-4 h-4 text-secondary" />
                                  <span className="text-sm text-secondary font-medium">Receipt uploaded</span>
                                  <div className="flex items-center gap-2 ml-auto">
                                    <a
                                      href={(order as any).receipt_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-muted-foreground underline hover:text-foreground"
                                    >
                                      View receipt
                                    </a>
                                    <label>
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium cursor-pointer hover:bg-muted transition-colors text-muted-foreground">
                                        <Upload className="w-3 h-3" />
                                        {uploadingReceipt === order.id ? "Uploading..." : "Re-upload"}
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
