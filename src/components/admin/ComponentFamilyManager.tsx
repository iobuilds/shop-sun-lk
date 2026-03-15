import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  Package, X, Upload, Link as LinkIcon, ImagePlus, Loader2,
  Layers, Search, Eye, EyeOff, AlertTriangle, Zap,
  MoreVertical, CheckCircle2, CircleOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Image uploader
// ─────────────────────────────────────────────────────────────────────────────
const ImageUploader = ({
  images, onChange, placeholder = "Paste image URL…",
}: { images: string[]; onChange: (imgs: string[]) => void; placeholder?: string }) => {
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
      const { data } = supabase.storage.from("images").getPublicUrl(path);
      onChange([...images, data.publicUrl]);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const addUrl = () => {
    const t = urlInput.trim();
    if (t) { onChange([...images, t]); setUrlInput(""); }
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted">
              <img src={url} alt="" className="w-full h-full object-contain" />
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 shrink-0">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <div className="flex flex-1 gap-1">
          <Input value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addUrl())}
            placeholder={placeholder} className="text-xs h-9" />
          <button type="button" onClick={addUrl} disabled={!urlInput.trim()}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors shrink-0">
            <LinkIcon className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { Array.from(e.target.files || []).forEach(uploadFile); e.target.value = ""; }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const COMPONENT_TYPES = [
  { id: "resistor", label: "Resistor", color: "bg-orange-100 text-orange-700" },
  { id: "capacitor", label: "Capacitor", color: "bg-blue-100 text-blue-700" },
  { id: "ic", label: "IC / MCU", color: "bg-purple-100 text-purple-700" },
  { id: "transistor", label: "Transistor", color: "bg-green-100 text-green-700" },
  { id: "diode", label: "Diode", color: "bg-red-100 text-red-700" },
  { id: "inductor", label: "Inductor", color: "bg-yellow-100 text-yellow-700" },
  { id: "connector", label: "Connector", color: "bg-teal-100 text-teal-700" },
  { id: "relay", label: "Relay", color: "bg-gray-100 text-gray-700" },
  { id: "switch", label: "Switch", color: "bg-slate-100 text-slate-700" },
  { id: "sensor", label: "Sensor", color: "bg-cyan-100 text-cyan-700" },
  { id: "crystal", label: "Crystal / Oscillator", color: "bg-indigo-100 text-indigo-700" },
  { id: "led", label: "LED", color: "bg-lime-100 text-lime-700" },
  { id: "module", label: "Module / Board", color: "bg-pink-100 text-pink-700" },
  { id: "display", label: "Display", color: "bg-violet-100 text-violet-700" },
  { id: "power", label: "Power / Voltage Reg.", color: "bg-amber-100 text-amber-700" },
  { id: "other", label: "Other", color: "bg-muted text-muted-foreground" },
];
const MOUNT_TYPES = ["SMD", "Through-hole"];
const typeInfo = (id: string) => COMPONENT_TYPES.find(t => t.id === id) || COMPONENT_TYPES[COMPONENT_TYPES.length - 1];

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

// ─────────────────────────────────────────────────────────────────────────────
// Variant form (modal)
// ─────────────────────────────────────────────────────────────────────────────
const VariantFormModal = ({
  open, onClose, familyId, editingVariant, family,
  onSave, onBulkSave,
}: {
  open: boolean; onClose: () => void;
  familyId: string; editingVariant: any; family: any;
  onSave: (form: any, familyId: string) => void;
  onBulkSave: (form: any, packages: string[], familyId: string) => void;
}) => {
  const [form, setForm] = useState(() => editingVariant ? { ...editingVariant } : emptyVariant());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPkgs, setBulkPkgs] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when opened
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) {
    wasOpen.current = true;
  }
  if (!open) wasOpen.current = false;

  const handleSave = async () => {
    setSaving(true);
    if (bulkMode && !editingVariant) {
      const pkgs = bulkPkgs.split(",").map(p => p.trim()).filter(Boolean);
      await onBulkSave(form, pkgs, familyId);
    } else {
      await onSave(form, familyId);
    }
    setSaving(false);
    onClose();
  };

  const f = form as any;
  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));
  const pkgCount = bulkPkgs.split(",").filter(p => p.trim()).length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingVariant ? <Pencil className="w-4 h-4 text-secondary" /> : <Plus className="w-4 h-4 text-secondary" />}
            {editingVariant ? "Edit Variant" : "Add Variant"}
            {family && <span className="text-sm font-normal text-muted-foreground">— {family.name}</span>}
          </DialogTitle>
        </DialogHeader>

        {!editingVariant && (
          <div className="flex gap-2 mb-1">
            <button onClick={() => setBulkMode(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${!bulkMode ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:border-secondary/40"}`}>
              Single Variant
            </button>
            <button onClick={() => setBulkMode(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${bulkMode ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:border-secondary/40"}`}>
              <Layers className="w-3.5 h-3.5" /> Bulk (same value, multi-package)
            </button>
          </div>
        )}

        {bulkMode && (
          <div className="bg-secondary/8 border border-secondary/25 rounded-lg px-3 py-2 text-xs text-secondary flex items-start gap-2">
            <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Fill value &amp; specs once — enter all packages separated by commas. One variant per package will be created.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Value *</Label>
            <Input value={f.value} onChange={e => set("value", e.target.value)} placeholder="e.g. 100kΩ, 10nF, BC547" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Mount Type</Label>
            <Select value={f.mount_type} onValueChange={v => set("mount_type", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{MOUNT_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {bulkMode ? (
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3 text-secondary" /> Packages (comma-separated) *
              </Label>
              <Input value={bulkPkgs} onChange={e => setBulkPkgs(e.target.value)}
                placeholder="0201, 0402, 0603, 0805, 1206, Axial" className="font-mono" />
              {bulkPkgs && (
                <p className="text-[11px] text-secondary mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {pkgCount} variant{pkgCount !== 1 ? "s" : ""} will be created
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Package / Footprint</Label>
              <Input value={f.package} onChange={e => set("package", e.target.value)}
                placeholder="0402, 0603, DIP-8…" className="font-mono" />
            </div>
          )}

          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Tolerance</Label>
            <Input value={f.tolerance} onChange={e => set("tolerance", e.target.value)} placeholder="1%, 5%, 10%" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Wattage / Power Rating</Label>
            <Input value={f.wattage} onChange={e => set("wattage", e.target.value)} placeholder="1/4W, 1/2W, 1W" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Voltage Rating</Label>
            <Input value={f.voltage_rating} onChange={e => set("voltage_rating", e.target.value)} placeholder="50V, 100V, 250V" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">SKU / Part Number</Label>
            <Input value={f.sku} onChange={e => set("sku", e.target.value)}
              placeholder="C93216, RC0402JR-07100KL" className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Price (Rs.) *</Label>
            <Input type="number" value={f.price} onChange={e => set("price", parseFloat(e.target.value) || 0)}
              className="font-mono" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block text-muted-foreground">Stock Quantity</Label>
            <Input type="number" value={f.stock_quantity} onChange={e => set("stock_quantity", parseInt(e.target.value) || 0)}
              className="font-mono" />
          </div>

          {!bulkMode && (
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5" /> Variant Images <span className="font-normal">(overrides family image)</span>
              </Label>
              <ImageUploader images={f.images || []} onChange={imgs => set("images", imgs)} />
            </div>
          )}

          <div className="col-span-2 flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Available to customers</p>
              <p className="text-xs text-muted-foreground">Toggle off to hide this variant without deleting it</p>
            </div>
            <Switch checked={f.is_available} onCheckedChange={v => set("is_available", v)}
              className="data-[state=checked]:bg-secondary" />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}
            disabled={saving || !f.value || (bulkMode && !bulkPkgs.trim()) || (!bulkMode && !editingVariant && !f.package)}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> :
              bulkMode ? `Add ${pkgCount || 0} Variants` :
              editingVariant ? "Update Variant" : "Add Variant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const ComponentFamilyManager = () => {
  const qc = useQueryClient();
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [editingFamily, setEditingFamily] = useState<any | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyForm, setFamilyForm] = useState(emptyFamily());
  const [filterType, setFilterType] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  // Variant modal
  const [variantModalFamilyId, setVariantModalFamilyId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  const variantModalOpen = !!variantModalFamilyId;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: families = [], isLoading } = useQuery({
    queryKey: ["admin-component-families"],
    queryFn: async () => {
      const { data, error } = await supabase.from("component_families")
        .select("*").order("component_type").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allVariants = {} } = useQuery({
    queryKey: ["admin-all-variants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("component_variants")
        .select("*").order("value");
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((v: any) => {
        if (!grouped[v.family_id]) grouped[v.family_id] = [];
        grouped[v.family_id].push(v);
      });
      return grouped;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
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
      setShowFamilyModal(false); setEditingFamily(null); setFamilyForm(emptyFamily());
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

  const handleSaveVariant = async (form: any, familyId: string) => {
    if (editingVariant?.id) {
      const { error } = await supabase.from("component_variants").update(form).eq("id", editingVariant.id);
      if (error) throw error;
      toast({ title: "Variant updated" });
    } else {
      const { error } = await supabase.from("component_variants").insert({ ...form, family_id: familyId });
      if (error) throw error;
      toast({ title: "Variant added" });
    }
    qc.invalidateQueries({ queryKey: ["admin-all-variants"] });
    qc.invalidateQueries({ queryKey: ["component-variants"] });
    setEditingVariant(null);
  };

  const handleBulkSaveVariants = async (form: any, packages: string[], familyId: string) => {
    if (packages.length === 0) return;
    const rows = packages.map(pkg => ({ ...form, package: pkg, family_id: familyId }));
    const { error } = await supabase.from("component_variants").insert(rows);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["admin-all-variants"] });
    qc.invalidateQueries({ queryKey: ["component-variants"] });
    toast({ title: `${packages.length} variant${packages.length !== 1 ? "s" : ""} added` });
  };

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("component_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-variants"] });
      toast({ title: "Variant deleted" });
    },
  });

  const toggleVariantAvailable = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("component_variants").update({ is_available: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-variants"] }),
  });

  // inline variant price/stock quick-edit
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: "price" | "stock_quantity"; value: string } | null>(null);
  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    const update = inlineEdit.field === "price"
      ? { price: parseFloat(inlineEdit.value) || 0 }
      : { stock_quantity: parseInt(inlineEdit.value) || 0 };
    await supabase.from("component_variants").update(update).eq("id", inlineEdit.id);
    qc.invalidateQueries({ queryKey: ["admin-all-variants"] });
    setInlineEdit(null);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const openEditFamily = (family: any) => {
    setEditingFamily(family); setFamilyForm({ ...family }); setShowFamilyModal(true);
  };
  const openAddVariantModal = (familyId: string) => {
    setEditingVariant(null); setVariantModalFamilyId(familyId);
  };
  const openEditVariantModal = (variant: any) => {
    setEditingVariant(variant); setVariantModalFamilyId(variant.family_id);
  };

  const filteredFamilies = (families as any[]).filter((f: any) => {
    if (filterType !== "all" && f.component_type !== filterType) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const totalFamilies = (families as any[]).length;
  const totalVariants = Object.values(allVariants as Record<string, any[]>).reduce((s, a) => s + a.length, 0);
  const totalActive = (families as any[]).filter((f: any) => f.is_active).length;

  return (
    <div className="space-y-5">

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Families", value: totalFamilies, icon: <Package className="w-4 h-4" />, color: "text-primary" },
          { label: "Total Variants", value: totalVariants, icon: <Layers className="w-4 h-4" />, color: "text-secondary" },
          { label: "Active Families", value: totalActive, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
            <div className={`${s.color} opacity-70`}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search families…" className="pl-8 h-9 text-sm" />
          {searchQ && (
            <button onClick={() => setSearchQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Type filter */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {COMPONENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredFamilies.length} / {totalFamilies}
        </span>
        <Button size="sm" className="ml-auto gap-1.5"
          onClick={() => { setEditingFamily(null); setFamilyForm(emptyFamily()); setShowFamilyModal(true); }}>
          <Plus className="w-4 h-4" /> New Family
        </Button>
      </div>

      {/* ── Family Form Modal ── */}
      <Dialog open={showFamilyModal} onOpenChange={v => !v && (setShowFamilyModal(false), setEditingFamily(null))}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingFamily ? <Pencil className="w-4 h-4 text-secondary" /> : <Plus className="w-4 h-4 text-secondary" />}
              {editingFamily ? "Edit Family" : "New Component Family"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Name *</Label>
              <Input value={familyForm.name}
                onChange={e => setFamilyForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                placeholder="e.g. Resistor 1/4W Carbon Film" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Slug *</Label>
              <Input value={familyForm.slug}
                onChange={e => setFamilyForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="auto-generated" className="font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Component Type *</Label>
              <Select value={familyForm.component_type} onValueChange={v => setFamilyForm(f => ({ ...f, component_type: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Sort Order</Label>
              <Input type="number" value={familyForm.sort_order}
                onChange={e => setFamilyForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block text-muted-foreground">Description</Label>
              <Input value={familyForm.description}
                onChange={e => setFamilyForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown on family card" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block text-muted-foreground">Datasheet URL</Label>
              <Input value={familyForm.datasheet_url}
                onChange={e => setFamilyForm(f => ({ ...f, datasheet_url: e.target.value }))}
                placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5" /> Family Images
              </Label>
              <ImageUploader images={familyForm.images || []}
                onChange={imgs => setFamilyForm(f => ({ ...f, images: imgs }))} />
            </div>
            <div className="col-span-2 flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
                <p className="text-xs text-muted-foreground">Visible to customers in the catalog</p>
              </div>
              <Switch checked={familyForm.is_active} onCheckedChange={v => setFamilyForm(f => ({ ...f, is_active: v }))}
                className="data-[state=checked]:bg-secondary" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowFamilyModal(false); setEditingFamily(null); }}>Cancel</Button>
            <Button disabled={saveFamily.isPending || !familyForm.name || !familyForm.slug}
              onClick={() => saveFamily.mutate(familyForm)}>
              {saveFamily.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> :
                editingFamily ? "Update Family" : "Create Family"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Variant Modal ── */}
      {variantModalOpen && (
        <VariantFormModal
          open={variantModalOpen}
          onClose={() => { setVariantModalFamilyId(null); setEditingVariant(null); }}
          familyId={variantModalFamilyId!}
          editingVariant={editingVariant}
          family={variantModalFamily}
          onSave={handleSaveVariant}
          onBulkSave={handleBulkSaveVariants}
        />
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[68px] bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filteredFamilies.length === 0 && (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{searchQ || filterType !== "all" ? "No families match your filter" : "No families yet"}</p>
          {!searchQ && filterType === "all" && (
            <p className="text-sm mt-1">Click <strong>New Family</strong> to get started</p>
          )}
        </div>
      )}

      {/* ── Family list ── */}
      <div className="space-y-2">
        {filteredFamilies.map((family: any) => {
          const variants: any[] = (allVariants as Record<string, any[]>)[family.id] || [];
          const isExpanded = expandedFamily === family.id;
          const availCount = variants.filter(v => v.is_available).length;
          const ti = typeInfo(family.component_type);

          return (
            <div key={family.id} className={`bg-card rounded-xl border transition-all overflow-hidden ${
              isExpanded ? "border-secondary/40 shadow-sm" : "border-border hover:border-border/80"
            }`}>

              {/* ── Family header row ── */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedFamily(isExpanded ? null : family.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </button>

                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {family.images?.[0]
                    ? <img src={family.images[0]} alt={family.name} className="w-full h-full object-contain p-1" />
                    : <Package className="w-4 h-4 text-muted-foreground/40" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{family.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ti.color}`}>
                      {ti.label}
                    </span>
                    {!family.is_active && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Hidden</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {family.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{family.description}</p>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">
                      <span className="text-foreground font-semibold">{variants.length}</span> variant{variants.length !== 1 ? "s" : ""}
                      {" · "}<span className={availCount > 0 ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>{availCount}</span> available
                    </span>
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden md:inline">
                    {family.is_active ? "Active" : "Hidden"}
                  </span>
                  <Switch checked={family.is_active}
                    onCheckedChange={v => toggleFamilyActive.mutate({ id: family.id, val: v })}
                    className="data-[state=checked]:bg-secondary" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Edit family" onClick={() => openEditFamily(family)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive"
                    title="Delete family"
                    onClick={() => { if (confirm(`Delete "${family.name}" and all ${variants.length} variants?`)) deleteFamily.mutate(family.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* ── Variants panel ── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border bg-muted/10 p-4 space-y-3">

                      {/* Variant panel header */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Variants ({variants.length})
                        </p>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                          onClick={() => openAddVariantModal(family.id)}>
                          <Plus className="w-3.5 h-3.5" /> Add Variant
                        </Button>
                      </div>

                      {variants.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                          <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No variants yet</p>
                          <button onClick={() => openAddVariantModal(family.id)}
                            className="text-xs text-secondary hover:underline mt-1">Add first variant →</button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border overflow-hidden bg-card">
                          {/* Table header */}
                          <div className="hidden lg:grid grid-cols-[36px_140px_90px_70px_70px_70px_90px_90px_110px] gap-2 px-3 py-2 bg-muted/60 border-b border-border">
                            {["", "Value / SKU", "Package", "Mount", "Tol.", "Watt.", "Price", "Stock", ""].map((h, i) => (
                              <div key={i} className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ${i === 8 ? "text-right" : ""}`}>{h}</div>
                            ))}
                          </div>

                          {/* Variant rows */}
                          {variants.map((v: any) => {
                            const imgSrc = v.images?.[0] || family.images?.[0] || null;
                            const isEditingPrice = inlineEdit?.id === v.id && inlineEdit.field === "price";
                            const isEditingStock = inlineEdit?.id === v.id && inlineEdit.field === "stock_quantity";

                            return (
                              <div key={v.id}
                                className={`grid grid-cols-1 lg:grid-cols-[36px_140px_90px_70px_70px_70px_90px_90px_110px] gap-2 px-3 py-2.5 border-b border-border last:border-0 items-center transition-colors ${
                                  !v.is_available ? "opacity-40 bg-muted/20" : "hover:bg-muted/20"
                                }`}
                              >
                                {/* Thumbnail */}
                                <div className="hidden lg:flex items-center">
                                  <div className="w-7 h-7 rounded bg-muted border border-border overflow-hidden flex items-center justify-center">
                                    {imgSrc
                                      ? <img src={imgSrc} alt="" className="w-full h-full object-contain p-0.5" />
                                      : <Package className="w-3 h-3 text-muted-foreground/30" />
                                    }
                                  </div>
                                </div>

                                {/* Value + SKU (mobile: full row) */}
                                <div className="flex items-center gap-2 lg:block">
                                  {imgSrc && (
                                    <img src={imgSrc} alt="" className="lg:hidden w-7 h-7 object-contain rounded bg-muted border border-border shrink-0" />
                                  )}
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{v.value || "—"}</p>
                                    {v.sku && <p className="text-[10px] text-muted-foreground font-mono leading-none">{v.sku}</p>}
                                  </div>
                                  {/* Mobile: show badges inline */}
                                  <div className="lg:hidden flex gap-1 ml-auto flex-wrap">
                                    {v.package && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{v.package}</span>}
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${v.mount_type === "SMD" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>{v.mount_type}</span>
                                  </div>
                                </div>

                                {/* Package */}
                                <div className="hidden lg:block text-xs font-mono text-muted-foreground">{v.package || "—"}</div>

                                {/* Mount */}
                                <div className="hidden lg:block">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${v.mount_type === "SMD" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                                    {v.mount_type}
                                  </span>
                                </div>

                                {/* Tolerance */}
                                <div className="hidden lg:block text-xs text-muted-foreground">{v.tolerance || "—"}</div>

                                {/* Wattage */}
                                <div className="hidden lg:block text-xs text-muted-foreground">{v.wattage || "—"}</div>

                                {/* Price — click to inline edit */}
                                <div className="hidden lg:block">
                                  {isEditingPrice ? (
                                    <input
                                      autoFocus
                                      type="number"
                                      defaultValue={v.price}
                                      onChange={e => setInlineEdit(ie => ie ? { ...ie, value: e.target.value } : ie)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={e => e.key === "Enter" && saveInlineEdit()}
                                      className="w-full text-xs font-mono border border-secondary rounded px-1.5 py-1 bg-background focus:outline-none"
                                    />
                                  ) : (
                                    <button
                                      onClick={() => setInlineEdit({ id: v.id, field: "price", value: String(v.price) })}
                                      className="text-xs font-semibold text-foreground hover:text-secondary transition-colors cursor-text"
                                      title="Click to edit price"
                                    >
                                      {v.price > 0 ? `Rs.${v.price}` : <span className="text-muted-foreground">—</span>}
                                    </button>
                                  )}
                                </div>

                                {/* Stock — click to inline edit */}
                                <div className="hidden lg:block">
                                  {isEditingStock ? (
                                    <input
                                      autoFocus
                                      type="number"
                                      defaultValue={v.stock_quantity}
                                      onChange={e => setInlineEdit(ie => ie ? { ...ie, value: e.target.value } : ie)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={e => e.key === "Enter" && saveInlineEdit()}
                                      className="w-full text-xs font-mono border border-secondary rounded px-1.5 py-1 bg-background focus:outline-none"
                                    />
                                  ) : (
                                    <button
                                      onClick={() => setInlineEdit({ id: v.id, field: "stock_quantity", value: String(v.stock_quantity) })}
                                      className={`text-xs font-semibold cursor-text transition-colors ${
                                        v.stock_quantity === 0 ? "text-destructive hover:text-destructive/80" :
                                        v.stock_quantity < 10 ? "text-amber-600 hover:text-amber-500" : "text-foreground hover:text-secondary"
                                      }`}
                                      title="Click to edit stock"
                                    >
                                      {v.stock_quantity}
                                    </button>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    onClick={() => toggleVariantAvailable.mutate({ id: v.id, val: !v.is_available })}
                                    title={v.is_available ? "Hide variant" : "Show variant"}
                                    className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                                      v.is_available
                                        ? "bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20"
                                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                    }`}
                                  >
                                    {v.is_available ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  </button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => openEditVariantModal(v)}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive"
                                    onClick={() => { if (confirm("Delete this variant?")) deleteVariant.mutate(v.id); }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
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
