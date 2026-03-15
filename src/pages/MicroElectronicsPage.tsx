import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ShoppingCart, FileText, Search, X,
  AlertCircle, Check, ArrowLeft, Zap, Package2, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useBranding } from "@/hooks/useBranding";
import { toast } from "@/hooks/use-toast";

// ── Component type config ──────────────────────────────────────────────────────
const COMPONENT_TYPES = [
  {
    id: "resistor",
    label: "Resistors",
    description: "Carbon film, metal film, SMD, arrays",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <rect x="4" y="27" width="56" height="10" rx="3" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <rect x="14" y="22" width="36" height="20" rx="4" fill="hsl(var(--secondary)/0.15)" stroke="hsl(var(--secondary))" strokeWidth="2"/>
        <line x1="18" y1="32" x2="46" y2="32" stroke="hsl(var(--secondary))" strokeWidth="1.5" strokeDasharray="3 2"/>
        <rect x="20" y="24" width="4" height="16" rx="1" fill="hsl(220 80% 60%)"/>
        <rect x="28" y="24" width="4" height="16" rx="1" fill="hsl(30 90% 55%)"/>
        <rect x="36" y="24" width="4" height="16" rx="1" fill="hsl(220 80% 60%)"/>
      </svg>
    ),
    accent: "hsl(var(--secondary))",
    bg: "bg-secondary/5 hover:bg-secondary/10 border-secondary/20 hover:border-secondary/40",
    badge: "bg-secondary/15 text-secondary",
  },
  {
    id: "capacitor",
    label: "Capacitors",
    description: "Electrolytic, ceramic, tantalum, film",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <line x1="8" y1="32" x2="24" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <rect x="24" y="14" width="5" height="36" rx="2" fill="hsl(220 70% 55%)"/>
        <rect x="35" y="14" width="5" height="36" rx="2" fill="hsl(220 70% 55%)"/>
        <line x1="40" y1="32" x2="56" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <line x1="33" y1="18" x2="33" y2="25" stroke="hsl(30 90% 55%)" strokeWidth="2"/>
        <line x1="30" y1="21" x2="36" y2="21" stroke="hsl(30 90% 55%)" strokeWidth="2"/>
      </svg>
    ),
    accent: "hsl(220 70% 55%)",
    bg: "bg-blue-500/5 hover:bg-blue-500/10 border-blue-200 hover:border-blue-400",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    id: "ic",
    label: "ICs / MCUs",
    description: "Microcontrollers, op-amps, logic ICs",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <rect x="16" y="16" width="32" height="32" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <rect x="20" y="20" width="24" height="24" rx="2" fill="hsl(220 15% 30%)"/>
        {[0,1,2,3].map(i => (
          <g key={i}>
            <line x1="8" y1={22+i*6} x2="16" y2={22+i*6} stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
            <line x1="48" y1={22+i*6} x2="56" y2={22+i*6} stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
          </g>
        ))}
        <line x1="22" y1="8" x2="22" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <line x1="32" y1="8" x2="32" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <line x1="42" y1="8" x2="42" y2="16" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <line x1="22" y1="48" x2="22" y2="56" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <line x1="32" y1="48" x2="32" y2="56" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <line x1="42" y1="48" x2="42" y2="56" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <circle cx="32" cy="32" r="5" fill="hsl(var(--secondary))" opacity="0.8"/>
      </svg>
    ),
    accent: "hsl(var(--foreground))",
    bg: "bg-slate-500/5 hover:bg-slate-500/10 border-slate-200 hover:border-slate-400",
    badge: "bg-slate-100 text-slate-700",
  },
  {
    id: "transistor",
    label: "Transistors",
    description: "NPN, PNP, MOSFET, BJT",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <circle cx="32" cy="32" r="18" fill="hsl(var(--muted))" stroke="hsl(30 80% 55%)" strokeWidth="2"/>
        <line x1="8" y1="32" x2="20" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="20" y1="18" x2="20" y2="46" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <line x1="20" y1="24" x2="38" y2="16" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="20" y1="40" x2="38" y2="48" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="38" y1="16" x2="38" y2="8" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="38" y1="48" x2="38" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <polygon points="33,44 38,48 33,52" fill="hsl(30 80% 55%)"/>
      </svg>
    ),
    accent: "hsl(30 80% 55%)",
    bg: "bg-orange-500/5 hover:bg-orange-500/10 border-orange-200 hover:border-orange-400",
    badge: "bg-orange-100 text-orange-700",
  },
  {
    id: "diode",
    label: "Diodes",
    description: "Rectifier, Zener, Schottky, TVS",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <line x1="8" y1="32" x2="22" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <line x1="42" y1="32" x2="56" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <polygon points="22,16 22,48 42,32" fill="hsl(0 70% 55%)" stroke="hsl(0 70% 55%)" strokeWidth="1"/>
        <line x1="42" y1="16" x2="42" y2="48" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
      </svg>
    ),
    accent: "hsl(0 70% 55%)",
    bg: "bg-red-500/5 hover:bg-red-500/10 border-red-200 hover:border-red-400",
    badge: "bg-red-100 text-red-700",
  },
  {
    id: "inductor",
    label: "Inductors",
    description: "SMD coil, toroid, power inductor",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <line x1="4" y1="32" x2="12" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <path d="M12 32 Q17 22 22 32 Q27 42 32 32 Q37 22 42 32 Q47 42 52 32" stroke="hsl(45 90% 50%)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <line x1="52" y1="32" x2="60" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
      </svg>
    ),
    accent: "hsl(45 90% 50%)",
    bg: "bg-yellow-500/5 hover:bg-yellow-500/10 border-yellow-200 hover:border-yellow-400",
    badge: "bg-yellow-100 text-yellow-700",
  },
  {
    id: "connector",
    label: "Connectors",
    description: "JST, Dupont, pin headers, terminals",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <rect x="8" y="18" width="22" height="28" rx="3" fill="hsl(var(--muted))" stroke="hsl(140 60% 45%)" strokeWidth="2"/>
        <rect x="34" y="18" width="22" height="28" rx="3" fill="hsl(var(--muted))" stroke="hsl(140 60% 45%)" strokeWidth="2"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <circle cx="19" cy={25+i*7} r="3" fill="hsl(140 60% 45%)"/>
            <circle cx="45" cy={25+i*7} r="3" fill="hsl(var(--background))" stroke="hsl(140 60% 45%)" strokeWidth="1.5"/>
          </g>
        ))}
        <line x1="30" y1="32" x2="34" y2="32" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="2 2"/>
      </svg>
    ),
    accent: "hsl(140 60% 45%)",
    bg: "bg-green-500/5 hover:bg-green-500/10 border-green-200 hover:border-green-400",
    badge: "bg-green-100 text-green-700",
  },
  {
    id: "led",
    label: "LEDs",
    description: "Through-hole, SMD, RGB, IR",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <line x1="12" y1="44" x2="12" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="26" y1="44" x2="26" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <polygon points="8,44 30,44 30,26 8,26" rx="2" fill="hsl(50 100% 50%)" stroke="hsl(50 100% 40%)" strokeWidth="1.5"/>
        <path d="M19 20 L19 8" stroke="hsl(50 100% 50%)" strokeWidth="1.5"/>
        <path d="M30 15 L38 8" stroke="hsl(50 100% 50%)" strokeWidth="1.5"/>
        <path d="M30 22 L40 18" stroke="hsl(50 100% 50%)" strokeWidth="1.5"/>
        <path d="M8 26 Q19 12 30 26" fill="hsl(50 100% 70%)" opacity="0.4"/>
      </svg>
    ),
    accent: "hsl(50 100% 50%)",
    bg: "bg-amber-500/5 hover:bg-amber-500/10 border-amber-200 hover:border-amber-400",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    id: "sensor",
    label: "Sensors",
    description: "Temperature, Hall effect, current",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <circle cx="32" cy="32" r="16" fill="hsl(var(--muted))" stroke="hsl(260 60% 55%)" strokeWidth="2"/>
        <circle cx="32" cy="32" r="8" fill="hsl(260 60% 55%)" opacity="0.3"/>
        <circle cx="32" cy="32" r="3" fill="hsl(260 60% 55%)"/>
        {[0,60,120,180,240,300].map((deg,i) => (
          <line key={i} x1={32+Math.cos(deg*Math.PI/180)*10} y1={32+Math.sin(deg*Math.PI/180)*10}
            x2={32+Math.cos(deg*Math.PI/180)*14} y2={32+Math.sin(deg*Math.PI/180)*14}
            stroke="hsl(260 60% 55%)" strokeWidth="1.5"/>
        ))}
        <line x1="32" y1="48" x2="32" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="26" y1="52" x2="26" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="38" y1="52" x2="38" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
      </svg>
    ),
    accent: "hsl(260 60% 55%)",
    bg: "bg-purple-500/5 hover:bg-purple-500/10 border-purple-200 hover:border-purple-400",
    badge: "bg-purple-100 text-purple-700",
  },
  {
    id: "crystal",
    label: "Crystals",
    description: "Quartz crystals, oscillators, resonators",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <line x1="8" y1="32" x2="18" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="46" y1="32" x2="56" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <rect x="18" y="18" width="28" height="28" rx="4" fill="hsl(var(--muted))" stroke="hsl(195 70% 50%)" strokeWidth="2"/>
        <line x1="26" y1="18" x2="26" y2="46" stroke="hsl(195 70% 50%)" strokeWidth="1.5"/>
        <line x1="38" y1="18" x2="38" y2="46" stroke="hsl(195 70% 50%)" strokeWidth="1.5"/>
        <text x="32" y="36" textAnchor="middle" fontSize="9" fill="hsl(195 70% 50%)" fontWeight="600">MHz</text>
      </svg>
    ),
    accent: "hsl(195 70% 50%)",
    bg: "bg-cyan-500/5 hover:bg-cyan-500/10 border-cyan-200 hover:border-cyan-400",
    badge: "bg-cyan-100 text-cyan-700",
  },
  {
    id: "relay",
    label: "Relays",
    description: "SPDT, DPDT, solid state",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <rect x="10" y="14" width="44" height="36" rx="4" fill="hsl(var(--muted))" stroke="hsl(160 55% 45%)" strokeWidth="2"/>
        <rect x="16" y="22" width="14" height="8" rx="2" fill="hsl(160 55% 45%)" opacity="0.5"/>
        <line x1="30" y1="34" x2="48" y2="28" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="48" cy="26" r="3" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <circle cx="48" cy="36" r="3" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5"/>
        <line x1="24" y1="8" x2="24" y2="14" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="30" y1="8" x2="30" y2="14" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="24" y1="50" x2="24" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="48" y1="50" x2="48" y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
      </svg>
    ),
    accent: "hsl(160 55% 45%)",
    bg: "bg-teal-500/5 hover:bg-teal-500/10 border-teal-200 hover:border-teal-400",
    badge: "bg-teal-100 text-teal-700",
  },
  {
    id: "switch",
    label: "Switches",
    description: "Tact, toggle, push buttons",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <line x1="8" y1="32" x2="22" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <line x1="42" y1="32" x2="56" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2.5"/>
        <circle cx="22" cy="32" r="4" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <circle cx="42" cy="32" r="4" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        <line x1="26" y1="32" x2="38" y2="22" stroke="hsl(var(--secondary))" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    accent: "hsl(var(--secondary))",
    bg: "bg-sky-500/5 hover:bg-sky-500/10 border-sky-200 hover:border-sky-400",
    badge: "bg-sky-100 text-sky-700",
  },
];

const VALUE_LABELS: Record<string, string> = {
  resistor: "Resistance",
  capacitor: "Capacitance",
  inductor: "Inductance",
  led: "Colour / Size",
  diode: "Type / Voltage",
  transistor: "Part Number",
  ic: "Part Number",
  crystal: "Frequency",
  default: "Value",
};

const MicroElectronicsPage = () => {
  const { storeName } = useBranding();
  const { addItem } = useCart();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);
  const [mountType, setMountType] = useState<string>("all");
  const [selectedPackage, setSelectedPackage] = useState<string>("all");
  const [valueSearch, setValueSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cartSelections, setCartSelections] = useState<Set<string>>(new Set());
  const [globalSearch, setGlobalSearch] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: allFamilyCounts = {} } = useQuery({
    queryKey: ["component-family-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_families").select("component_type").eq("is_active", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.component_type] = (counts[r.component_type] || 0) + 1; });
      return counts;
    },
  });

  const { data: families = [], isLoading: familiesLoading } = useQuery({
    queryKey: ["component-families", selectedType],
    queryFn: async () => {
      let q = supabase.from("component_families").select("*").eq("is_active", true).order("sort_order");
      if (selectedType) q = q.eq("component_type", selectedType);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedType,
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["component-variants", selectedFamily?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_variants").select("*")
        .eq("family_id", selectedFamily!.id)
        .eq("is_available", true)
        .order("mount_type").order("value");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedFamily?.id,
  });

  // ── Derived ──────────────────────────────────────────────────────────────
  const packages = useMemo(() => {
    const pkgs = new Set<string>();
    variants.forEach((v: any) => { if (v.package) pkgs.add(v.package); });
    return Array.from(pkgs).sort();
  }, [variants]);

  const mountTypes = useMemo(() => {
    const s = new Set<string>();
    variants.forEach((v: any) => s.add(v.mount_type));
    return Array.from(s).sort();
  }, [variants]);

  const filteredVariants = useMemo(() => {
    return variants.filter((v: any) => {
      if (mountType !== "all" && v.mount_type !== mountType) return false;
      if (selectedPackage !== "all" && v.package !== selectedPackage) return false;
      if (valueSearch.trim()) {
        const q = valueSearch.toLowerCase();
        const text = `${v.value || ""} ${v.sku || ""} ${v.package || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [variants, mountType, selectedPackage, valueSearch]);

  // Global search: filter component types by label/description
  const globalQ = globalSearch.trim().toLowerCase();
  const filteredTypes = useMemo(() => {
    if (!globalQ) return COMPONENT_TYPES;
    return COMPONENT_TYPES.filter(t =>
      t.label.toLowerCase().includes(globalQ) || t.description.toLowerCase().includes(globalQ)
    );
  }, [globalQ]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetFilters = () => { setMountType("all"); setSelectedPackage("all"); setValueSearch(""); };

  const selectFamily = (family: any) => {
    setSelectedFamily(family); resetFilters();
    setCartSelections(new Set()); setQuantities({});
  };

  const goBack = () => {
    if (selectedFamily) { setSelectedFamily(null); return; }
    setSelectedType(null);
  };

  const getQty = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, qty: number) => setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));

  const toggleSelect = (id: string) => {
    setCartSelections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const addVariantToCart = (variant: any) => {
    const qty = getQty(variant.id);
    const images = (variant.images?.length ? variant.images : selectedFamily?.images) || [];
    addItem({
      id: variant.id,
      name: `${selectedFamily?.name || ""} ${variant.value || ""} ${variant.package || ""}`.trim(),
      price: variant.price,
      image: images[0] || "/placeholder.svg",
      slug: selectedFamily?.slug || variant.id,
    }, qty);
  };

  const addAllSelected = () => {
    let count = 0;
    filteredVariants.filter((v: any) => cartSelections.has(v.id)).forEach((v: any) => { addVariantToCart(v); count++; });
    if (count > 0) toast({ title: `${count} item${count !== 1 ? "s" : ""} added to cart` });
    setCartSelections(new Set());
  };

  const typeConfig = COMPONENT_TYPES.find(t => t.id === selectedType);
  const valueLabel = VALUE_LABELS[selectedType || ""] || VALUE_LABELS.default;
  const totalFamilies = Object.values(allFamilyCounts as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`Micro Electronics — Components & ICs | ${storeName}`}
        description="Browse resistors, capacitors, ICs, transistors, sensors and more. Parametric search by value, package & mount type."
        canonical={`${window.location.origin}/micro-electronics`}
      />
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8 max-w-6xl">

          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => { setSelectedType(null); setSelectedFamily(null); }}
              className="hover:text-secondary transition-colors">Micro Electronics</button>
            {selectedType && (
              <>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => setSelectedFamily(null)} className="hover:text-secondary transition-colors">
                  {typeConfig?.label}
                </button>
              </>
            )}
            {selectedFamily && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{selectedFamily.name}</span>
              </>
            )}
          </nav>

          <AnimatePresence mode="wait">

            {/* ── LEVEL 0 : Category Grid ──────────────────────────────────── */}
            {!selectedType && (
              <motion.div key="type-grid"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Page header */}
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold font-display text-foreground">
                      Parts by <span className="text-secondary">Category</span>
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      {totalFamilies > 0
                        ? `${totalFamilies} component famil${totalFamilies !== 1 ? "ies" : "y"} across ${COMPONENT_TYPES.filter(t => (allFamilyCounts as any)[t.id] > 0).length} types`
                        : "Parametric search by value, package & mount type"}
                    </p>
                  </div>
                </div>

                {/* Global search bar */}
                <div className="relative mb-7">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                    placeholder="Search component types… e.g. Resistor, IC, MOSFET, LED"
                    className="w-full h-12 pl-11 pr-10 rounded-xl border-2 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-secondary transition-colors"
                  />
                  {globalSearch && (
                    <button onClick={() => setGlobalSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Category tiles grid */}
                {filteredTypes.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No categories match "<span className="text-foreground">{globalSearch}</span>"</p>
                    <button onClick={() => setGlobalSearch("")} className="mt-2 text-xs text-secondary hover:underline">Clear search</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredTypes.map((type, i) => {
                      const count = (allFamilyCounts as any)[type.id] || 0;
                      return (
                        <motion.button
                          key={type.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => setSelectedType(type.id)}
                          className={`relative group text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${type.bg}`}
                        >
                          {count > 0 && (
                            <span className={`absolute top-3 right-3 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${type.badge}`}>
                              {count}
                            </span>
                          )}
                          <div className="mb-3 flex items-center justify-center w-14 h-14">
                            {type.icon}
                          </div>
                          <p className="font-bold text-foreground text-sm leading-tight">{type.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{type.description}</p>
                          <ChevronRight className="absolute bottom-4 right-4 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── LEVEL 1 : Family List ────────────────────────────────────── */}
            {selectedType && !selectedFamily && (
              <motion.div key="family-list"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={goBack}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold font-display text-foreground">{typeConfig?.label}</h1>
                    <p className="text-sm text-muted-foreground">Select a component family to browse variants</p>
                  </div>
                </div>

                {familiesLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
                  </div>
                )}

                {!familiesLoading && families.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
                    <Package2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No component families added yet</p>
                    <p className="text-sm mt-1">Check back soon or browse another category.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {families.map((family: any, i: number) => {
                    const detailUrl = `/micro-electronics/${family.component_type}/${family.slug}`;
                    return (
                      <motion.div
                        key={family.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative text-left p-5 rounded-xl border-2 border-border bg-card hover:border-secondary/50 hover:shadow-md transition-all duration-200 group cursor-pointer"
                        onClick={() => window.open(detailUrl, "_blank", "noopener,noreferrer")}
                      >
                        <div className="flex items-start gap-4">
                          {family.images?.[0] ? (
                            <img src={family.images[0]} alt={family.name}
                              className="w-16 h-16 object-contain rounded-lg bg-muted/50 flex-shrink-0 border border-border" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                              <div className="opacity-40 scale-75">{typeConfig?.icon}</div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground group-hover:text-secondary transition-colors leading-tight pr-7">{family.name}</h3>
                            {family.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{family.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-secondary font-semibold">View variants</span>
                              <ExternalLink className="w-3 h-3 text-secondary" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── LEVEL 2 : Variant Finder ─────────────────────────────────── */}
            {selectedFamily && (
              <motion.div key="variant-finder"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-6">
                  <button onClick={goBack}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mt-0.5">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold font-display text-foreground">{selectedFamily.name}</h1>
                      {selectedFamily.datasheet_url && (
                        <a href={selectedFamily.datasheet_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-secondary hover:underline border border-secondary/30 rounded-md px-2 py-1">
                          <FileText className="w-3.5 h-3.5" /> Datasheet
                        </a>
                      )}
                    </div>
                    {selectedFamily.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedFamily.description}</p>
                    )}
                  </div>
                  {selectedFamily.images?.[0] && (
                    <img src={selectedFamily.images[0]} alt={selectedFamily.name}
                      className="w-16 h-16 object-contain rounded-lg bg-muted border border-border hidden sm:block flex-shrink-0" />
                  )}
                </div>

                {/* Parametric Filter Bar */}
                <div className="bg-card rounded-xl border border-border p-4 mb-5 space-y-4">
                  <div className="flex flex-wrap gap-5 items-end">
                    {/* Mount type */}
                    {mountTypes.length > 1 && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mount Type</label>
                        <div className="flex gap-1.5">
                          {["all", ...mountTypes].map(mt => (
                            <button key={mt}
                              onClick={() => { setMountType(mt); setSelectedPackage("all"); }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                mountType === mt
                                  ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                                  : "bg-background text-muted-foreground border-border hover:border-secondary/50 hover:text-foreground"
                              }`}
                            >{mt === "all" ? "All" : mt}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Package */}
                    {packages.length > 0 && (
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Package / Footprint</label>
                        <div className="flex flex-wrap gap-1.5">
                          {["all", ...packages.filter(p =>
                            mountType === "all" || variants.some((v: any) => v.package === p && v.mount_type === mountType)
                          )].map(pkg => (
                            <button key={pkg}
                              onClick={() => setSelectedPackage(pkg)}
                              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-all ${
                                selectedPackage === pkg
                                  ? "bg-secondary/15 text-secondary border-secondary/50"
                                  : "bg-background text-muted-foreground border-border hover:border-secondary/40"
                              }`}
                            >{pkg === "all" ? "All" : pkg}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Value search */}
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{valueLabel}</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input value={valueSearch} onChange={e => setValueSearch(e.target.value)}
                          placeholder={`e.g. 10kΩ, 100nF…`} className="pl-8 h-9 text-sm" />
                        {valueSearch && (
                          <button onClick={() => setValueSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {(mountType !== "all" || selectedPackage !== "all" || valueSearch) && (
                      <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pb-0.5">
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Results bar */}
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="w-3.5 h-3.5 text-secondary" />
                    <span>
                      <span className="text-foreground font-semibold">{filteredVariants.length}</span>
                      {" "}variant{filteredVariants.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {cartSelections.size > 0 && (
                    <Button size="sm" onClick={addAllSelected} className="gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Add {cartSelections.size} selected to cart
                    </Button>
                  )}
                </div>

                {/* Variant table */}
                {variantsLoading && (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
                  </div>
                )}

                {!variantsLoading && filteredVariants.length === 0 && (
                  <div className="text-center py-14 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No variants match your filters</p>
                    <button onClick={resetFilters} className="mt-2 text-xs text-secondary hover:underline">Clear filters</button>
                  </div>
                )}

                {!variantsLoading && filteredVariants.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden bg-card">
                    {/* Header row */}
                    <div className="hidden md:grid grid-cols-[28px_1fr_140px_120px_80px_120px_140px] gap-3 px-4 py-2.5 bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <div />
                      <div>{valueLabel} / SKU</div>
                      <div>Package</div>
                      <div>Mount</div>
                      <div>Tolerance</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Qty &amp; Add</div>
                    </div>

                    {filteredVariants.map((variant: any, i: number) => {
                      const isSelected = cartSelections.has(variant.id);
                      const qty = getQty(variant.id);
                      const imgs = variant.images?.length ? variant.images : selectedFamily?.images;
                      const outOfStock = variant.stock_quantity === 0;
                      return (
                        <motion.div
                          key={variant.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className={`grid grid-cols-1 md:grid-cols-[28px_1fr_140px_120px_80px_120px_140px] gap-3 px-4 py-3 items-center border-b border-border last:border-0 transition-colors ${
                            outOfStock ? "opacity-50" : isSelected ? "bg-secondary/5" : "hover:bg-muted/30"
                          }`}
                        >
                          {/* Checkbox */}
                          <button onClick={() => !outOfStock && toggleSelect(variant.id)} disabled={outOfStock}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected ? "bg-secondary border-secondary" : "border-border hover:border-secondary/60"
                            }`}>
                            {isSelected && <Check className="w-3 h-3 text-secondary-foreground" />}
                          </button>

                          {/* Value + thumbnail */}
                          <div className="flex items-center gap-3 min-w-0">
                            {imgs?.[0] && (
                              <img src={imgs[0]} alt={variant.value || ""} className="w-9 h-9 object-contain rounded-md bg-muted flex-shrink-0 border border-border" />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{variant.value || "—"}</p>
                              {variant.sku && <p className="text-[10px] text-muted-foreground font-mono">{variant.sku}</p>}
                              {variant.wattage && <p className="text-[10px] text-muted-foreground">{variant.wattage}</p>}
                            </div>
                          </div>

                          {/* Package */}
                          <div>
                            {variant.package
                              ? <Badge variant="outline" className="text-[11px] font-mono">{variant.package}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </div>

                          {/* Mount */}
                          <div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              variant.mount_type === "SMD"
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary/10 text-secondary"
                            }`}>{variant.mount_type}</span>
                          </div>

                          {/* Tolerance */}
                          <div className="text-xs text-muted-foreground">{variant.tolerance || "—"}</div>

                          {/* Price */}
                          <div className="text-right">
                            <span className="font-bold text-foreground text-sm">
                              {variant.price > 0 ? `Rs. ${variant.price.toLocaleString()}` : "—"}
                            </span>
                            {variant.stock_quantity <= 5 && variant.stock_quantity > 0 && (
                              <p className="text-[10px] text-warning font-medium">Only {variant.stock_quantity} left</p>
                            )}
                            {outOfStock && <p className="text-[10px] text-destructive font-medium">Out of stock</p>}
                          </div>

                          {/* Qty + Add */}
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="flex items-center border border-border rounded-md overflow-hidden">
                              <button onClick={() => setQty(variant.id, qty - 1)} disabled={outOfStock}
                                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors font-bold text-sm">−</button>
                              <input type="number" value={qty}
                                onChange={e => setQty(variant.id, parseInt(e.target.value) || 1)}
                                disabled={outOfStock}
                                className="w-9 h-7 text-center text-xs font-semibold bg-background border-x border-border focus:outline-none" min={1} />
                              <button onClick={() => setQty(variant.id, qty + 1)} disabled={outOfStock}
                                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors font-bold text-sm">+</button>
                            </div>
                            <Button size="sm" variant="secondary" disabled={outOfStock} onClick={() => addVariantToCart(variant)}
                              className="h-7 px-2.5 text-xs gap-1">
                              <ShoppingCart className="w-3 h-3" />
                              <span className="hidden sm:inline">Add</span>
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {filteredVariants.length > 1 && cartSelections.size === 0 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Tip: tick multiple rows then click <span className="font-semibold text-foreground">Add selected to cart</span>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MicroElectronicsPage;
