import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import bannerCombo from "@/assets/banner-combo.jpg";
import bannerDeals from "@/assets/banner-deals.jpg";

const fallbackBanners = [
  { id: "f1", title: "Combo Starter Packs", subtitle: "Save up to 25%", description: "Get everything you need in one box. Perfect for beginners.", badge_text: "Save up to 25%", image_url: bannerCombo, link_url: "/category/combo-packs", gradient_from: "primary" },
  { id: "f2", title: "Daily Deals Live Now", subtitle: "⚡ Flash Sale", description: "Up to 40% off on selected electronics. Limited stock!", badge_text: "⚡ Flash Sale", image_url: bannerDeals, link_url: "/daily-deals", gradient_from: "destructive" },
];

const gradientMap: Record<string, string> = {
  primary: "from-primary/85 to-primary/30",
  destructive: "from-destructive/80 to-destructive/20",
  secondary: "from-secondary/80 to-secondary/20",
  accent: "from-accent/80 to-accent/20",
};

const PromoBanners = () => {
  const [current, setCurrent] = useState(0);
  const [[direction, sliding], setSliding] = useState([0, false]);

  const { data: dbBanners } = useQuery({
    queryKey: ["active-promo-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_banners" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
    staleTime: 60000,
  });

  const banners = dbBanners && dbBanners.length > 0 ? dbBanners : fallbackBanners;

  const paginate = useCallback((dir: number) => {
    setSliding([dir, true]);
    setCurrent((c) => (c + dir + banners.length) % banners.length);
  }, [banners.length]);

  // Auto-slide every 6s
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => paginate(1), 6000);
    return () => clearInterval(timer);
  }, [paginate, banners.length]);

  useEffect(() => {
    if (current >= banners.length) setCurrent(0);
  }, [banners.length, current]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  const banner = banners[current];
  if (!banner) return null;

  const gradient = gradientMap[banner.gradient_from] || gradientMap.primary;

  return (
    <section className="relative overflow-hidden rounded-2xl">
      <div className="relative h-[220px] sm:h-[280px] lg:h-[320px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={banner.id || current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0 rounded-2xl overflow-hidden"
          >
            {/* Background */}
            {banner.image_url ? (
              <img src={banner.image_url} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-muted to-background" />
            )}
            <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />

            {/* Content with stagger animations */}
            <div className="relative h-full flex flex-col justify-center px-8 sm:px-12 lg:px-16">
              {banner.badge_text && (
                <motion.span
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className={`inline-block w-fit text-xs font-semibold uppercase tracking-wider mb-2 px-3 py-1 rounded-full backdrop-blur-sm ${
                    banner.gradient_from === "destructive"
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-secondary/20 text-secondary-foreground border border-secondary/30"
                  }`}
                >
                  {banner.badge_text}
                </motion.span>
              )}

              <motion.h3
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
                className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display text-primary-foreground mb-2 drop-shadow-lg"
              >
                {banner.title}
              </motion.h3>

              {banner.description && (
                <motion.p
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="text-primary-foreground/75 text-sm sm:text-base mb-5 max-w-sm"
                >
                  {banner.description}
                </motion.p>
              )}

              {banner.link_url && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65, duration: 0.4 }}
                >
                  <Button
                    asChild
                    variant={banner.gradient_from === "destructive" ? "deal" : "hero"}
                    size="sm"
                    className="w-fit shadow-xl"
                  >
                    <Link to={banner.link_url}>Shop Now</Link>
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/20 backdrop-blur-md text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/20 backdrop-blur-md text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Progress dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => { setSliding([i > current ? 1 : -1, true]); setCurrent(i); }}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === current ? "bg-secondary w-7" : "bg-primary-foreground/40 w-2 hover:bg-primary-foreground/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default PromoBanners;
