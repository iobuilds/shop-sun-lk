import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Wrench, Box, Zap, Radio, CircuitBoard, ChevronDown, ChevronRight,
  Lightbulb, ToggleLeft, Gauge, Plug, Layers, Monitor, RefreshCcw,
  Waves, Thermometer, Battery, Component, Microchip, Grid3X3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

const CategoryMegaMenu = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch ALL active categories — no hidden filter applied here
  const { data: categories } = useQuery({
    queryKey: ["mega-menu-all-categories"],
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
    staleTime: 60000,
  });

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Dynamic column count based on category count
  const colCount = categories && categories.length > 12 ? 3 : categories && categories.length > 6 ? 2 : 1;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setOpen(!open)}
        className="px-3 h-10 flex items-center gap-1.5 text-[13px] font-semibold text-foreground hover:text-secondary hover:bg-secondary/5 transition-all duration-150 whitespace-nowrap"
      >
        <Grid3X3 className="w-4 h-4" />
        All Categories
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && categories && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-0 bg-card border border-border rounded-xl shadow-xl z-50 p-4"
            style={{ minWidth: colCount === 3 ? 660 : colCount === 2 ? 440 : 240 }}
          >
            <div className={`grid gap-1 ${colCount === 3 ? "grid-cols-3" : colCount === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat.slug] || DEFAULT_META;
                const Icon = meta.icon;
                return (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.bg} shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-secondary transition-colors truncate">
                        {cat.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {cat.productCount > 0 ? `${cat.productCount} items` : "Coming soon"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-border text-center">
              <span className="text-xs text-muted-foreground">
                {categories.length} categories available
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryMegaMenu;
