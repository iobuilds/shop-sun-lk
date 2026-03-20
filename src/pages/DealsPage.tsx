import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShoppingCart, Clock, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";

const CountdownTimer = ({ endsAt }: { endsAt: string }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      <Clock className="w-3 h-3 text-destructive" />
      <span className="text-destructive font-semibold">
        {String(timeLeft.h).padStart(2, "0")}:{String(timeLeft.m).padStart(2, "0")}:{String(timeLeft.s).padStart(2, "0")}
      </span>
    </div>
  );
};

const DealsPage = () => {
  const { addItem } = useCart();

  const { data: deals, isLoading } = useQuery({
    queryKey: ["all-daily-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_deals")
        .select("*, products(*)")
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleAddToCart = (e: React.MouseEvent, deal: any) => {
    e.preventDefault();
    const product = deal.products as any;
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      price: deal.deal_price || product.price,
      image: product.images?.[0] || "/placeholder.svg",
      slug: product.slug,
    });
    toast({ title: "Added to cart", description: product.name });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Daily Deals — NanoCircuit.lk"
        description="Shop today's best deals on electronics, components, and more at NanoCircuit.lk. Limited-time offers with countdown timers."
      />
      <Navbar />
      <main className="pt-[120px] md:pt-[152px]">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="flex items-center gap-3 mb-8">
            <Tag className="w-6 h-6 text-destructive" />
            <h1 className="text-3xl font-bold font-display text-foreground">Daily Deals</h1>
            <span className="text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
              Limited Time
            </span>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
                  <div className="aspect-square bg-muted rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-5 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !deals?.length && (
            <div className="text-center py-24">
              <Tag className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-xl font-semibold text-foreground mb-2">No active deals right now</p>
              <p className="text-muted-foreground">Check back soon for new daily deals!</p>
            </div>
          )}

          {!isLoading && !!deals?.length && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {deals.map((deal, i) => {
                const product = deal.products as any;
                if (!product) return null;
                const originalPrice = product.discount_price || product.price;

                return (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                  >
                    <Link
                      to={`/product/${product.slug}`}
                      className="group bg-card rounded-xl border border-border card-elevated overflow-hidden cursor-pointer block"
                    >
                      <div className="relative overflow-hidden">
                        <img
                          src={product.images?.[0] || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <span className="absolute top-2 left-2 deal-gradient text-secondary-foreground text-xs font-bold px-2 py-1 rounded-md">
                          -{deal.discount_percent}%
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Deal</p>
                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-secondary transition-colors">
                          {product.name}
                        </h3>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-base font-bold text-foreground">
                            Rs. {(deal.deal_price || product.price).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground line-through">
                            Rs. {originalPrice.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <CountdownTimer endsAt={deal.ends_at} />
                          <button
                            onClick={(e) => handleAddToCart(e, deal)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground transition-all duration-300"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default DealsPage;
