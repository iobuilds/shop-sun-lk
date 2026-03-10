import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Save, GripVertical, ChevronUp, ChevronDown, LayoutDashboard,
  Image, Tag, Grid3X3, Star, Package, Layers, Printer, Users, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface HomepageSection {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  // optional per-section config
  config?: Record<string, any>;
}

const SECTION_ICONS: Record<string, any> = {
  hero_banner: Image,
  trust_banner: Star,
  daily_deals: Tag,
  promo_banners: Layers,
  category_grid: Grid3X3,
  featured_products: Star,
  combo_packs: Package,
  service_3d_print: Printer,
  new_arrivals: Package,
  testimonials: Users,
  newsletter: Mail,
};

const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: "hero_banner",        label: "Hero Banner",         visible: true,  order: 0 },
  { id: "trust_banner",       label: "Trust Banner",        visible: true,  order: 1 },
  { id: "daily_deals",        label: "Daily Deals",         visible: true,  order: 2 },
  { id: "promo_banners",      label: "Promo Banners",       visible: true,  order: 3 },
  { id: "category_grid",      label: "Category Grid",       visible: true,  order: 4 },
  { id: "featured_products",  label: "Featured Products",   visible: true,  order: 5 },
  { id: "combo_packs",        label: "Combo Packs",         visible: true,  order: 6 },
  { id: "service_3d_print",   label: "3D Printing CTA",     visible: true,  order: 7 },
  { id: "new_arrivals",       label: "New Arrivals",        visible: true,  order: 8 },
  { id: "testimonials",       label: "Testimonials",        visible: true,  order: 9 },
  { id: "newsletter",         label: "Newsletter",          visible: true,  order: 10 },
];

const SECTION_DESCRIPTIONS: Record<string, string> = {
  hero_banner:       "Main rotating banner at the top",
  trust_banner:      "Trust badges row (Free delivery, warranty etc.)",
  daily_deals:       "Flash deals countdown section",
  promo_banners:     "Promotional category banners",
  category_grid:     "Shop by Category grid",
  featured_products: "Handpicked featured products",
  combo_packs:       "Combo / bundle deals",
  service_3d_print:  "3D Printing service promotion banner",
  new_arrivals:      "Recently added products",
  testimonials:      "Customer review testimonials",
  newsletter:        "Email newsletter signup",
};

const HomepageSectionsManager = () => {
  const [sections, setSections] = useState<HomepageSection[]>(DEFAULT_SECTIONS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_sections")
        .maybeSingle();

      if (data?.value) {
        const saved = data.value as unknown as HomepageSection[];
        // Merge: keep any new defaults that weren't saved yet
        const merged = DEFAULT_SECTIONS.map((def) => {
          const found = saved.find((s) => s.id === def.id);
          return found ? { ...def, ...found } : def;
        });
        // Sort by saved order
        merged.sort((a, b) => a.order - b.order);
        setSections(merged);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "homepage_sections", value: sections as any }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Homepage saved", description: "Changes are live immediately." });
    }
  };

  const toggleVisible = (id: string) => {
    setSections((prev) =>
      prev.map((s) => s.id === id ? { ...s, visible: !s.visible } : s)
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSections((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const moveDown = (index: number) => {
    setSections((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  // Drag-and-drop handlers
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    setSections((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === dragging);
      const toIdx = prev.findIndex((s) => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };
  const handleDragEnd = () => setDragging(null);

  const visibleCount = sections.filter((s) => s.visible).length;

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-secondary" /> Homepage Sections
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drag to reorder • Toggle to show/hide • {visibleCount}/{sections.length} sections visible
          </p>
        </div>
        <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
          {saving
            ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            : <Save className="w-4 h-4" />
          }
          Save Changes
        </Button>
      </div>

      {/* Preview indicator */}
      <div className="flex flex-wrap gap-1.5 bg-muted/40 rounded-xl p-3 border border-border">
        <span className="text-xs text-muted-foreground font-medium self-center mr-1">Live order:</span>
        {sections.filter((s) => s.visible).map((s) => (
          <span key={s.id} className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">
            {s.label}
          </span>
        ))}
        {sections.filter((s) => !s.visible).length > 0 && (
          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            +{sections.filter((s) => !s.visible).length} hidden
          </span>
        )}
      </div>

      {/* Section list */}
      <div className="space-y-2">
        <AnimatePresence>
          {sections.map((section, index) => {
            const Icon = SECTION_ICONS[section.id] || LayoutDashboard;
            const isDraggingThis = dragging === section.id;
            return (
              <motion.div
                key={section.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isDraggingThis ? 0.5 : 1, y: 0 }}
                exit={{ opacity: 0 }}
                draggable
                onDragStart={() => handleDragStart(section.id)}
                onDragOver={(e) => handleDragOver(e, section.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 bg-card border rounded-xl px-4 py-3 transition-all cursor-grab active:cursor-grabbing ${
                  isDraggingThis
                    ? "border-secondary shadow-md"
                    : section.visible
                    ? "border-border hover:border-secondary/40"
                    : "border-border/50 opacity-60"
                }`}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  section.visible ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${section.visible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {section.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {SECTION_DESCRIPTIONS[section.id]}
                  </p>
                </div>

                {/* Order badge */}
                <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
                  #{index + 1}
                </span>

                {/* Up/Down buttons */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === sections.length - 1}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Visibility toggle */}
                <Switch
                  checked={section.visible}
                  onCheckedChange={() => toggleVisible(section.id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <Button onClick={save} disabled={saving} className="gap-1.5 px-8">
          {saving
            ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            : <Save className="w-4 h-4" />
          }
          Save Homepage Layout
        </Button>
      </div>
    </div>
  );
};

export default HomepageSectionsManager;
