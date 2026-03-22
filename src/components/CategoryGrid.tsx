import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Cpu, Wifi, Wrench, Box, Zap, Radio, CircuitBoard, ChevronRight,
  Lightbulb, ToggleLeft, Gauge, Plug, Layers, Monitor, RefreshCcw,
  Waves, Thermometer, Battery, Component, Microchip, FlaskConical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

// Icon + color per slug
const CATEGORY_META: Record<string, { icon: any; color: string; bg: string }> = {
  "resistors":        { icon: Waves,        color: "text-orange-500",   bg: "bg-orange-500/10" },
  "capacitors":       { icon: Zap,          color: "text-blue-500",     bg: "bg-blue-500/10" },
  "transistors":      { icon: Component,    color: "text-purple-500",   bg: "bg-purple-500/10" },
  "diodes":           { icon: ChevronRight, color: "text-red-500",      bg: "bg-red-500/10" },
  "ics-mcus":         { icon: Cpu,          color: "text-secondary",    bg: "bg-secondary/10" },
  "inductors":        { icon: RefreshCcw,   color: "text-cyan-500",     bg: "bg-cyan-500/10" },
  "sensors":          { icon: Thermometer,  color: "text-green-500",    bg: "bg-green-500/10" },
  "connectors":       { icon: Plug,         color: "text-yellow-500",   bg: "bg-yellow-500/10" },
  "modules":          { icon: Layers,       color: "text-indigo-500",   bg: "bg-indigo-500/10" },
  "dev-boards":       { icon: CircuitBoard, color: "text-teal-500",     bg: "bg-teal-500/10" },
  "displays":         { icon: Monitor,      color: "text-sky-500",      bg: "bg-sky-500/10" },
  "power-supplies":   { icon: Battery,      color: "text-emerald-500",  bg: "bg-emerald-500/10" },
  "switches":         { icon: ToggleLeft,   color: "text-pink-500",     bg: "bg-pink-500/10" },
  "leds":             { icon: Lightbulb,    color: "text-amber-500",    bg: "bg-amber-500/10" },
  "crystals":         { icon: Gauge,        color: "text-violet-500",   bg: "bg-violet-500/10" },
  "relays":           { icon: Radio,        color: "text-rose-500",     bg: "bg-rose-500/10" },
  "tools":            { icon: Wrench,       color: "text-stone-500",    bg: "bg-stone-500/10" },
  "micro-electronics":{ icon: Microchip,    color: "text-secondary",    bg: "bg-secondary/10" },
};

const DEFAULT_META = { icon: Box, color: "text-secondary", bg: "bg-secondary/10" };

const CategoryGrid = () => {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories-grid"],
    queryFn: async () => {
      const [{ data: cats, error }, { data: counts }, { data: microCount }] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("category_id").eq("is_active", true),
        supabase.from("component_families").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      if (error) throw error;

      const countMap: Record<string, number> = {};
      counts?.forEach((p) => {
        if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });

      return (cats || []).map((cat) => ({
        ...cat,
        productCount: cat.slug === "micro-electronics"
          ? (microCount as any) || 0
          : (countMap[cat.id] || 0),
      }));
    },
  });

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">Shop by Category</h2>
            <p className="text-sm text-muted-foreground mt-1">Browse our full electronics range</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-muted" />
              <div className="h-3 bg-muted rounded w-14" />
              <div className="h-2 bg-muted rounded w-10" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Shop by Category</h2>
          <p className="text-sm text-muted-foreground mt-1">Browse our full electronics range</p>
        </div>
        <Link
          to="/category/micro-electronics"
          className="hidden sm:flex items-center gap-1 text-sm text-secondary hover:underline font-medium"
        >
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
        {categories?.map((cat, i) => {
          const meta = CATEGORY_META[cat.slug] || DEFAULT_META;
          const Icon = meta.icon;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
            >
              <Link
                to={`/category/${cat.slug}`}
                className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-secondary/50 hover:shadow-md hover:bg-card transition-all duration-200 text-center"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.bg} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <span className="text-[11px] font-semibold text-foreground leading-tight group-hover:text-secondary transition-colors line-clamp-2">
                  {cat.name}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  cat.productCount > 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/50 text-muted-foreground/60"
                }`}>
                  {cat.productCount > 0 ? `${cat.productCount} items` : "Coming soon"}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryGrid;
