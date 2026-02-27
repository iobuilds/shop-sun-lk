import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Cpu, Wifi, Wrench, Box, Printer, Zap, Radio, CircuitBoard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

const iconMap: Record<string, any> = {
  "arduino-boards": Cpu,
  "sensors-modules": Radio,
  "components": CircuitBoard,
  "wifi-iot": Wifi,
  "tools-equipment": Wrench,
  "3d-printing": Printer,
  "combo-packs": Box,
  "power-batteries": Zap,
};

const colorMap: Record<string, string> = {
  "arduino-boards": "bg-secondary/10 text-secondary",
  "sensors-modules": "bg-accent/15 text-accent-foreground",
  "components": "bg-primary/10 text-primary",
  "wifi-iot": "bg-secondary/10 text-secondary",
  "tools-equipment": "bg-accent/15 text-accent-foreground",
  "3d-printing": "bg-primary/10 text-primary",
  "combo-packs": "bg-secondary/10 text-secondary",
  "power-batteries": "bg-accent/15 text-accent-foreground",
};

const CategoryGrid = () => {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;

      // Get product counts per category
      const { data: counts } = await supabase
        .from("products")
        .select("category_id")
        .eq("is_active", true);

      const countMap: Record<string, number> = {};
      counts?.forEach((p) => {
        if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });

      return data.map((cat) => ({ ...cat, productCount: countMap[cat.id] || 0 }));
    },
  });

  if (isLoading) {
    return (
      <section>
        <h2 className="text-2xl font-bold font-display text-foreground mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-muted" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold font-display text-foreground mb-6">Shop by Category</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {categories?.map((cat, i) => {
          const Icon = iconMap[cat.slug] || Box;
          const color = colorMap[cat.slug] || "bg-secondary/10 text-secondary";
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Link
                to={`/category/${cat.slug}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-secondary/40 card-elevated text-center group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-foreground leading-tight">{cat.name}</span>
                <span className="text-[10px] text-muted-foreground">{cat.productCount} items</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryGrid;
