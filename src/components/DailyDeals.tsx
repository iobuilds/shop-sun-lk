import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Deal {
  id: number;
  name: string;
  originalPrice: number;
  dealPrice: number;
  discount: number;
  endsAt: Date;
  image: string;
  category: string;
}

const deals: Deal[] = [
  {
    id: 1,
    name: "Arduino Uno R3 Board",
    originalPrice: 4500,
    dealPrice: 2950,
    discount: 35,
    endsAt: new Date(Date.now() + 8 * 3600000),
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=300&fit=crop",
    category: "Boards",
  },
  {
    id: 2,
    name: "Sensor Kit (37-in-1)",
    originalPrice: 8900,
    dealPrice: 5990,
    discount: 33,
    endsAt: new Date(Date.now() + 12 * 3600000),
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=300&fit=crop",
    category: "Sensors",
  },
  {
    id: 3,
    name: "Soldering Station Kit",
    originalPrice: 12500,
    dealPrice: 8750,
    discount: 30,
    endsAt: new Date(Date.now() + 5 * 3600000),
    image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=300&h=300&fit=crop",
    category: "Tools",
  },
  {
    id: 4,
    name: "ESP32 WiFi Module",
    originalPrice: 3200,
    dealPrice: 1990,
    discount: 38,
    endsAt: new Date(Date.now() + 10 * 3600000),
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=300&h=300&fit=crop",
    category: "Modules",
  },
];

const CountdownTimer = ({ endsAt }: { endsAt: Date }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endsAt.getTime() - Date.now());
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
        {deals.map((deal, i) => (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="group bg-card rounded-xl border border-border card-elevated overflow-hidden cursor-pointer"
          >
            <div className="relative overflow-hidden">
              <img
                src={deal.image}
                alt={deal.name}
                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <span className="absolute top-2 left-2 deal-gradient text-secondary-foreground text-xs font-bold px-2 py-1 rounded-md">
                -{deal.discount}%
              </span>
            </div>
            <div className="p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{deal.category}</p>
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-secondary transition-colors">
                {deal.name}
              </h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-base font-bold text-foreground">Rs. {deal.dealPrice.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground line-through">Rs. {deal.originalPrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <CountdownTimer endsAt={deal.endsAt} />
                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground transition-all duration-300">
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default DailyDeals;
