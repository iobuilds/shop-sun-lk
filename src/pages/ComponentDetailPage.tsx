import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ShoppingCart, FileText, Search, X,
  AlertCircle, Check, ArrowLeft, Zap, ExternalLink,
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

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  resistor: "Resistors", capacitor: "Capacitors", ic: "ICs / MCUs",
  transistor: "Transistors", diode: "Diodes", inductor: "Inductors",
  connector: "Connectors", led: "LEDs", sensor: "Sensors",
  crystal: "Crystals", relay: "Relays", switch: "Switches",
  module: "Modules", display: "Displays", power: "Power / Voltage Reg.",
  other: "Other",
};

const ComponentDetailPage = () => {
  const { type, familySlug } = useParams<{ type: string; familySlug: string }>();
  const navigate = useNavigate();
  const { storeName } = useBranding();
  const { addItem } = useCart();

  const [mountType, setMountType] = useState<string>("all");
  const [selectedPackage, setSelectedPackage] = useState<string>("all");
  const [valueSearch, setValueSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cartSelections, setCartSelections] = useState<Set<string>>(new Set());
  const [activeImage, setActiveImage] = useState(0);

  // ── Fetch family ──────────────────────────────────────────────────────────
  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ["component-family-slug", familySlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_families")
        .select("*")
        .eq("slug", familySlug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!familySlug,
  });

  // ── Fetch variants ────────────────────────────────────────────────────────
  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["component-variants", family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_variants")
        .select("*")
        .eq("family_id", family!.id)
        .eq("is_available", true)
        .order("mount_type")
        .order("value");
      if (error) throw error;
      return data || [];
    },
    enabled: !!family?.id,
  });

  // ── Derived ───────────────────────────────────────────────────────────────
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

  const resetFilters = () => { setMountType("all"); setSelectedPackage("all"); setValueSearch(""); };
  const getQty = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, qty: number) => setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
  const toggleSelect = (id: string) => {
    setCartSelections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const addVariantToCart = (variant: any) => {
    const qty = getQty(variant.id);
    const imgs = (variant.images?.length ? variant.images : family?.images) || [];
    addItem({
      id: variant.id,
      name: `${family?.name || ""} ${variant.value || ""} ${variant.package || ""}`.trim(),
      price: variant.price,
      image: imgs[0] || "/placeholder.svg",
      slug: family?.slug || variant.id,
    }, qty);
    toast({ title: "Added to cart" });
  };

  const addAllSelected = () => {
    let count = 0;
    filteredVariants.filter((v: any) => cartSelections.has(v.id)).forEach((v: any) => { addVariantToCart(v); count++; });
    if (count > 0) toast({ title: `${count} item${count !== 1 ? "s" : ""} added to cart` });
    setCartSelections(new Set());
  };

  const typeLabel = COMPONENT_TYPE_LABELS[type || ""] || "Components";
  const valueLabel = VALUE_LABELS[type || ""] || VALUE_LABELS.default;
  const displayImages: string[] = family?.images || [];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${family?.name || "Component"} | Micro Electronics | ${storeName}`}
        description={family?.description || `Browse ${family?.name} variants — filter by package, mount type, and value.`}
        canonical={`${window.location.origin}/micro-electronics/${type}/${familySlug}`}
      />
      <Navbar />

      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8 max-w-6xl">

          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/micro-electronics" className="hover:text-secondary transition-colors">Micro Electronics</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/micro-electronics?type=${type}`} className="hover:text-secondary transition-colors">{typeLabel}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{family?.name || familySlug}</span>
          </nav>

          {familyLoading && (
            <div className="space-y-4">
              <div className="h-8 w-64 bg-muted animate-pulse rounded-lg" />
              <div className="h-4 w-96 bg-muted animate-pulse rounded-lg" />
              <div className="h-64 bg-muted animate-pulse rounded-xl" />
            </div>
          )}

          {!familyLoading && family && (
            <div className="space-y-6">

              {/* ── Hero header ───────────────────────────────────────────── */}
              <div className="bg-card rounded-2xl border border-border p-6 flex flex-col md:flex-row gap-6">

                {/* Image gallery */}
                {displayImages.length > 0 && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="w-full md:w-52 h-52 rounded-xl border border-border bg-muted/50 overflow-hidden flex items-center justify-center">
                      <img
                        src={displayImages[activeImage]}
                        alt={family.name}
                        className="w-full h-full object-contain p-3"
                      />
                    </div>
                    {displayImages.length > 1 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {displayImages.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveImage(idx)}
                            className={`w-12 h-12 rounded-lg border-2 overflow-hidden bg-muted transition-all ${
                              activeImage === idx ? "border-secondary shadow-sm" : "border-border hover:border-secondary/40"
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-contain p-1" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-3 mb-2">
                    <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                    {family.datasheet_url && (
                      <a href={family.datasheet_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-secondary hover:underline border border-secondary/30 rounded-md px-2 py-0.5">
                        <FileText className="w-3.5 h-3.5" /> Datasheet
                      </a>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground mb-2">{family.name}</h1>
                  {family.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">{family.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="w-3.5 h-3.5 text-secondary" />
                      <span><span className="text-foreground font-semibold">{variants.length}</span> variant{variants.length !== 1 ? "s" : ""} available</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mountTypes.map(mt => (
                        <Badge key={mt} variant="secondary" className="text-xs">{mt}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Parametric filters ──────────────────────────────────────── */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                <div className="flex flex-wrap gap-5 items-end">
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

                  <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{valueLabel}</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input value={valueSearch} onChange={e => setValueSearch(e.target.value)}
                        placeholder="e.g. 10kΩ, 100nF…" className="pl-8 h-9 text-sm" />
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

              {/* ── Results bar ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
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

              {/* ── Variant table ────────────────────────────────────────────── */}
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
                  {/* Header */}
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
                    const imgs = variant.images?.length ? variant.images : family?.images;
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
                            <p className="text-[10px] text-amber-500 font-medium">Only {variant.stock_quantity} left</p>
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
            </div>
          )}

          {!familyLoading && !family && (
            <div className="text-center py-24 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Component not found</h2>
              <p className="mb-4">This component family doesn't exist or has been removed.</p>
              <Link to="/micro-electronics">
                <Button variant="secondary">Browse all components</Button>
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ComponentDetailPage;
