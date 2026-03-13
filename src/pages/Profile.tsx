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
import { User, Package, MapPin, LogOut, Loader2, Upload, CheckCircle, Clock, Download, MessageSquare, Send, ChevronLeft, Wallet, ArrowUpCircle, ArrowDownCircle, Tag, Percent, BadgeCheck, Paperclip, FileText, X, Image as ImageIcon } from "lucide-react";
import { generateInvoice } from "@/lib/generateInvoice";
import type { Session } from "@supabase/supabase-js";

type ProfileTab = "details" | "orders" | "address" | "messages" | "wallet" | "coupons";

const WalletSection = ({ userId }: { userId: string }) => {
  const { data: wallet } = useQuery({
    queryKey: ["user-wallet", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets" as any).select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId,
  });
  const { data: transactions } = useQuery({
    queryKey: ["user-wallet-transactions", wallet?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_transactions" as any).select("*").eq("wallet_id", wallet!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!wallet?.id,
  });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="bg-secondary/10 rounded-xl px-6 py-4">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-2xl font-bold text-secondary">Rs. {Number(wallet?.balance || 0).toLocaleString()}</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Transaction History</h3>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                {Number(t.amount) >= 0 ? <ArrowUpCircle className="w-4 h-4 text-secondary shrink-0" /> : <ArrowDownCircle className="w-4 h-4 text-destructive shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{t.reason}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <span className={`font-bold text-sm ${Number(t.amount) >= 0 ? "text-secondary" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}Rs. {Math.abs(Number(t.amount)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">No transactions yet</p>
        )}
      </div>
    </div>
  );
};

const MyCouponsSection = ({ userId, userPhone }: { userId: string; userPhone: string }) => {
  const cleanPhone = userPhone?.replace(/\s/g, "") || "";

  // Fetch private coupons assigned to this user
  const { data: assignments } = useQuery({
    queryKey: ["my-coupon-assignments", userId, cleanPhone],
    queryFn: async () => {
      let query = supabase
        .from("coupon_assignments" as any)
        .select("*, coupons(*)")
        .order("created_at", { ascending: false });

      // Match by user_id OR phone
      if (cleanPhone) {
        query = query.or(`user_id.eq.${userId},phone.eq.${cleanPhone}`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userId,
  });

  // Fetch public coupons
  const { data: publicCoupons } = useQuery({
    queryKey: ["public-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons" as any)
        .select("*")
        .eq("is_active", true)
        .eq("coupon_type", "public");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch user's coupon usage counts
  const { data: usageCounts } = useQuery({
    queryKey: ["my-coupon-usage", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_usage" as any)
        .select("coupon_id")
        .eq("user_id", userId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[])?.forEach((u: any) => {
        counts[u.coupon_id] = (counts[u.coupon_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!userId,
  });

  // Fetch category names for display
  const { data: categories } = useQuery({
    queryKey: ["all-categories-names"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
  const catMap = new Map(categories?.map((c: any) => [c.id, c.name]) || []);

  const getCouponStatus = (coupon: any) => {
    if (!coupon?.is_active) return "inactive";
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return "expired";
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) return "upcoming";
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return "used_up";
    const userUses = usageCounts?.[coupon.id] || 0;
    if (coupon.per_user_limit && userUses >= coupon.per_user_limit) return "used_up";
    return "active";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Active</span>;
      case "expired": return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Expired</span>;
      case "used_up": return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Used Up</span>;
      case "upcoming": return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">Upcoming</span>;
      default: return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>;
    }
  };

  const renderCouponCard = (coupon: any, isPrivate = false) => {
    const status = getCouponStatus(coupon);
    const validCats = (coupon.valid_category_ids || []).map((id: string) => catMap.get(id)).filter(Boolean);
    const userUses = usageCounts?.[coupon.id] || 0;

    return (
      <div key={coupon.id + (isPrivate ? "-priv" : "")} className={`rounded-xl border p-4 ${status === "active" ? "border-secondary/30 bg-card" : "border-border bg-muted/30 opacity-70"}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isPrivate ? <BadgeCheck className="w-4 h-4 text-secondary shrink-0" /> : <Percent className="w-4 h-4 text-muted-foreground shrink-0" />}
            <code className="text-sm font-bold text-foreground bg-muted px-2 py-0.5 rounded select-all">{coupon.code}</code>
          </div>
          {statusBadge(status)}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {coupon.discount_type === "percentage"
            ? `${coupon.discount_value}% off`
            : `Rs. ${Number(coupon.discount_value).toLocaleString()} off`}
          {coupon.max_discount_cap && coupon.discount_type === "percentage" && (
            <span className="text-xs text-muted-foreground font-normal"> (max Rs. {Number(coupon.max_discount_cap).toLocaleString()})</span>
          )}
        </p>
        {coupon.description && <p className="text-xs text-muted-foreground mt-1">{coupon.description}</p>}
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {coupon.min_order_amount > 0 && <p>Min order: Rs. {Number(coupon.min_order_amount).toLocaleString()}</p>}
          {coupon.category_scope !== "all" && validCats.length > 0 && (
            <p>{coupon.category_scope === "selected" ? "Valid for" : "Excludes"}: {validCats.join(", ")}</p>
          )}
          {coupon.starts_at && <p>From: {new Date(coupon.starts_at).toLocaleDateString()}</p>}
          {coupon.expires_at && <p>Until: {new Date(coupon.expires_at).toLocaleDateString()}</p>}
          {coupon.per_user_limit && <p>Uses: {userUses}/{coupon.per_user_limit}</p>}
        </div>
      </div>
    );
  };

  const privateCoupons = assignments?.map((a: any) => a.coupons).filter(Boolean) || [];
  const activePubCoupons = publicCoupons?.filter((c: any) => getCouponStatus(c) === "active" || getCouponStatus(c) === "upcoming") || [];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-bold font-display text-foreground mb-5 flex items-center gap-2">
          <Tag className="w-5 h-5 text-secondary" /> My Coupons
        </h2>

        {/* Private / Assigned */}
        {privateCoupons.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <BadgeCheck className="w-3.5 h-3.5 text-secondary" /> Assigned to You
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {privateCoupons.map((c: any) => renderCouponCard(c, true))}
            </div>
          </div>
        )}

        {/* Public */}
        {activePubCoupons.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Available Coupons</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activePubCoupons.map((c: any) => renderCouponCard(c))}
            </div>
          </div>
        )}

        {privateCoupons.length === 0 && activePubCoupons.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No coupons available right now</p>
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>((searchParams.get("tab") as ProfileTab) || "details");
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(searchParams.get("convo") || null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachingFile, setAttachingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth");
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        navigate("/auth");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(session);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
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

  // Realtime sync for order updates
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel('user-orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-orders", session.user.id] });
        queryClient.invalidateQueries({ queryKey: ["user-wallet", session.user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, queryClient]);

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
    if (!newMessage.trim() && !pendingFile || !selectedConvo || !session?.user) return;
    setSendingMessage(true);
    try {
      let messageText = newMessage.trim();

      // Upload file if attached
      if (pendingFile) {
        setAttachingFile(true);
        const ext = pendingFile.name.split(".").pop();
        const filePath = `chat-attachments/${selectedConvo}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("images").upload(filePath, pendingFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("images").getPublicUrl(filePath);
        // Encode as special prefix so we can render it
        const fileMsg = `[attachment:${urlData.publicUrl}:${pendingFile.name}]`;
        messageText = messageText ? `${messageText}\n${fileMsg}` : fileMsg;
        setAttachingFile(false);
        setPendingFile(null);
      }

      const { error } = await supabase
        .from("conversation_messages" as any)
        .insert({
          conversation_id: selectedConvo,
          sender_id: session.user.id,
          sender_type: "user",
          message: messageText,
        });
      if (error) throw error;
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["convo-messages", selectedConvo] });
      queryClient.invalidateQueries({ queryKey: ["user-conversations"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingMessage(false);
      setAttachingFile(false);
    }
  };

  const tabs = [
    { id: "details" as ProfileTab, label: "Account Details", icon: User },
    { id: "orders" as ProfileTab, label: "Order History", icon: Package },
    { id: "coupons" as ProfileTab, label: "My Coupons", icon: Tag },
    { id: "wallet" as ProfileTab, label: "Wallet", icon: Wallet },
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
                    {profileLoading ? (
                      <div className="space-y-4 max-w-md">
                        {[1,2,3].map(i => <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />)}
                      </div>
                    ) : profileError ? (
                      <p className="text-sm text-destructive">Failed to load profile data. Please try again.</p>
                    ) : (
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
                          <Input
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="+94 7X XXX XXXX"
                            disabled={!!profile?.phone_verified}
                          />
                          {profile?.phone_verified && (
                            <p className="text-[10px] text-secondary mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Verified — contact support to change</p>
                          )}
                        </div>
                        <Button onClick={handleSave} disabled={saving}>
                          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : "Save Changes"}
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Address */}
              {tab === "address" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-bold font-display text-foreground mb-5">Shipping Address</h2>
                  {profileLoading ? (
                    <div className="space-y-4 max-w-md">
                      {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />)}
                    </div>
                  ) : profileError ? (
                    <p className="text-sm text-destructive">Failed to load address data. Please try again.</p>
                  ) : (
                    <>
                      {!form.address_line1 && !form.city && !form.postal_code && (
                        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="w-4 h-4" /> No address saved yet. Fill in your details below.</p>
                        </div>
                      )}
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
                          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : "Save Address"}
                        </Button>
                      </div>
                    </>
                  )}
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
                        {convoMessages?.map((m: any) => {
                          const parts = m.message?.split(/(\[attachment:[^\]]+\])/g) || [];
                          return (
                            <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                                m.sender_type === "user"
                                  ? "bg-secondary text-secondary-foreground"
                                  : "bg-muted text-foreground"
                              }`}>
                                {parts.map((part: string, i: number) => {
                                  const match = part.match(/^\[attachment:(.+):([^:]+)\]$/);
                                  if (match) {
                                    const [, url, filename] = match;
                                    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(filename);
                                    return isImage ? (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                                        <img src={url} alt={filename} className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90" />
                                        <p className="text-[10px] mt-0.5 opacity-60 truncate">{filename}</p>
                                      </a>
                                    ) : (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-background/20 hover:bg-background/30 transition-colors">
                                        <FileText className="w-4 h-4 shrink-0" />
                                        <span className="text-xs truncate max-w-[180px]">{filename}</span>
                                        <Download className="w-3 h-3 shrink-0 opacity-60" />
                                      </a>
                                    );
                                  }
                                  return part ? <p key={i} className="whitespace-pre-wrap">{part}</p> : null;
                                })}
                                <p className={`text-[10px] mt-1 ${m.sender_type === "user" ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>
                                  {new Date(m.created_at).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {(!convoMessages || convoMessages.length === 0) && (
                          <p className="text-center text-muted-foreground text-sm py-8">No messages yet</p>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Reply box */}
                      {conversations?.find((c: any) => c.id === selectedConvo)?.status !== "closed" && (
                        <div className="p-3 border-t border-border space-y-2">
                          {pendingFile && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-xs">
                              <Paperclip className="w-3.5 h-3.5 text-secondary shrink-0" />
                              <span className="truncate flex-1">{pendingFile.name}</span>
                              <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" className="hidden"
                              onChange={(e) => { if (e.target.files?.[0]) { setPendingFile(e.target.files[0]); e.target.value = ""; } }} />
                            <button onClick={() => fileInputRef.current?.click()}
                              className="p-2 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <Input
                              placeholder="Type your reply..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                              className="flex-1"
                            />
                            <Button onClick={sendReply} disabled={sendingMessage || attachingFile || (!newMessage.trim() && !pendingFile)} size="icon">
                              {(sendingMessage || attachingFile) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                          </div>
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

              {/* My Coupons */}
              {tab === "coupons" && session?.user?.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <MyCouponsSection userId={session.user.id} userPhone={profile?.phone || ""} />
                </motion.div>
              )}

              {/* Wallet */}
              {tab === "wallet" && session?.user?.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-lg font-bold font-display text-foreground mb-5 flex items-center gap-2"><Wallet className="w-5 h-5 text-secondary" /> Wallet</h2>
                    <WalletSection userId={session.user.id} />
                  </div>
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
