import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import bannerArduino from "@/assets/banner-arduino.jpg";
import bannerDeals from "@/assets/banner-deals.jpg";
import banner3d from "@/assets/banner-3dprinting.jpg";
import bannerCombo from "@/assets/banner-combo.jpg";

interface BannerSlide {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image: string;
}

const slides: BannerSlide[] = [
  {
    id: 1,
    title: "Arduino Starter Kits",
    subtitle: "Everything you need to start your electronics journey. Sensors, boards, wires & more.",
    cta: "Shop Kits",
    href: "/category/arduino-boards",
    image: bannerArduino,
  },
  {
    id: 2,
    title: "Daily Deals — Up to 40% Off",
    subtitle: "Limited-time offers on sensors, modules, and components. Don't miss out!",
    cta: "View Deals",
    href: "/daily-deals",
    image: bannerDeals,
  },
  {
    id: 3,
    title: "3D Printing Supplies",
    subtitle: "PLA filaments, nozzles, beds & more. Island-wide delivery available.",
    cta: "Explore Now",
    href: "/category/3d-printing",
    image: banner3d,
  },
  {
    id: 4,
    title: "Combo Starter Packs",
    subtitle: "Save big with curated electronics kits. Perfect for beginners and pros alike.",
    cta: "Browse Combos",
    href: "/category/combo-packs",
    image: bannerCombo,
  },
];

const HeroBanner = () => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section className="relative w-full overflow-hidden rounded-2xl">
      <div className="relative h-[280px] sm:h-[400px] lg:h-[480px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[current].id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl overflow-hidden"
          >
            {/* Background image */}
            <img
              src={slides[current].image}
              alt={slides[current].title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/60 to-transparent" />

            <div className="relative h-full flex items-center">
              <div className="container mx-auto px-6 sm:px-12">
                <motion.div
                  initial={{ opacity: 0, y: 30, x: -20 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="max-w-lg"
                >
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-block bg-secondary/20 backdrop-blur-sm text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-secondary/30"
                  >
                    🇱🇰 Sri Lanka's #1 Electronics Store
                  </motion.span>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-primary-foreground mb-4 leading-tight drop-shadow-lg">
                    {slides[current].title}
                  </h1>
                  <p className="text-primary-foreground/80 text-sm sm:text-base lg:text-lg mb-6 leading-relaxed max-w-md">
                    {slides[current].subtitle}
                  </p>
                  <div className="flex gap-3">
                    <Button variant="hero" size="lg" className="shadow-2xl">
                      {slides[current].cta}
                    </Button>
                    <Button variant="heroOutline" size="lg" className="backdrop-blur-sm border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                      Learn More
                    </Button>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 backdrop-blur-md text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 backdrop-blur-md text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2.5 rounded-full transition-all duration-500 ${
              i === current ? "bg-secondary w-8" : "bg-primary-foreground/40 w-2.5 hover:bg-primary-foreground/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroBanner;
