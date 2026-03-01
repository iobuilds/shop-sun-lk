import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

// Define which specification keys to extract as filters per category slug pattern
const CATEGORY_SPEC_KEYS: Record<string, string[]> = {
  resistor: ["Resistance", "Tolerance", "Wattage", "Package", "Size", "Type"],
  capacitor: ["Capacitance", "Voltage Rating", "Type", "Package", "Size", "Tolerance"],
  diode: ["Type", "Voltage", "Current Rating", "Package"],
  transistor: ["Type", "Voltage", "Current", "Package"],
  ic: ["IC Type", "Package", "Voltage Range", "Interface"],
  "micro-electronic": ["IC Type", "Package", "Voltage Range", "Interface"],
  connector: ["Type", "Pitch", "Positions"],
  inductor: ["Inductance", "Current Rating", "Package", "Type"],
  sensor: ["Type", "Interface", "Voltage", "Package"],
  relay: ["Type", "Voltage", "Current Rating", "Contact Configuration"],
  switch: ["Type", "Rating", "Configuration"],
  // Fallback for electronics categories
  electronic: ["Type", "Package", "Voltage", "Interface"],
};

// Get relevant spec keys for a category
const getSpecKeysForCategory = (categorySlug: string): string[] => {
  const slug = categorySlug.toLowerCase();
  for (const [pattern, keys] of Object.entries(CATEGORY_SPEC_KEYS)) {
    if (slug.includes(pattern)) return keys;
  }
  return [];
};

// Extract unique values for spec keys from product data
const extractSpecOptions = (
  products: any[],
  specKeys: string[]
): Record<string, string[]> => {
  const options: Record<string, Set<string>> = {};
  specKeys.forEach((key) => (options[key] = new Set()));

  products.forEach((p) => {
    const specs = p.specifications as Record<string, string> | null;
    if (!specs) return;
    specKeys.forEach((key) => {
      // Case-insensitive key matching
      const matchedKey = Object.keys(specs).find(
        (k) => k.toLowerCase() === key.toLowerCase()
      );
      if (matchedKey && specs[matchedKey]) {
        options[key].add(specs[matchedKey]);
      }
    });
  });

  const result: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(options)) {
    if (values.size > 0) {
      result[key] = Array.from(values).sort();
    }
  }
  return result;
};

interface Props {
  categorySlug: string;
  products: any[];
  selectedSpecs: Record<string, string[]>;
  onSpecChange: (key: string, values: string[]) => void;
  onClearAll: () => void;
}

const CategorySpecFilters = ({
  categorySlug,
  products,
  selectedSpecs,
  onSpecChange,
  onClearAll,
}: Props) => {
  const specKeys = useMemo(() => getSpecKeysForCategory(categorySlug), [categorySlug]);
  const specOptions = useMemo(
    () => extractSpecOptions(products, specKeys),
    [products, specKeys]
  );

  const hasSpecFilters = Object.keys(specOptions).length > 0;
  const activeCount = Object.values(selectedSpecs).filter((v) => v.length > 0).length;

  if (!hasSpecFilters) return null;

  const toggleValue = (key: string, value: string) => {
    const current = selectedSpecs[key] || [];
    if (current.includes(value)) {
      onSpecChange(key, current.filter((v) => v !== value));
    } else {
      onSpecChange(key, [...current, value]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">Component Filters</Label>
        {activeCount > 0 && (
          <button onClick={onClearAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      {Object.entries(specOptions).map(([key, values]) => (
        <div key={key}>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">{key}</Label>
          <div className="flex flex-wrap gap-1.5">
            {values.map((val) => {
              const isSelected = (selectedSpecs[key] || []).includes(val);
              return (
                <button
                  key={val}
                  onClick={() => toggleValue(key, val)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "bg-secondary/15 text-secondary border border-secondary/30"
                      : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategorySpecFilters;
export { getSpecKeysForCategory };
