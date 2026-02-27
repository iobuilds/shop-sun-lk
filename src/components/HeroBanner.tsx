import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BannerSlide {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  bg: string;
}

const slides: BannerSlide[] = [
  {
    id: 1,
    title: "Arduino Starter Kits",
    subtitle: "Everything you need to start your electronics journey. Sensors, boards, wires & more.",
    cta: "Shop Kits",
    href: "/category/arduino-boards",
    bg: "from-[hsl(220,60%,18%)] via-[hsl(210,50%,25%)] to-[hsl(200,45%,22%)]",
  },
  {
    id: 2,
    title: "Daily Deals — Up to 40% Off",
    subtitle: "Limited-time offers on sensors, modules, and components. Don't miss out!",
    cta: "View Deals",
    href: "/daily-deals",
    bg: "from-[hsl(175,65%,30%)] via-[hsl(180,50%,25%)] to-[hsl(200,45%,20%)]",
  },
  {
    id: 3,
    title: "3D Printing Supplies",
    subtitle: "PLA filaments, nozzles, beds & more. Island-wide delivery available.",
    cta: "Explore Now",
    href: "/category/3d-printing",
    bg: "from-[hsl(260,45%,22%)] via-[hsl(240,40%,20%)] to-[hsl(220,50%,18%)]",
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
      <div className="relative h-[340px] sm:h-[420px] lg:h-[480px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[current].id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className={`absolute inset-0 bg-gradient-to-br ${slides[current].bg} flex items-center rounded-2xl`}
          >
            <div className="container mx-auto px-6 sm:px-12">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="max-w-lg"
              >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-primary-foreground mb-4 leading-tight">
                  {slides[current].title}
                </h1>
                <p className="text-primary-foreground/75 text-base sm:text-lg mb-6 leading-relaxed">
                  {slides[current].subtitle}
                </p>
                <Button variant="hero" size="lg">
                  {slides[current].cta}
                </Button>
              </motion.div>
            </div>

            {/* Decorative circles */}
            <div className="absolute right-[-60px] top-[-60px] w-[300px] h-[300px] rounded-full bg-secondary/10 blur-3xl" />
            <div className="absolute right-[10%] bottom-[10%] w-[200px] h-[200px] rounded-full bg-accent/10 blur-2xl" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 backdrop-blur-sm text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 backdrop-blur-sm text-primary-foreground hover:bg-card/40 flex items-center justify-center transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i === current ? "bg-secondary w-7" : "bg-primary-foreground/40 hover:bg-primary-foreground/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroBanner;
