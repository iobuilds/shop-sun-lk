import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Package, Search, Truck, CheckCircle, Clock, XCircle, CreditCard, ArrowLeft, AlertTriangle, MapPin, ExternalLink, StickyNote, CalendarDays, Box } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";

type OrderWithItems = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  created_at: string;
  shipping_address: any;
  tracking_number?: string;
  courier_name?: string;
  tracking_link?: string;
  expected_delivery?: string;
  delivery_note?: string;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: { name: string; images: string[] | null; slug: string } | null;
  }[];
};

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle },
  { key: "paid", label: "Payment Confirmed", icon: CreditCard },
  { key: "processing", label: "Processing", icon: Clock },
  { key: "packed", label: "Packed", icon: Box },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
];

const getStatusIndex = (status: string) => {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
};

const OrderTimeline = ({ status }: { status: string }) => {
  const currentIdx = status === "cancelled" ? -1 : getStatusIndex(status);

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
        <XCircle className="w-6 h-6 text-destructive" />
        <span className="font-medium text-destructive">Order Cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-4">
      {STATUS_STEPS.map((step, i) => {
        const isComplete = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[80px]">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isComplete
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
                } ${isCurrent ? "ring-2 ring-secondary ring-offset-2 ring-offset-background" : ""}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[11px] mt-1.5 text-center ${isComplete ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${i < currentIdx ? "bg-secondary" : "bg-border"} -mt-5`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const OrderCard = ({ order }: { order: OrderWithItems }) => {
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadedHistory, setLoadedHistory] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabase
        .from("order_status_history" as any)
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });
      setStatusHistory((data as any[]) || []);
      setLoadedHistory(true);
    };
    loadHistory();
  }, [order.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Order ID</p>
          <p className="font-mono font-bold text-foreground">{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Placed on</p>
          <p className="text-sm text-foreground">{new Date(order.created_at!).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
      </div>

      <OrderTimeline status={order.status} />

      {/* Tracking Info */}
      {(order.tracking_number || order.courier_name || order.expected_delivery || order.delivery_note) && (
        <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-1.5">
          {order.tracking_number && (
            <div className="flex items-center gap-2 text-sm">
              <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground font-medium">{order.tracking_number}</span>
              {order.courier_name && <span className="text-muted-foreground">({order.courier_name})</span>}
              {order.tracking_link && (
                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline ml-auto flex items-center gap-1 text-xs">
                  Track <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          {order.expected_delivery && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>Expected: {order.expected_delivery}</span>
            </div>
          )}
          {order.delivery_note && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{order.delivery_note}</span>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        {order.order_items?.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <img
              src={item.products?.images?.[0] || "/placeholder.svg"}
              alt={item.products?.name || "Product"}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <Link to={`/product/${item.products?.slug || ""}`} className="text-sm font-medium text-foreground hover:text-secondary line-clamp-1">
                {item.products?.name || "Product"}
              </Link>
              <p className="text-xs text-muted-foreground">Qty: {item.quantity} × Rs. {item.unit_price.toLocaleString()}</p>
            </div>
            <p className="text-sm font-medium text-foreground">Rs. {item.total_price.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-bold text-foreground">Rs. {order.total.toLocaleString()}</span>
      </div>

      {/* Status History Timeline */}
      {loadedHistory && statusHistory.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Delivery Updates</p>
          <div className="space-y-0 relative ml-2">
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-border" />
            {statusHistory.map((h: any, i: number) => (
              <div key={h.id} className="flex gap-2.5 relative pb-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 z-10 ${i === statusHistory.length - 1 ? "bg-secondary" : "bg-muted-foreground/40"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground capitalize">{h.status?.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                  {h.note && <p className="text-[10px] text-foreground bg-muted/50 rounded px-1.5 py-0.5 mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
const NotFoundRedirect = ({ orderId, onRetry }: { orderId: string; onRetry: () => void }) => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card rounded-xl border border-border p-8 text-center space-y-4"
    >
      <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold text-foreground">404 — Tracking Not Found</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        This tracking code "<span className="font-mono font-bold">{orderId}</span>" is invalid or not available yet.
      </p>
      <p className="text-xs text-muted-foreground">Redirecting to Home in <span className="font-bold text-foreground">{countdown}s</span></p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onRetry}>
          Try Again
        </Button>
        <Link to="/">
          <Button variant="default">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Home Now
          </Button>
        </Link>
      </div>
    </motion.div>
  );
};

const TrackOrder = () => {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("id") || "");
  const [searchedOrder, setSearchedOrder] = useState<OrderWithItems | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [myOrders, setMyOrders] = useState<OrderWithItems[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchMyOrders(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchMyOrders(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMyOrders = async (userId: string) => {
    setLoadingMyOrders(true);
    const { data } = await supabase
      .from("orders")
      .select("id, status, payment_status, total, subtotal, shipping_fee, discount_amount, created_at, shipping_address, tracking_number, courier_name, tracking_link, expected_delivery, delivery_note, order_items(id, quantity, unit_price, total_price, products(name, images, slug))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setMyOrders((data as any) || []);
    setLoadingMyOrders(false);
  };

  const searchOrder = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setNotFound(false);
    setSearchedOrder(null);

    // Try searching by full UUID or short ID prefix
    const query = orderId.trim().toLowerCase();
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, total, subtotal, shipping_fee, discount_amount, created_at, shipping_address, tracking_number, courier_name, tracking_link, expected_delivery, delivery_note, order_items(id, quantity, unit_price, total_price, products(name, images, slug))")
      .or(`id.eq.${query},id.ilike.${query}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
    } else {
      setSearchedOrder(data as any);
    }
    setLoading(false);
  };

  // Auto-search if URL has ?id=
  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      setOrderId(urlId);
      setTimeout(() => searchOrder(), 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Track Your Order — NanoCircuit.lk" description="Track your order status in real-time." />
      <Navbar />
      <main className="pt-[136px] md:pt-[160px] pb-12">
        <div className="container mx-auto px-4 max-w-3xl space-y-8 py-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold font-display text-foreground">Track Your Order</h1>
            <p className="text-muted-foreground">Enter your order ID to check delivery status</p>
          </div>

          {/* Search */}
          <div className="bg-card rounded-xl border border-border p-5">
            <form
              onSubmit={(e) => { e.preventDefault(); searchOrder(); }}
              className="flex gap-3"
            >
              <Input
                placeholder="Enter Order ID (e.g. A1B2C3D4)"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !orderId.trim()}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Searching..." : "Track"}
              </Button>
            </form>
          </div>

          {/* Not Found with auto-redirect */}
          {notFound && <NotFoundRedirect orderId={orderId} onRetry={() => { setNotFound(false); setOrderId(""); }} />}

          {/* Searched Order Result */}
          {searchedOrder && <OrderCard order={searchedOrder} />}

          {/* My Orders (logged-in) */}
          {session && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display text-foreground">My Orders</h2>
              {loadingMyOrders ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse space-y-3">
                      <div className="h-5 bg-muted rounded w-1/3" />
                      <div className="h-10 bg-muted rounded" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : myOrders.length > 0 ? (
                <div className="space-y-4">
                  {myOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No orders yet. Start shopping!</p>
                  <Link to="/">
                    <Button className="mt-4">Browse Products</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrder;
