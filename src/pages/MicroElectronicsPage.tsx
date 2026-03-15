import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ShoppingCart, ChevronDown, Zap, Package,
  FileText, Search, X, AlertCircle, Check, ArrowLeft
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

// Component type display config
const COMPONENT_TYPES = [
  { id: "resistor",    label: "Resistors",      icon: "Ω",   color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { id: "capacitor",   label: "Capacitors",     icon: "C",   color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  { id: "ic",          label: "ICs / MCUs",     icon: "⬛",  color: "bg-gray-500/10 text-gray-600 border-gray-200" },
  { id: "transistor",  label: "Transistors",    icon: "▲",   color: "bg-orange-500/10 text-orange-600 border-orange-200" },
  { id: "diode",       label: "Diodes",         icon: "→",   color: "bg-red-500/10 text-red-600 border-red-200" },
  { id: "inductor",    label: "Inductors",      icon: "∿",   color: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
  { id: "connector",   label: "Connectors",     icon: "⟂",   color: "bg-green-500/10 text-green-600 border-green-200" },
  { id: "relay",       label: "Relays",         icon: "⊙",   color: "bg-teal-500/10 text-teal-600 border-teal-200" },
  { id: "switch",      label: "Switches",       icon: "⊢",   color: "bg-cyan-500/10 text-cyan-600 border-cyan-200" },
  { id: "sensor",      label: "Sensors",        icon: "◎",   color: "bg-indigo-500/10 text-indigo-600 border-indigo-200" },
  { id: "crystal",     label: "Crystals",       icon: "◇",   color: "bg-pink-500/10 text-pink-600 border-pink-200" },
  { id: "led",         label: "LEDs",           icon: "💡",  color: "bg-amber-500/10 text-amber-600 border-amber-200" },
];

const VALUE_LABELS: Record<string, string> = {
  resistor:   "Resistance",
  capacitor:  "Capacitance",
  inductor:   "Inductance",
  led:        "Colour / Size",
  diode:      "Type / Voltage",
  transistor: "Part Number",
  ic:         "Part Number",
  crystal:    "Frequency",
  default:    "Value",
};

const MicroElectronicsPage = () => {
  const { storeName } = useBranding();
  const { addItem } = useCart();

  // Navigation state
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);

  // Variant selector state
  const [mountType, setMountType] = useState<string>("all");
  const [selectedPackage, setSelectedPackage] = useState<string>("all");
  const [valueSearch, setValueSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Cart batch
  const [cartSelections, setCartSelections] = useState<Set<string>>(new Set());

  // ── Queries ──────────────────────────────────────────────────────────────
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

  const { data: allFamilyCounts = {} } = useQuery({
    queryKey: ["component-family-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_families")
        .select("component_type")
        .eq("is_active", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.component_type] = (counts[r.component_type] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["component-variants", selectedFamily?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_variants")
        .select("*")
        .eq("family_id", selectedFamily!.id)
        .eq("is_available", true)
        .order("mount_type")
        .order("value");
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setMountType("all"); setSelectedPackage("all"); setValueSearch("");
  };

  const selectFamily = (family: any) => {
    setSelectedFamily(family);
    resetFilters();
    setCartSelections(new Set());
    setQuantities({});
  };

  const goBack = () => {
    if (selectedFamily) { setSelectedFamily(null); return; }
    setSelectedType(null);
  };

  const getQty = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const toggleSelect = (id: string) => {
    setCartSelections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
    if (cartSelections.size === 0) return;
    let count = 0;
    filteredVariants.filter((v: any) => cartSelections.has(v.id)).forEach((v: any) => {
      addVariantToCart(v);
      count++;
    });
    toast({ title: `${count} item${count !== 1 ? "s" : ""} added to cart` });
    setCartSelections(new Set());
  };

  const typeConfig = COMPONENT_TYPES.find(t => t.id === selectedType);
  const valueLabel = VALUE_LABELS[selectedType || ""] || VALUE_LABELS.default;

  // ── Mount type options derived from actual variants
  const mountTypes = useMemo(() => {
    const s = new Set<string>();
    variants.forEach((v: any) => s.add(v.mount_type));
    return Array.from(s).sort();
  }, [variants]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`Micro Electronics — Components & ICs | ${storeName}`}
        description={`Browse resistors, capacitors, ICs, transistors, sensors and more. Parametric search by value, package, mount type.`}
        canonical={`${window.location.origin}/micro-electronics`}
      />
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8 max-w-6xl">

          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/category/micro-electronics" className="hover:text-secondary transition-colors">Micro Electronics</Link>
            {selectedType && (
              <>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => { setSelectedFamily(null); }} className="hover:text-secondary transition-colors">
                  {typeConfig?.label}
                </button>
              </>
            )}
            {selectedFamily && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">{selectedFamily.name}</span>
              </>
            )}
          </nav>

          {/* ── LEVEL 0: Component Type Grid ─────────────────────────────── */}
          <AnimatePresence mode="wait">
            {!selectedType && (
              <motion.div key="type-grid"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold font-display text-foreground">Micro Electronics</h1>
                  <p className="text-muted-foreground mt-2">Browse by component type. Parametric search by value, package &amp; mount type.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {COMPONENT_TYPES.map((type, i) => {
                    const count = allFamilyCounts[type.id] || 0;
                    return (
                      <motion.button
                        key={type.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setSelectedType(type.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${type.color} group`}
                      >
                        <span className="text-3xl leading-none">{type.icon}</span>
                        <span className="text-xs font-semibold text-center leading-tight">{type.label}</span>
                        {count > 0 && (
                          <span className="text-[10px] opacity-70 font-medium">{count} famil{count !== 1 ? "ies" : "y"}</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── LEVEL 1: Family List for a type ───────────────────────── */}
            {selectedType && !selectedFamily && (
              <motion.div key="family-list"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={goBack} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
                      <span className="text-2xl">{typeConfig?.icon}</span> {typeConfig?.label}
                    </h1>
                    <p className="text-sm text-muted-foreground">Select a family to browse variants</p>
                  </div>
                </div>

                {familiesLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                )}

                {!familiesLoading && families.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No component families added yet.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {families.map((family: any, i: number) => (
                    <motion.button
                      key={family.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => selectFamily(family)}
                      className="text-left p-5 rounded-xl border border-border bg-card hover:border-secondary/40 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-start gap-4">
                        {family.images?.[0] ? (
                          <img src={family.images[0]} alt={family.name}
                            className="w-16 h-16 object-contain rounded-lg bg-muted flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-2xl">
                            {typeConfig?.icon}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-secondary transition-colors truncate">{family.name}</h3>
                          {family.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{family.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <ChevronRight className="w-3.5 h-3.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-xs text-secondary font-medium opacity-0 group-hover:opacity-100 transition-opacity">View variants</span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── LEVEL 2: Variant Finder ─────────────────────────────────── */}
            {selectedFamily && (
              <motion.div key="variant-finder"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-6">
                  <button onClick={goBack} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mt-0.5">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold font-display text-foreground">{selectedFamily.name}</h1>
                      {selectedFamily.datasheet_url && (
                        <a href={selectedFamily.datasheet_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-secondary hover:underline">
                          <FileText className="w-3.5 h-3.5" /> Datasheet
                        </a>
                      )}
                    </div>
                    {selectedFamily.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedFamily.description}</p>
                    )}
                  </div>
                  {/* Family image */}
                  {selectedFamily.images?.[0] && (
                    <img src={selectedFamily.images[0]} alt={selectedFamily.name}
                      className="w-16 h-16 object-contain rounded-lg bg-muted border border-border hidden sm:block" />
                  )}
                </div>

                {/* Parametric Filters */}
                <div className="bg-card rounded-xl border border-border p-4 mb-5">
                  <div className="flex flex-wrap gap-4 items-end">
                    {/* Mount type */}
                    {mountTypes.length > 1 && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mount Type</label>
                        <div className="flex gap-1.5">
                          {["all", ...mountTypes].map(mt => (
                            <button key={mt}
                              onClick={() => { setMountType(mt); setSelectedPackage("all"); }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                mountType === mt
                                  ? "bg-secondary text-secondary-foreground border-secondary"
                                  : "bg-background text-muted-foreground border-border hover:border-secondary/40"
                              }`}
                            >
                              {mt === "all" ? "All" : mt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Package */}
                    {packages.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Package</label>
                        <div className="flex flex-wrap gap-1.5">
                          {["all", ...packages.filter(p => {
                            if (mountType === "all") return true;
                            return variants.some((v: any) => v.package === p && v.mount_type === mountType);
                          })].map(pkg => (
                            <button key={pkg}
                              onClick={() => setSelectedPackage(pkg)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                selectedPackage === pkg
                                  ? "bg-secondary/15 text-secondary border-secondary/40"
                                  : "bg-background text-muted-foreground border-border hover:border-secondary/30"
                              }`}
                            >
                              {pkg === "all" ? "All Packages" : pkg}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Value search */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{valueLabel}</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          value={valueSearch}
                          onChange={e => setValueSearch(e.target.value)}
                          placeholder={`e.g. 10kΩ, 100nF, BC547…`}
                          className="pl-8 h-9 text-sm"
                        />
                        {valueSearch && (
                          <button onClick={() => setValueSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Clear */}
                    {(mountType !== "all" || selectedPackage !== "all" || valueSearch) && (
                      <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pb-0.5">
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Results count + batch add */}
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="w-3.5 h-3.5 text-secondary" />
                    <span><span className="text-foreground font-semibold">{filteredVariants.length}</span> variant{filteredVariants.length !== 1 ? "s" : ""} found</span>
                  </div>
                  {cartSelections.size > 0 && (
                    <Button size="sm" onClick={addAllSelected} className="gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Add {cartSelections.size} selected to cart
                    </Button>
                  )}
                </div>

                {/* Variant Table */}
                {variantsLoading && (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
                  </div>
                )}

                {!variantsLoading && filteredVariants.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No variants match your filters</p>
                    <button onClick={resetFilters} className="mt-2 text-xs text-secondary hover:underline">Clear filters</button>
                  </div>
                )}

                {!variantsLoading && filteredVariants.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden bg-card">
                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-[auto_1fr_140px_120px_80px_110px_130px] gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <div className="w-5"></div>
                      <div>{valueLabel}</div>
                      <div>Package</div>
                      <div>Mount</div>
                      <div>Tolerance</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Qty & Add</div>
                    </div>
                    {filteredVariants.map((variant: any, i: number) => {
                      const isSelected = cartSelections.has(variant.id);
                      const qty = getQty(variant.id);
                      const imgs = variant.images?.length ? variant.images : selectedFamily?.images;
                      return (
                        <motion.div
                          key={variant.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.025 }}
                          className={`grid grid-cols-1 md:grid-cols-[auto_1fr_140px_120px_80px_110px_130px] gap-3 px-4 py-3 items-center border-b border-border last:border-0 transition-colors ${
                            isSelected ? "bg-secondary/5" : "hover:bg-muted/30"
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSelect(variant.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected ? "bg-secondary border-secondary" : "border-border hover:border-secondary/60"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-secondary-foreground" />}
                          </button>

                          {/* Value + image */}
                          <div className="flex items-center gap-3 min-w-0">
                            {imgs?.[0] && (
                              <img src={imgs[0]} alt={variant.value || ""} className="w-8 h-8 object-contain rounded bg-muted flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{variant.value || "—"}</p>
                              {variant.sku && <p className="text-[10px] text-muted-foreground font-mono">{variant.sku}</p>}
                            </div>
                          </div>

                          {/* Package */}
                          <div className="flex items-center gap-1.5">
                            {variant.package ? (
                              <Badge variant="outline" className="text-[11px] font-mono">{variant.package}</Badge>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </div>

                          {/* Mount */}
                          <div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              variant.mount_type === "SMD"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {variant.mount_type}
                            </span>
                          </div>

                          {/* Tolerance */}
                          <div className="text-xs text-muted-foreground">{variant.tolerance || "—"}</div>

                          {/* Price */}
                          <div className="text-right">
                            <span className="font-bold text-foreground">
                              {variant.price > 0 ? `Rs. ${variant.price.toLocaleString()}` : "—"}
                            </span>
                            {variant.stock_quantity <= 5 && variant.stock_quantity > 0 && (
                              <p className="text-[10px] text-warning font-medium">Only {variant.stock_quantity} left</p>
                            )}
                            {variant.stock_quantity === 0 && (
                              <p className="text-[10px] text-destructive font-medium">Out of stock</p>
                            )}
                          </div>

                          {/* Qty + Add */}
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="flex items-center border border-border rounded-md overflow-hidden">
                              <button
                                onClick={() => setQty(variant.id, qty - 1)}
                                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-sm font-bold"
                              >−</button>
                              <input
                                type="number"
                                value={qty}
                                onChange={e => setQty(variant.id, parseInt(e.target.value) || 1)}
                                className="w-9 h-7 text-center text-xs font-semibold bg-background border-x border-border focus:outline-none"
                                min={1}
                              />
                              <button
                                onClick={() => setQty(variant.id, qty + 1)}
                                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-sm font-bold"
                              >+</button>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={variant.stock_quantity === 0}
                              onClick={() => addVariantToCart(variant)}
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              <span className="hidden sm:inline">Add</span>
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Select all hint */}
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
