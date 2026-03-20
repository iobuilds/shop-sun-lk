import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Search, X, ArrowLeft, Package2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { useBranding } from "@/hooks/useBranding";

// ── Component type config (built-in) ──────────────────────────────────────────
const BUILTIN_COMPONENT_TYPES = [
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
    bg: "bg-sky-500/5 hover:bg-sky-500/10 border-sky-200 hover:border-sky-400",
    badge: "bg-sky-100 text-sky-700",
  },
  {
    id: "module",
    label: "Modules",
    description: "WiFi, BT, LoRa, dev boards",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <rect x="8" y="16" width="48" height="32" rx="4" fill="hsl(var(--muted))" stroke="hsl(330 70% 55%)" strokeWidth="2"/>
        <rect x="14" y="22" width="16" height="12" rx="2" fill="hsl(330 70% 55%)" opacity="0.3"/>
        <rect x="34" y="22" width="16" height="12" rx="2" fill="hsl(330 70% 55%)" opacity="0.15"/>
        {[0,1,2,3].map(i => (
          <line key={i} x1={14+i*12} y1="48" x2={14+i*12} y2="56" stroke="hsl(var(--foreground))" strokeWidth="2"/>
        ))}
      </svg>
    ),
    bg: "bg-pink-500/5 hover:bg-pink-500/10 border-pink-200 hover:border-pink-400",
    badge: "bg-pink-100 text-pink-700",
  },
  {
    id: "power",
    label: "Power ICs",
    description: "Voltage reg, LDO, DCDC",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <polygon points="32,8 40,26 58,26 44,38 50,56 32,44 14,56 20,38 6,26 24,26" fill="hsl(260 60% 55%)" opacity="0.35" stroke="hsl(260 60% 55%)" strokeWidth="1.5"/>
      </svg>
    ),
    bg: "bg-violet-500/5 hover:bg-violet-500/10 border-violet-200 hover:border-violet-400",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    id: "display",
    label: "Displays",
    description: "OLED, LCD, TFT, 7-seg",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <rect x="6" y="12" width="52" height="34" rx="4" fill="hsl(var(--muted))" stroke="hsl(240 60% 55%)" strokeWidth="2"/>
        <rect x="12" y="18" width="40" height="22" rx="2" fill="hsl(240 60% 55%)" opacity="0.2"/>
        <line x1="18" y1="26" x2="46" y2="26" stroke="hsl(240 60% 55%)" strokeWidth="1.5"/>
        <line x1="18" y1="32" x2="38" y2="32" stroke="hsl(240 60% 55%)" strokeWidth="1.5" opacity="0.6"/>
        <line x1="26" y1="46" x2="38" y2="46" stroke="hsl(var(--foreground))" strokeWidth="2"/>
      </svg>
    ),
    bg: "bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-200 hover:border-indigo-400",
    badge: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "other",
    label: "Other",
    description: "Misc components",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
        <circle cx="32" cy="32" r="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <circle cx="32" cy="32" r="8" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <circle cx="16" cy="18" r="4" fill="hsl(var(--muted-foreground))" opacity="0.2"/>
        <circle cx="48" cy="18" r="4" fill="hsl(var(--muted-foreground))" opacity="0.2"/>
        <circle cx="16" cy="46" r="4" fill="hsl(var(--muted-foreground))" opacity="0.2"/>
        <circle cx="48" cy="46" r="4" fill="hsl(var(--muted-foreground))" opacity="0.2"/>
      </svg>
    ),
    bg: "bg-muted hover:bg-muted/80 border-border hover:border-foreground/20",
    badge: "bg-muted text-muted-foreground",
  },
];

// Load custom types created by admin (stored in localStorage)
const loadAdminCustomTypes = (): Array<{ id: string; label: string; shortDesc: string }> => {
  try { return JSON.parse(localStorage.getItem("admin_custom_component_types") || "[]"); }
  catch { return []; }
};

const buildCustomTypeEntry = (ct: { id: string; label: string; shortDesc: string }) => ({
  id: ct.id,
  label: ct.label,
  description: ct.shortDesc || "Custom component type",
  icon: (
    <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      <line x1="32" y1="22" x2="32" y2="42" stroke="hsl(var(--muted-foreground))" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="22" y1="32" x2="42" y2="32" stroke="hsl(var(--muted-foreground))" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  bg: "bg-fuchsia-500/5 hover:bg-fuchsia-500/10 border-fuchsia-200 hover:border-fuchsia-400",
  badge: "bg-fuchsia-100 text-fuchsia-700",
});

const MicroElectronicsPage = () => {
  const { storeName } = useBranding();
  const navigate = useNavigate();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");

  // Merge built-in + custom admin types — re-read localStorage on each render so new types appear
  const builtinIds = new Set(BUILTIN_COMPONENT_TYPES.map(t => t.id));
  const COMPONENT_TYPES = useMemo(() => {
    const customTypes = loadAdminCustomTypes();
    const customMapped = customTypes
      .filter(ct => !builtinIds.has(ct.id))
      .map(buildCustomTypeEntry);
    return [...BUILTIN_COMPONENT_TYPES, ...customMapped];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // All families (for global search)
  const { data: allFamilies = [] } = useQuery({
    queryKey: ["all-component-families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_families").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data || [];
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

  const globalQ = globalSearch.trim().toLowerCase();

  // When there's a global search, filter families across all types
  const searchedFamilies = useMemo(() => {
    if (!globalQ) return [];
    return allFamilies.filter((f: any) =>
      f.name.toLowerCase().includes(globalQ) ||
      (f.description || "").toLowerCase().includes(globalQ) ||
      f.component_type.toLowerCase().includes(globalQ)
    );
  }, [globalQ, allFamilies]);

  // Combine known types with any DB-only types that don't have a built-in/custom entry
  const activeTypesWithData = useMemo(() => {
    const knownIds = new Set(COMPONENT_TYPES.map(t => t.id));
    const dbOnlyTypes = Object.keys(allFamilyCounts as Record<string, number>)
      .filter(id => !knownIds.has(id))
      .map(id => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        description: "Component type",
        icon: (
          <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
            <rect x="10" y="10" width="44" height="44" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
            <circle cx="32" cy="32" r="8" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
          </svg>
        ),
        bg: "bg-muted hover:bg-muted/80 border-border hover:border-foreground/30",
        badge: "bg-muted text-muted-foreground",
      }));
    return [...COMPONENT_TYPES, ...dbOnlyTypes];
  }, [COMPONENT_TYPES, allFamilyCounts]);

  // Filter category types by label/description
  const filteredTypes = useMemo(() => {
    if (!globalQ) return activeTypesWithData;
    return activeTypesWithData.filter(t =>
      t.label.toLowerCase().includes(globalQ) || t.description.toLowerCase().includes(globalQ)
    );
  }, [globalQ, activeTypesWithData]);

  const isSearching = globalQ.length > 0;
  const typeConfig = activeTypesWithData.find(t => t.id === selectedType);
  const totalFamilies = Object.values(allFamilyCounts as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`Micro Electronics — Components & ICs | ${storeName}`}
        description="Browse resistors, capacitors, ICs, transistors, sensors and more. Parametric search by value, package & mount type."
        canonical={`${window.location.origin}/micro-electronics`}
      />
      <Navbar />
      <main className="pt-[120px] md:pt-[152px]">
        <div className="container mx-auto px-4 py-8 max-w-6xl">

          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => { setSelectedType(null); setGlobalSearch(""); }}
              className="hover:text-secondary transition-colors">Micro Electronics</button>
            {selectedType && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{typeConfig?.label}</span>
              </>
            )}
          </nav>

          <AnimatePresence mode="wait">

            {/* ── LEVEL 0 : Category Grid / Global Search ───────────────────── */}
            {!selectedType && (
              <motion.div key="type-grid"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold font-display text-foreground">
                      Parts by <span className="text-secondary">Category</span>
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      {totalFamilies > 0
                        ? `${totalFamilies} component famil${totalFamilies !== 1 ? "ies" : "y"} across ${activeTypesWithData.filter(t => (allFamilyCounts as any)[t.id] > 0).length} types`
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
                    placeholder="Search components… e.g. 10kΩ, NE555, 100nF, BC547"
                    className="w-full h-12 pl-11 pr-10 rounded-xl border-2 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-secondary transition-colors"
                  />
                  {globalSearch && (
                    <button onClick={() => setGlobalSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* ── Search results: show matching families ── */}
                {isSearching ? (
                  <>
                    {searchedFamilies.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                        <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No components match "<span className="text-foreground">{globalSearch}</span>"</p>
                        <button onClick={() => setGlobalSearch("")} className="mt-2 text-xs text-secondary hover:underline">Clear search</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-3">
                          <span className="font-semibold text-foreground">{searchedFamilies.length}</span> result{searchedFamilies.length !== 1 ? "s" : ""} for "{globalSearch}"
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {searchedFamilies.map((family: any, i: number) => {
                            const typeInfo = activeTypesWithData.find(t => t.id === family.component_type);
                            const detailUrl = `/micro-electronics/${family.component_type}/${family.slug}`;
                            return (
                              <motion.div
                                key={family.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="relative text-left p-5 rounded-xl border-2 border-border bg-card hover:border-secondary/50 hover:shadow-md transition-all duration-200 group cursor-pointer"
                                onClick={() => navigate(detailUrl)}
                              >
                                <div className="flex items-start gap-4">
                                  {family.images?.[0] ? (
                                    <img src={family.images[0]} alt={family.name}
                                      className="w-14 h-14 object-contain rounded-lg bg-muted/50 flex-shrink-0 border border-border" />
                                  ) : (
                                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                                      <div className="opacity-40 scale-75">{typeInfo?.icon}</div>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{typeInfo?.label}</p>
                                    <h3 className="font-semibold text-foreground group-hover:text-secondary transition-colors leading-tight">{family.name}</h3>
                                    {family.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{family.description}</p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* ── Category tiles grid ── */
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
            {selectedType && (
              <motion.div key="family-list"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setSelectedType(null)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold font-display text-foreground">{typeConfig?.label}</h1>
                    <p className="text-sm text-muted-foreground">Select a component family to view variants</p>
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
                        onClick={() => navigate(detailUrl)}
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
                            <h3 className="font-semibold text-foreground group-hover:text-secondary transition-colors leading-tight">{family.name}</h3>
                            {family.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{family.description}</p>
                            )}
                            <p className="text-xs text-secondary font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              View variants →
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
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
