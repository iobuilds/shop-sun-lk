import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShoppingCart, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

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

const DailyDeals = () => {
  const { data: deals, isLoading } = useQuery({
    queryKey: ["daily-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_deals")
        .select("*, products(*)")
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold font-display text-foreground">🔥 Daily Deals</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
      </section>
    );
  }

  if (!deals?.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold font-display text-foreground">🔥 Daily Deals</h2>
          <span className="text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
            Limited Time
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-secondary hover:text-secondary/80">
          View All →
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {deals.map((deal, i) => {
          const product = deal.products as any;
          if (!product) return null;
          const originalPrice = product.discount_price || product.price;

          return (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
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
                      onClick={(e) => e.preventDefault()}
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
    </section>
  );
};

export default DailyDeals;
