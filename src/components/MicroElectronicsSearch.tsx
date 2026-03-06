import { useState, useMemo } from "react";
import { Search, X, FileText, Zap, ChevronRight, Cpu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

// Component type categories for Micro Electronics
const COMPONENT_TYPES = [
  { id: "all", label: "All Components", icon: "⚡" },
  { id: "resistor", label: "Resistors", icon: "Ω" },
  { id: "capacitor", label: "Capacitors", icon: "C" },
  { id: "ic", label: "ICs / MCUs", icon: "⬛" },
  { id: "transistor", label: "Transistors", icon: "▲" },
  { id: "diode", label: "Diodes", icon: "→" },
  { id: "inductor", label: "Inductors", icon: "∿" },
  { id: "connector", label: "Connectors", icon: "⟂" },
  { id: "relay", label: "Relays", icon: "⊙" },
  { id: "switch", label: "Switches", icon: "⊢" },
  { id: "sensor", label: "Sensors", icon: "◎" },
  { id: "crystal", label: "Crystals", icon: "◇" },
];

// Which keywords in name/description map to each type
const TYPE_KEYWORDS: Record<string, string[]> = {
  resistor: ["resistor", "resistance", "kohm", "mohm", "ohm", "0402", "0603", "0805", "1206", "4.7k", "10k", "100k"],
  capacitor: ["capacitor", "capacitance", "farad", "pf", "nf", "uf", "electrolytic", "ceramic", "tantalum"],
  ic: ["ic", "mcu", "microcontroller", "op-amp", "opamp", "amplifier", "regulator", "driver", "lm", "ne55", "atmel", "stm", "pic", "esp", "attiny", "atmega"],
  transistor: ["transistor", "npn", "pnp", "mosfet", "bjt", "2n", "bc", "2sc", "irf"],
  diode: ["diode", "zener", "rectifier", "schottky", "led", "1n4001", "1n4148"],
  inductor: ["inductor", "inductance", "coil", "henry", "mh", "uh"],
  connector: ["connector", "header", "pin", "socket", "terminal", "jst", "dupont", "molex"],
  relay: ["relay"],
  switch: ["switch", "button", "tact", "push"],
  sensor: ["sensor", "thermistor", "ntc", "ptc", "hall", "current sense"],
  crystal: ["crystal", "oscillator", "resonator", "mhz", "khz"],
};

const matchesType = (product: any, typeId: string): boolean => {
  if (typeId === "all") return true;
  const keywords = TYPE_KEYWORDS[typeId] || [];
  const text = `${product.name} ${product.description || ""} ${product.sku || ""}`.toLowerCase();
  return keywords.some((kw) => text.includes(kw));
};

interface Props {
  products: any[];
  onFilteredChange: (ids: Set<string> | null) => void;
}

const MicroElectronicsSearch = ({ products, onFilteredChange }: Props) => {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [query, setQuery] = useState("");

  // Count products per type
  const typeCounts = useMemo(() => {
    if (!products) return {};
    const counts: Record<string, number> = {};
    COMPONENT_TYPES.forEach((t) => {
      counts[t.id] = products.filter((p) => matchesType(p, t.id)).length;
    });
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const q = query.trim().toLowerCase();
    const isDefaultState = selectedType === "all" && q.length === 0;
    if (isDefaultState) return null;

    const result = new Set<string>();
    products.forEach((p) => {
      // Type filter
      if (!matchesType(p, selectedType)) return;
      // Text search: MPN (sku), name, value in specs
      if (q.length > 0) {
        const specs = p.specifications as Record<string, string> | null;
        const text = `${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase();
        let matchesQuery = text.includes(q);
        if (!matchesQuery && specs) {
          matchesQuery = Object.values(specs).some((v) => String(v).toLowerCase().includes(q));
        }
        if (!matchesQuery) return;
      }
      result.add(p.id);
    });
    return result;
  }, [products, selectedType, query]);

  useMemo(() => {
    onFilteredChange(filtered);
  }, [filtered]);

  const clear = () => {
    setQuery("");
    setSelectedType("all");
  };

  const hasActive = selectedType !== "all" || query.length > 0;

  const searchPlaceholder = selectedType === "all"
    ? "Search MPN, part number, or value…  e.g. C93216, 10kΩ, BC547"
    : `Search in ${COMPONENT_TYPES.find(t => t.id === selectedType)?.label}…  e.g. MPN, value, package`;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Cpu className="w-4 h-4 text-secondary" />
        <span className="text-sm font-semibold text-foreground">Component Finder</span>
        <span className="text-xs text-muted-foreground ml-1">— choose a type, then search by MPN or value</span>
        {hasActive && (
          <button onClick={clear} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Component type selector */}
      <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-border">
        {COMPONENT_TYPES.map((type) => {
          const count = typeCounts[type.id] || 0;
          if (type.id !== "all" && count === 0) return null;
          const isActive = selectedType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isActive
                  ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-secondary/40 hover:text-foreground"
              }`}
            >
              <span className="text-[11px]">{type.icon}</span>
              {type.label}
              <span className={`text-[10px] px-1 rounded ${isActive ? "bg-secondary-foreground/20 text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-10 h-10 text-sm bg-muted/30 border-border"
          />
          <AnimatePresence>
            {query.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Result feedback */}
        <AnimatePresence>
          {filtered !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Zap className="w-3 h-3 text-secondary" />
              {filtered.size === 0 ? (
                <>
                  <span>No components match.</span>
                  <button onClick={clear} className="text-secondary hover:underline">Clear search</button>
                </>
              ) : (
                <span>
                  <span className="text-foreground font-semibold">{filtered.size}</span> component{filtered.size !== 1 ? "s" : ""} found
                  {selectedType !== "all" && (
                    <> in <span className="text-secondary font-medium">{COMPONENT_TYPES.find(t => t.id === selectedType)?.label}</span></>
                  )}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MicroElectronicsSearch;
