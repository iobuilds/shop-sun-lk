import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

// Fallback static slides in case DB has no banners
import bannerArduino from "@/assets/banner-arduino.jpg";
import bannerDeals from "@/assets/banner-deals.jpg";
import banner3d from "@/assets/banner-3dprinting.jpg";
import bannerCombo from "@/assets/banner-combo.jpg";

const fallbackSlides = [
  { id: "f1", title: "Arduino Starter Kits", subtitle: "Everything you need to start your electronics journey.", link_url: "/category/arduino-boards", image_url: bannerArduino },
  { id: "f2", title: "Daily Deals — Up to 40% Off", subtitle: "Limited-time offers on sensors, modules, and components.", link_url: "/daily-deals", image_url: bannerDeals },
  { id: "f3", title: "3D Printing Supplies", subtitle: "PLA filaments, nozzles, beds & more.", link_url: "/category/3d-printing", image_url: banner3d },
  { id: "f4", title: "Combo Starter Packs", subtitle: "Save big with curated electronics kits.", link_url: "/category/combo-packs", image_url: bannerCombo },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0, scale: 1.04 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0, scale: 0.96 }),
};

const HeroBanner = () => {
  const [current, setCurrent] = useState(0);
  const [[direction], setDirection] = useState([1]);

  const { data: dbBanners } = useQuery({
    queryKey: ["active-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  const slides = dbBanners && dbBanners.length > 0 ? dbBanners : fallbackSlides;

  const paginate = useCallback((dir: number) => {
    setDirection([dir]);
    setCurrent((c) => (c + dir + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (current >= slides.length) setCurrent(0);
  }, [slides.length, current]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => paginate(1), 5000);
    return () => clearInterval(timer);
  }, [paginate, slides.length]);

  const slide = slides[current];
  if (!slide) return null;

  const innerContent = (
    <div className="relative h-full flex items-center">
      <div className="container mx-auto px-6 sm:px-12">
        <div className="max-w-lg">
          {/* Badge - stagger 1 */}
          <motion.span
            key={`badge-${current}`}
            initial={{ opacity: 0, y: 25, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}
            className="inline-block bg-secondary/20 backdrop-blur-sm text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-secondary/30"
          >
            🇱🇰 Sri Lanka's #1 Electronics Store
          </motion.span>

          {/* Title - stagger 2 */}
          <motion.h1
            key={`title-${current}`}
            initial={{ opacity: 0, x: -50, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.4, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-primary-foreground mb-4 leading-tight drop-shadow-lg"
          >
            {slide.title}
          </motion.h1>

          {/* Subtitle - stagger 3 */}
          {slide.subtitle && (
            <motion.p
              key={`sub-${current}`}
              initial={{ opacity: 0, x: -35 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, duration: 0.45, ease: "easeOut" }}
              className="text-primary-foreground/80 text-sm sm:text-base lg:text-lg mb-6 leading-relaxed max-w-md"
            >
              {slide.subtitle}
            </motion.p>
          )}

          {/* Buttons - stagger 4 */}
          <motion.div
            key={`btns-${current}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4, ease: "easeOut" }}
            className="flex gap-3"
          >
            <Button variant="hero" size="lg" className="shadow-2xl">
              Shop Now
            </Button>
            <Button variant="heroOutline" size="lg" className="backdrop-blur-sm border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Learn More
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl">
      <div className="relative h-[220px] sm:h-[380px] lg:h-[460px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={slide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0 rounded-2xl overflow-hidden"
          >
            <motion.img
              src={slide.image_url}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 6, ease: "linear" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/60 to-transparent" />
            {slide.link_url ? (
              <Link to={slide.link_url} className="absolute inset-0">
                {innerContent}
              </Link>
            ) : (
              innerContent
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 backdrop-blur-md text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 backdrop-blur-md text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Progress bar dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => { setDirection([i > current ? 1 : -1]); setCurrent(i); }}
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  i === current ? "bg-secondary w-8" : "bg-primary-foreground/40 w-2.5 hover:bg-primary-foreground/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroBanner;
