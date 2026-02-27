import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import bannerCombo from "@/assets/banner-combo.jpg";
import bannerDeals from "@/assets/banner-deals.jpg";

const PromoBanners = () => (
  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-xl h-[200px] sm:h-[240px] group cursor-pointer"
    >
      <img src={bannerCombo} alt="Combo Packs" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/85 to-primary/30" />
      <div className="relative h-full flex flex-col justify-center px-6 sm:px-8">
        <span className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Save up to 25%</span>
        <h3 className="text-xl sm:text-2xl font-bold font-display text-primary-foreground mb-2">Combo Starter Packs</h3>
        <p className="text-primary-foreground/70 text-sm mb-4 max-w-xs">Get everything you need in one box. Perfect for beginners.</p>
        <Button variant="hero" size="sm" className="w-fit">Shop Combos</Button>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-xl h-[200px] sm:h-[240px] group cursor-pointer"
    >
      <img src={bannerDeals} alt="Flash Sale" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-r from-destructive/80 to-destructive/20" />
      <div className="relative h-full flex flex-col justify-center px-6 sm:px-8">
        <span className="text-xs font-semibold text-accent uppercase tracking-wider mb-1 animate-count-pulse">⚡ Flash Sale</span>
        <h3 className="text-xl sm:text-2xl font-bold font-display text-primary-foreground mb-2">Daily Deals Live Now</h3>
        <p className="text-primary-foreground/70 text-sm mb-4 max-w-xs">Up to 40% off on selected electronics. Limited stock!</p>
        <Button variant="deal" size="sm" className="w-fit">View Deals</Button>
      </div>
    </motion.div>
  </section>
);

export default PromoBanners;
