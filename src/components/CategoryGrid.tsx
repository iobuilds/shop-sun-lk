import { motion } from "framer-motion";
import { Cpu, Wifi, Wrench, Box, Printer, Zap, Radio, CircuitBoard } from "lucide-react";

const categories = [
  { name: "Arduino & Boards", icon: Cpu, count: 124, href: "/category/arduino-boards", color: "bg-secondary/10 text-secondary" },
  { name: "Sensors & Modules", icon: Radio, count: 89, href: "/category/sensors-modules", color: "bg-accent/15 text-accent-foreground" },
  { name: "Electronic Components", icon: CircuitBoard, count: 256, href: "/category/components", color: "bg-primary/10 text-primary" },
  { name: "WiFi & IoT", icon: Wifi, count: 67, href: "/category/wifi-iot", color: "bg-secondary/10 text-secondary" },
  { name: "Tools & Equipment", icon: Wrench, count: 43, href: "/category/tools-equipment", color: "bg-accent/15 text-accent-foreground" },
  { name: "3D Printing", icon: Printer, count: 38, href: "/category/3d-printing", color: "bg-primary/10 text-primary" },
  { name: "Combo Packs", icon: Box, count: 22, href: "/category/combo-packs", color: "bg-secondary/10 text-secondary" },
  { name: "Power & Batteries", icon: Zap, count: 51, href: "/category/power-batteries", color: "bg-accent/15 text-accent-foreground" },
];

const CategoryGrid = () => {
  return (
    <section>
      <h2 className="text-2xl font-bold font-display text-foreground mb-6">Shop by Category</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {categories.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <motion.a
              key={cat.name}
              href={cat.href}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-secondary/40 card-elevated text-center group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cat.color} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">{cat.name}</span>
              <span className="text-[10px] text-muted-foreground">{cat.count} items</span>
            </motion.a>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryGrid;
