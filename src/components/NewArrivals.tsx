import { motion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingUp, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

const NewArrivals = () => {
  const newProducts = [
    { name: "Raspberry Pi 5", price: 22500, tag: "Just In", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=500&fit=crop" },
    { name: "ESP32-S3 DevKit", price: 3200, tag: "Trending", image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=500&fit=crop" },
    { name: "Oscilloscope Portable", price: 45000, tag: "Pro Pick", image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=500&fit=crop" },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-2xl font-bold font-display text-foreground">New Arrivals</h2>
        </div>
        <Button variant="ghost" size="sm" className="text-secondary gap-1">
          View All <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {newProducts.map((product, i) => (
          <motion.div
            key={product.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            className="group relative overflow-hidden rounded-xl h-[280px] cursor-pointer"
          >
            <img
              src={product.image}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/30 to-transparent" />
            <div className="absolute top-3 left-3">
              <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                {i === 1 ? <TrendingUp className="w-3 h-3" /> : i === 0 ? <Flame className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {product.tag}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-lg font-bold font-display text-primary-foreground mb-1">{product.name}</h3>
              <p className="text-primary-foreground/80 text-sm font-semibold">Rs. {product.price.toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default NewArrivals;
