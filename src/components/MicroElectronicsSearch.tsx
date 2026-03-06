import { useState, useMemo } from "react";
import { Search, Cpu, X, FileText, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const PACKAGE_FILTERS = ["SMD", "THT", "SOT-23", "SOT-223", "TO-92", "TO-220", "DIP", "SOP", "QFP", "BGA", "0402", "0603", "0805", "1206"];

interface Props {
  products: any[];
  onFilteredChange: (ids: Set<string> | null) => void;
}

const MicroElectronicsSearch = ({ products, onFilteredChange }: Props) => {
  const [query, setQuery] = useState("");
  const [activePackage, setActivePackage] = useState<string | null>(null);

  // Derive which package chips are actually present in the products
  const availablePackages = useMemo(() => {
    if (!products) return [];
    const pkgs = new Set<string>();
    products.forEach((p) => {
      const specs = p.specifications as Record<string, string> | null;
      if (!specs) return;
      // Check common keys for package info
      const pkg =
        specs["Package"] || specs["package"] ||
        specs["Package Type"] || specs["package_type"] ||
        specs["Case/Package"] || "";
      if (pkg) {
        // Try to match against known packages
        for (const known of PACKAGE_FILTERS) {
          if (pkg.toUpperCase().includes(known.toUpperCase())) {
            pkgs.add(known);
          }
        }
      }
    });
    return PACKAGE_FILTERS.filter((p) => pkgs.has(p));
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const q = query.trim().toLowerCase();
    const hasQuery = q.length >= 1;
    const hasPkg = !!activePackage;
    if (!hasQuery && !hasPkg) return null;

    const result = new Set<string>();
    products.forEach((p) => {
      const specs = p.specifications as Record<string, string> | null;

      // Text search: name, sku, description, spec values
      let matchesQuery = !hasQuery;
      if (hasQuery) {
        if (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
        ) {
          matchesQuery = true;
        }
        if (!matchesQuery && specs) {
          for (const val of Object.values(specs)) {
            if (String(val).toLowerCase().includes(q)) {
              matchesQuery = true;
              break;
            }
          }
        }
      }

      // Package filter
      let matchesPkg = !hasPkg;
      if (hasPkg && specs) {
        const pkg =
          specs["Package"] || specs["package"] ||
          specs["Package Type"] || specs["package_type"] ||
          specs["Case/Package"] || "";
        matchesPkg = pkg.toUpperCase().includes(activePackage!.toUpperCase());
      }

      if (matchesQuery && matchesPkg) result.add(p.id);
    });
    return result;
  }, [products, query, activePackage]);

  // Propagate filter up
  useMemo(() => {
    onFilteredChange(filtered);
  }, [filtered]);

  const hasActive = query.length > 0 || !!activePackage;

  const clear = () => {
    setQuery("");
    setActivePackage(null);
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by part number, name, value, or spec…  e.g. C93216, 10kΩ, NPN"
          className="pl-9 pr-10 h-10 text-sm bg-card border-border"
        />
        <AnimatePresence>
          {hasActive && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Package quick filters */}
      {availablePackages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-muted-foreground font-medium mr-1 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Package:
          </span>
          {availablePackages.map((pkg) => (
            <button
              key={pkg}
              onClick={() => setActivePackage(activePackage === pkg ? null : pkg)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border ${
                activePackage === pkg
                  ? "bg-secondary/15 text-secondary border-secondary/40"
                  : "bg-muted text-muted-foreground border-transparent hover:border-border hover:text-foreground"
              }`}
            >
              {pkg}
            </button>
          ))}
        </div>
      )}

      {/* Result count when filtering */}
      <AnimatePresence>
        {filtered !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Search className="w-3 h-3" />
            <span>
              {filtered.size === 0
                ? "No components match"
                : `${filtered.size} component${filtered.size !== 1 ? "s" : ""} found`}
            </span>
            {filtered.size === 0 && (
              <button onClick={clear} className="text-secondary hover:underline ml-1">
                Clear search
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MicroElectronicsSearch;
