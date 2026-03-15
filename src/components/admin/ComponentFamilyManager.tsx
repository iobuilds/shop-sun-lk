import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  Package, X, Upload, Link, ImagePlus, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

// ── Image uploader sub-component ─────────────────────────────────────────────
const ImageUploader = ({
  images,
  onChange,
  placeholder = "Leave blank to use family images",
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  placeholder?: string;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `components/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);
      onChange([...images, urlData.publicUrl]);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    e.target.value = "";
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (trimmed) { onChange([...images, trimmed]); setUrlInput(""); }
  };

  const removeImage = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted">
              <img src={url} alt="" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload + URL row */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 shrink-0"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <div className="flex flex-1 gap-1">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addUrl())}
            placeholder={images.length > 0 ? "Add another URL…" : placeholder}
            className="text-xs h-9"
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors shrink-0"
          >
            <Link className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
};

const COMPONENT_TYPES = [
  { id: "resistor", label: "Resistor" },
  { id: "capacitor", label: "Capacitor" },
  { id: "ic", label: "IC / MCU" },
  { id: "transistor", label: "Transistor" },
  { id: "diode", label: "Diode" },
  { id: "inductor", label: "Inductor" },
  { id: "connector", label: "Connector" },
  { id: "relay", label: "Relay" },
  { id: "switch", label: "Switch" },
  { id: "sensor", label: "Sensor" },
  { id: "crystal", label: "Crystal / Oscillator" },
  { id: "led", label: "LED" },
];

const MOUNT_TYPES = ["SMD", "Through-hole"];

const emptyFamily = () => ({
  name: "", slug: "", component_type: "resistor",
  description: "", images: [] as string[], datasheet_url: "",
  is_active: true, sort_order: 0,
});

const emptyVariant = () => ({
  mount_type: "SMD", value: "", package: "", tolerance: "",
  wattage: "", voltage_rating: "", sku: "", price: 0,
  stock_quantity: 0, is_available: true, images: [] as string[],
});

const ComponentFamilyManager = () => {
  const qc = useQueryClient();
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [editingFamily, setEditingFamily] = useState<any | null>(null);
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState<string | null>(null); // family id
  const [filterType, setFilterType] = useState<string>("all");
  const [familyForm, setFamilyForm] = useState(emptyFamily());
  const [variantForm, setVariantForm] = useState(emptyVariant());

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: families = [], isLoading } = useQuery({
    queryKey: ["admin-component-families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_families")
        .select("*")
        .order("component_type")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allVariants = {} } = useQuery({
    queryKey: ["admin-all-variants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("component_variants").select("*").order("created_at");
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((v: any) => {
        if (!grouped[v.family_id]) grouped[v.family_id] = [];
        grouped[v.family_id].push(v);
      });
      return grouped;
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveFamily = useMutation({
    mutationFn: async (form: any) => {
      if (editingFamily?.id) {
        const { error } = await supabase.from("component_families").update(form).eq("id", editingFamily.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("component_families").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-component-families"] });
      qc.invalidateQueries({ queryKey: ["component-family-counts"] });
      setShowFamilyForm(false); setEditingFamily(null); setFamilyForm(emptyFamily());
      toast({ title: editingFamily ? "Family updated" : "Family created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFamily = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("component_families").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-component-families"] });
      qc.invalidateQueries({ queryKey: ["admin-all-variants"] });
      toast({ title: "Family deleted" });
    },
  });

  const toggleFamilyActive = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("component_families").update({ is_active: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-component-families"] }),
  });

  const saveVariant = useMutation({
    mutationFn: async ({ form, familyId }: { form: any; familyId: string }) => {
      if (editingVariant?.id) {
        const { error } = await supabase.from("component_variants").update(form).eq("id", editingVariant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("component_variants").insert({ ...form, family_id: familyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-variants"] });
      qc.invalidateQueries({ queryKey: ["component-variants"] });
      setShowVariantForm(null); setEditingVariant(null); setVariantForm(emptyVariant());
      toast({ title: editingVariant ? "Variant updated" : "Variant added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("component_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-all-variants"] }); toast({ title: "Variant deleted" }); },
  });

  const toggleVariantAvailable = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("component_variants").update({ is_available: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-variants"] }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openEditFamily = (family: any) => {
    setEditingFamily(family);
    setFamilyForm({ ...family });
    setShowFamilyForm(true);
  };

  const openAddVariant = (familyId: string) => {
    setEditingVariant(null);
    setVariantForm(emptyVariant());
    setShowVariantForm(familyId);
  };

  const openEditVariant = (variant: any) => {
    setEditingVariant(variant);
    setVariantForm({ ...variant });
    setShowVariantForm(variant.family_id);
  };

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const filteredFamilies = filterType === "all" ? families : families.filter((f: any) => f.component_type === filterType);

  const typeLabel = (id: string) => COMPONENT_TYPES.find(t => t.id === id)?.label || id;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {COMPONENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filteredFamilies.length} famil{filteredFamilies.length !== 1 ? "ies" : "y"}</span>
        </div>
        <Button size="sm" onClick={() => { setEditingFamily(null); setFamilyForm(emptyFamily()); setShowFamilyForm(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Family
        </Button>
      </div>

      {/* Family Form Dialog */}
      <AnimatePresence>
        {showFamilyForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-secondary/30 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{editingFamily ? "Edit Family" : "New Component Family"}</h3>
              <button onClick={() => { setShowFamilyForm(false); setEditingFamily(null); }}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block">Name *</Label>
                <Input value={familyForm.name}
                  onChange={e => setFamilyForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                  placeholder="e.g. Resistor (1/4W, Carbon Film)" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Slug *</Label>
                <Input value={familyForm.slug}
                  onChange={e => setFamilyForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="auto-generated" className="font-mono text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Component Type *</Label>
                <Select value={familyForm.component_type} onValueChange={v => setFamilyForm(f => ({ ...f, component_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Sort Order</Label>
                <Input type="number" value={familyForm.sort_order}
                  onChange={e => setFamilyForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs mb-1 block">Description</Label>
                <Input value={familyForm.description}
                  onChange={e => setFamilyForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown on family card" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Datasheet URL</Label>
                <Input value={familyForm.datasheet_url}
                  onChange={e => setFamilyForm(f => ({ ...f, datasheet_url: e.target.value }))}
                  placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs mb-2 block flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> Images</Label>
                <ImageUploader
                  images={familyForm.images || []}
                  onChange={imgs => setFamilyForm(f => ({ ...f, images: imgs }))}
                  placeholder="Paste image URL…"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={familyForm.is_active} onCheckedChange={v => setFamilyForm(f => ({ ...f, is_active: v }))} />
                <Label className="text-xs">Active (visible to customers)</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => { setShowFamilyForm(false); setEditingFamily(null); }}>Cancel</Button>
              <Button size="sm" disabled={saveFamily.isPending || !familyForm.name || !familyForm.slug}
                onClick={() => saveFamily.mutate(familyForm)}>
                {saveFamily.isPending ? "Saving…" : editingFamily ? "Update Family" : "Create Family"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Families List */}
      {isLoading && (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      )}

      {!isLoading && filteredFamilies.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No families yet. Create one above.</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredFamilies.map((family: any) => {
          const variants: any[] = (allVariants as Record<string, any[]>)[family.id] || [];
          const isExpanded = expandedFamily === family.id;
          const availCount = variants.filter(v => v.is_available).length;

          return (
            <div key={family.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Family row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpandedFamily(isExpanded ? null : family.id)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {family.images?.[0] && (
                  <img src={family.images[0]} alt={family.name} className="w-10 h-10 object-contain rounded bg-muted flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{family.name}</p>
                    <Badge variant="outline" className="text-[10px]">{typeLabel(family.component_type)}</Badge>
                    <span className="text-xs text-muted-foreground">{variants.length} variant{variants.length !== 1 ? "s" : ""} · {availCount} available</span>
                  </div>
                  {family.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{family.description}</p>}
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">{family.is_active ? "Active" : "Hidden"}</span>
                  <Switch
                    checked={family.is_active}
                    onCheckedChange={v => toggleFamilyActive.mutate({ id: family.id, val: v })}
                    className="data-[state=checked]:bg-secondary"
                  />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditFamily(family)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete "${family.name}" and all variants?`)) deleteFamily.mutate(family.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Variants section */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border">
                    <div className="p-4 bg-muted/20">

                      {/* Variant Form */}
                      <AnimatePresence>
                        {showVariantForm === family.id && (
                          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            className="bg-card border border-secondary/20 rounded-xl p-4 mb-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-sm text-foreground">{editingVariant ? "Edit Variant" : "Add Variant"}</h4>
                              <button onClick={() => { setShowVariantForm(null); setEditingVariant(null); }}
                                className="p-1 hover:bg-muted rounded-md text-muted-foreground"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs mb-1 block">Value</Label>
                                <Input value={variantForm.value}
                                  onChange={e => setVariantForm(f => ({ ...f, value: e.target.value }))}
                                  placeholder="e.g. 10kΩ, 100nF" />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Mount Type</Label>
                                <Select value={variantForm.mount_type} onValueChange={v => setVariantForm(f => ({ ...f, mount_type: v }))}>
                                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {MOUNT_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Package</Label>
                                <Input value={variantForm.package}
                                  onChange={e => setVariantForm(f => ({ ...f, package: e.target.value }))}
                                  placeholder="0402, 0603, DIP-8…" />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Tolerance</Label>
                                <Input value={variantForm.tolerance}
                                  onChange={e => setVariantForm(f => ({ ...f, tolerance: e.target.value }))}
                                  placeholder="1%, 5%, 10%" />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Wattage / Rating</Label>
                                <Input value={variantForm.wattage}
                                  onChange={e => setVariantForm(f => ({ ...f, wattage: e.target.value }))}
                                  placeholder="1/4W, 1W" />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Voltage Rating</Label>
                                <Input value={variantForm.voltage_rating}
                                  onChange={e => setVariantForm(f => ({ ...f, voltage_rating: e.target.value }))}
                                  placeholder="50V, 100V" />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">SKU / Part No</Label>
                                <Input value={variantForm.sku}
                                  onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))}
                                  placeholder="C93216, RC0402…" className="font-mono text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Price (Rs.)</Label>
                                <Input type="number" value={variantForm.price}
                                  onChange={e => setVariantForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Stock Qty</Label>
                                <Input type="number" value={variantForm.stock_quantity}
                                  onChange={e => setVariantForm(f => ({ ...f, stock_quantity: parseInt(e.target.value) || 0 }))} />
                              </div>
                              <div className="sm:col-span-2">
                                <Label className="text-xs mb-1 block">Image URLs (comma-sep, overrides family)</Label>
                                <Input value={(variantForm.images || []).join(",")}
                                  onChange={e => setVariantForm(f => ({ ...f, images: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                  placeholder="Leave blank to use family images" />
                              </div>
                              <div className="flex items-center gap-2 pt-4">
                                <Switch checked={variantForm.is_available} onCheckedChange={v => setVariantForm(f => ({ ...f, is_available: v }))} />
                                <Label className="text-xs">Available</Label>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                              <Button variant="outline" size="sm" onClick={() => { setShowVariantForm(null); setEditingVariant(null); }}>Cancel</Button>
                              <Button size="sm" disabled={saveVariant.isPending}
                                onClick={() => saveVariant.mutate({ form: variantForm, familyId: family.id })}>
                                {saveVariant.isPending ? "Saving…" : editingVariant ? "Update Variant" : "Add Variant"}
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Variants table */}
                      {variants.length === 0 && showVariantForm !== family.id && (
                        <p className="text-sm text-muted-foreground text-center py-4">No variants yet. Add one below.</p>
                      )}

                      {variants.length > 0 && (
                        <div className="rounded-lg border border-border overflow-hidden mb-3">
                          <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px_80px_80px_100px] text-[11px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50 px-3 py-2 gap-2 border-b border-border">
                            <div>Value / SKU</div><div>Package</div><div>Mount</div><div>Tolerance</div><div>Wattage</div><div>Price</div><div>Stock</div><div className="text-right">Avail / Actions</div>
                          </div>
                          {variants.map((v: any) => (
                            <div key={v.id}
                              className={`grid grid-cols-1 sm:grid-cols-[1fr_100px_80px_80px_80px_80px_80px_100px] gap-2 px-3 py-2.5 border-b border-border last:border-0 items-center text-sm ${!v.is_available ? "opacity-50" : ""}`}>
                              <div>
                                <p className="font-semibold text-foreground">{v.value || "—"}</p>
                                {v.sku && <p className="text-[10px] text-muted-foreground font-mono">{v.sku}</p>}
                              </div>
                              <div className="text-xs font-mono text-muted-foreground">{v.package || "—"}</div>
                              <div>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${v.mount_type === "SMD" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                                  {v.mount_type}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">{v.tolerance || "—"}</div>
                              <div className="text-xs text-muted-foreground">{v.wattage || "—"}</div>
                              <div className="text-xs font-semibold text-foreground">{v.price > 0 ? `Rs.${v.price}` : "—"}</div>
                              <div className="text-xs text-muted-foreground">{v.stock_quantity}</div>
                              <div className="flex items-center gap-1.5 justify-end">
                                {/* Availability toggle */}
                                <button
                                  onClick={() => toggleVariantAvailable.mutate({ id: v.id, val: !v.is_available })}
                                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${
                                    v.is_available
                                      ? "bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20"
                                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                  }`}
                                  title={v.is_available ? "Click to hide" : "Click to show"}
                                >
                                  {v.is_available ? "✓ Avail" : "Hidden"}
                                </button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditVariant(v)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => { if (confirm("Delete this variant?")) deleteVariant.mutate(v.id); }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {showVariantForm !== family.id && (
                        <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={() => openAddVariant(family.id)}>
                          <Plus className="w-3.5 h-3.5" /> Add Variant
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComponentFamilyManager;
