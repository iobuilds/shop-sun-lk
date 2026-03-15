import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShoppingBag, Wallet, Ticket, MapPin, Phone, Calendar, Mail, Package } from "lucide-react";

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userRole: string;
  initialProfile?: any;
}

const UserDetailDialog = ({ open, onOpenChange, userId, userRole, initialProfile }: UserDetailDialogProps) => {
  const { data: profileData } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    initialData: initialProfile ?? undefined,
    staleTime: 0,
  });
  const profile = profileData ?? initialProfile;

  const { data: userOrders } = useQuery({
    queryKey: ["admin-user-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: wallet } = useQuery({
    queryKey: ["admin-user-wallet", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets" as any)
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId,
  });

  const { data: walletTxns } = useQuery({
    queryKey: ["admin-user-wallet-txns", userId, wallet?.id],
    queryFn: async () => {
      if (!wallet?.id) return [];
      const { data, error } = await supabase
        .from("wallet_transactions" as any)
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!wallet?.id,
  });

  const { data: assignedCoupons } = useQuery({
    queryKey: ["admin-user-coupons", userId],
    queryFn: async () => {
      const filters: string[] = [];
      if (userId) filters.push(`user_id.eq.${userId}`);
      const { data, error } = await supabase
        .from("coupon_assignments" as any)
        .select("*, coupons(*)")
        .or(filters.length ? filters.join(",") : "user_id.is.null");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userId,
  });

  const { data: reviews } = useQuery({
    queryKey: ["admin-user-reviews", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, products(name)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!userId && open,
  });

  if (!userId) return null;

  const totalSpent = userOrders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        {/* Profile Header */}
        <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl border border-border">
          <Avatar className="w-14 h-14">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-secondary/10 text-secondary text-lg font-bold">
              {(profile?.full_name || "U")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-foreground">{profile?.full_name || "Unknown"}</h3>
              <Badge variant={userRole === "admin" ? "destructive" : "secondary"} className="capitalize text-[10px]">
                {userRole}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
              {profile?.phone && (
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{profile.phone}</span>
              )}
              {profile?.city && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.city}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px]">ID: {userId?.slice(0, 12)}...</span>
            </div>
            {(profile?.address_line1 || profile?.address_line2) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[profile.address_line1, profile.address_line2, profile.postal_code].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-secondary" />
            <p className="text-lg font-bold text-foreground">{userOrders?.length || 0}</p>
            <p className="text-[10px] text-muted-foreground">Orders</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <Package className="w-5 h-5 mx-auto mb-1 text-secondary" />
            <p className="text-lg font-bold text-foreground">Rs. {totalSpent.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Spent</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <Wallet className="w-5 h-5 mx-auto mb-1 text-secondary" />
            <p className="text-lg font-bold text-foreground">Rs. {Number(wallet?.balance || 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Wallet</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="orders" className="flex-1 text-xs">Orders ({userOrders?.length || 0})</TabsTrigger>
            <TabsTrigger value="wallet" className="flex-1 text-xs">Wallet</TabsTrigger>
            <TabsTrigger value="coupons" className="flex-1 text-xs">Coupons</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 text-xs">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-2 max-h-60 overflow-y-auto">
            {userOrders?.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 border border-border rounded-lg text-xs">
                <div>
                  <p className="font-medium text-foreground">#{o.id.slice(0, 8)}</p>
                  <p className="text-muted-foreground">{new Date(o.created_at!).toLocaleDateString()} • {o.order_items?.length || 0} items</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">Rs. {Number(o.total).toLocaleString()}</p>
                  <Badge variant={o.status === "delivered" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"} className="text-[10px] capitalize">
                    {o.status}
                  </Badge>
                </div>
              </div>
            ))}
            {(!userOrders || userOrders.length === 0) && (
              <p className="text-center py-6 text-muted-foreground text-sm">No orders yet</p>
            )}
          </TabsContent>

          <TabsContent value="wallet" className="space-y-2 max-h-60 overflow-y-auto">
            {walletTxns?.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 border border-border rounded-lg text-xs">
                <div>
                  <p className="font-medium text-foreground">{t.reason}</p>
                  <p className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <span className={`font-bold ${Number(t.amount) >= 0 ? "text-secondary" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}Rs. {Math.abs(Number(t.amount)).toLocaleString()}
                </span>
              </div>
            ))}
            {(!walletTxns || walletTxns.length === 0) && (
              <p className="text-center py-6 text-muted-foreground text-sm">No wallet transactions</p>
            )}
          </TabsContent>

          <TabsContent value="coupons" className="space-y-2 max-h-60 overflow-y-auto">
            {assignedCoupons?.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 border border-border rounded-lg text-xs">
                <div>
                  <p className="font-medium text-foreground font-mono">{a.coupons?.code || "—"}</p>
                  <p className="text-muted-foreground">{a.coupons?.name || ""} • {a.coupons?.discount_type === "percentage" ? `${a.coupons?.discount_value}%` : `Rs. ${a.coupons?.discount_value}`}</p>
                </div>
                <Badge variant={a.used ? "secondary" : "default"} className="text-[10px]">
                  {a.used ? "Used" : "Available"}
                </Badge>
              </div>
            ))}
            {(!assignedCoupons || assignedCoupons.length === 0) && (
              <p className="text-center py-6 text-muted-foreground text-sm">No assigned coupons</p>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-2 max-h-60 overflow-y-auto">
            {reviews?.map((r) => (
              <div key={r.id} className="p-3 border border-border rounded-lg text-xs">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground">{r.products?.name || "Unknown"}</p>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`text-xs ${i < r.rating ? "text-accent" : "text-border"}`}>★</span>
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
                <p className="text-muted-foreground mt-1">{new Date(r.created_at!).toLocaleDateString()}</p>
              </div>
            ))}
            {(!reviews || reviews.length === 0) && (
              <p className="text-center py-6 text-muted-foreground text-sm">No reviews yet</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailDialog;
