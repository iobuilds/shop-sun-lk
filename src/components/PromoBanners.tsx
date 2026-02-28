import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import bannerCombo from "@/assets/banner-combo.jpg";
import bannerDeals from "@/assets/banner-deals.jpg";

const fallbackBanners = [
  { id: "f1", title: "Combo Starter Packs", badge_text: "Save up to 25%", description: "Get everything you need in one box. Perfect for beginners.", image_url: bannerCombo, link_url: "/category/combo-packs", gradient_from: "primary" },
  { id: "f2", title: "Daily Deals Live Now", badge_text: "⚡ Flash Sale", description: "Up to 40% off on selected electronics. Limited stock!", image_url: bannerDeals, link_url: "/daily-deals", gradient_from: "destructive" },
];

const fallbackImages = [bannerCombo, bannerDeals];

const gradientMap: Record<string, string> = {
  primary: "from-primary/85 to-primary/30",
  destructive: "from-destructive/80 to-destructive/20",
  secondary: "from-secondary/80 to-secondary/20",
  accent: "from-accent/80 to-accent/20",
};

const PromoBanners = () => {
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

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {banners.map((banner: any, idx: number) => {
        const gradient = gradientMap[banner.gradient_from] || gradientMap.primary;
        const imgSrc = banner.image_url || fallbackImages[idx % fallbackImages.length];

        return (
          <motion.div
            key={banner.id || idx}
            initial={{ opacity: 0, x: idx % 2 === 0 ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative overflow-hidden rounded-xl h-[200px] sm:h-[240px] group cursor-pointer"
          >
            {/* Background image with Ken Burns effect */}
            <motion.img
              src={imgSrc}
              alt={banner.title}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${gradient} transition-opacity duration-500 group-hover:opacity-90`} />

            {/* Content with staggered animations */}
            <div className="relative h-full flex flex-col justify-center px-6 sm:px-8">
              {banner.badge_text && (
                <motion.span
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + idx * 0.15, duration: 0.4 }}
                  className={`inline-block w-fit text-xs font-semibold uppercase tracking-wider mb-1 px-2.5 py-0.5 rounded-full backdrop-blur-sm ${
                    banner.gradient_from === "destructive"
                      ? "bg-accent/20 text-accent border border-accent/30 animate-pulse"
                      : "bg-secondary/20 text-secondary-foreground border border-secondary/30"
                  }`}
                >
                  {banner.badge_text}
                </motion.span>
              )}

              <motion.h3
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 + idx * 0.15, duration: 0.5, ease: "easeOut" }}
                className="text-xl sm:text-2xl font-bold font-display text-primary-foreground mb-2 drop-shadow-lg"
              >
                {banner.title}
              </motion.h3>

              {banner.description && (
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + idx * 0.15, duration: 0.4 }}
                  className="text-primary-foreground/70 text-sm mb-4 max-w-xs"
                >
                  {banner.description}
                </motion.p>
              )}

              {banner.link_url && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.65 + idx * 0.15, duration: 0.4 }}
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
        );
      })}
    </section>
  );
};

export default PromoBanners;
