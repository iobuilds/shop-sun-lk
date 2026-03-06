import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, GripVertical, Eye, EyeOff, ExternalLink, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  visible: boolean;
  external: boolean;
}

interface NavbarConfig {
  announcement_visible: boolean;
  announcement_text: string;
  show_daily_deals: boolean;
  hidden_category_slugs: string[];
  custom_links: CustomLink[];
}

const DEFAULT_CONFIG: NavbarConfig = {
  announcement_visible: true,
  announcement_text: "🇱🇰 Free delivery in Colombo for orders above Rs. 5,000",
  show_daily_deals: true,
  hidden_category_slugs: [],
  custom_links: [
    { id: "3dprint", label: "3D Print", url: "https://3dprint.iobuilds.com", icon: "Printer", visible: true, external: true },
    { id: "pcbdesign", label: "PCB Design", url: "https://pcb.iobuilds.com", icon: "CircuitBoard", visible: true, external: true },
  ],
};

interface Props {
  categories: { id: string; name: string; slug: string }[];
}

const NavbarManager = ({ categories }: Props) => {
  const [config, setConfig] = useState<NavbarConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "navbar_config")
        .single();
      if (data?.value) setConfig(data.value as unknown as NavbarConfig);
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "navbar_config", value: config as any }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Navbar saved", description: "Changes are live immediately." });
    }
  };

  const toggleCategoryHidden = (slug: string) => {
    setConfig((prev) => ({
      ...prev,
      hidden_category_slugs: prev.hidden_category_slugs.includes(slug)
        ? prev.hidden_category_slugs.filter((s) => s !== slug)
        : [...prev.hidden_category_slugs, slug],
    }));
  };

  const addCustomLink = () => {
    setConfig((prev) => ({
      ...prev,
      custom_links: [
        ...prev.custom_links,
        { id: `link_${Date.now()}`, label: "New Link", url: "https://", icon: "Link", visible: true, external: true },
      ],
    }));
  };

  const updateCustomLink = (id: string, field: keyof CustomLink, value: any) => {
    setConfig((prev) => ({
      ...prev,
      custom_links: prev.custom_links.map((l) => l.id === id ? { ...l, [field]: value } : l),
    }));
  };

  const removeCustomLink = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      custom_links: prev.custom_links.filter((l) => l.id !== id),
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 rounded-full border-2 border-secondary border-t-transparent animate-spin" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Navigation className="w-5 h-5 text-secondary" /> Navbar Manager
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Control what appears in the navigation bar</p>
        </div>
        <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Announcement Bar */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-foreground">Announcement Bar</Label>
          <Switch
            checked={config.announcement_visible}
            onCheckedChange={(v) => setConfig((p) => ({ ...p, announcement_visible: v }))}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Text</Label>
          <Input
            value={config.announcement_text}
            onChange={(e) => setConfig((p) => ({ ...p, announcement_text: e.target.value }))}
            placeholder="Free delivery announcement..."
            className="text-sm"
            disabled={!config.announcement_visible}
          />
        </div>
        {config.announcement_visible && (
          <div className="bg-primary rounded-lg px-3 py-1.5 text-xs text-primary-foreground">
            Preview: {config.announcement_text}
          </div>
        )}
      </div>

      {/* Category Visibility */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <Label className="font-semibold text-foreground block">Category Links</Label>
        <p className="text-xs text-muted-foreground -mt-2">Toggle categories shown in the navbar (top 6 visible ones are shown)</p>
        <div className="space-y-2">
          {categories.map((cat) => {
            const isHidden = config.hidden_category_slugs.includes(cat.slug);
            return (
              <div key={cat.slug} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  {isHidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-secondary" />}
                  <span className={`text-sm font-medium ${isHidden ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{cat.slug}</span>
                </div>
                <Switch
                  checked={!isHidden}
                  onCheckedChange={() => toggleCategoryHidden(cat.slug)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Deals Link */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold text-foreground">🔥 Daily Deals Link</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Show the Daily Deals button in the navbar</p>
          </div>
          <Switch
            checked={config.show_daily_deals}
            onCheckedChange={(v) => setConfig((p) => ({ ...p, show_daily_deals: v }))}
          />
        </div>
      </div>

      {/* Custom Links */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold text-foreground">Custom Links</Label>
            <p className="text-xs text-muted-foreground mt-0.5">External service links in the navbar (e.g. 3D Print, PCB Design)</p>
          </div>
          <Button size="sm" variant="outline" onClick={addCustomLink} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Link
          </Button>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {config.custom_links.map((link) => (
              <motion.div
                key={link.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-border rounded-lg p-3 space-y-3 bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{link.label || "Untitled Link"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={link.visible}
                      onCheckedChange={(v) => updateCustomLink(link.id, "visible", v)}
                    />
                    <button
                      onClick={() => removeCustomLink(link.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Label</Label>
                    <Input
                      value={link.label}
                      onChange={(e) => updateCustomLink(link.id, "label", e.target.value)}
                      placeholder="3D Print"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
                    <Input
                      value={link.url}
                      onChange={(e) => updateCustomLink(link.id, "url", e.target.value)}
                      placeholder="https://example.com"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {config.custom_links.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No custom links. Click "Add Link" to add one.</p>
          )}
        </div>
      </div>

      {/* Save button bottom */}
      <div className="flex justify-end pb-8">
        <Button onClick={save} disabled={saving} className="gap-1.5 px-8">
          {saving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Save className="w-4 h-4" />}
          Save Navbar Settings
        </Button>
      </div>
    </div>
  );
};

export default NavbarManager;
