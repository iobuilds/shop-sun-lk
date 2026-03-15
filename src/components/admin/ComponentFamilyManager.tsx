import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Pencil, ChevronRight,
  Package, X, Upload, Link as LinkIcon, ImagePlus, Loader2,
  Layers, Search, Eye, EyeOff, Zap, CheckCircle2,
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
  {
    id: "resistor", label: "Resistor", shortDesc: "Carbon film, metal film, SMD",
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    badgeColor: "bg-orange-100 text-orange-700",
    iconColor: "text-orange-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <rect x="3" y="20" width="42" height="8" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="10" y="16" width="28" height="16" rx="3" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="17" width="4" height="14" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="22" y="17" width="4" height="14" rx="1" fill="currentColor" opacity="0.4"/>
        <rect x="30" y="17" width="4" height="14" rx="1" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: "capacitor", label: "Capacitor", shortDesc: "Electrolytic, ceramic, tantalum",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    badgeColor: "bg-blue-100 text-blue-700",
    iconColor: "text-blue-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <line x1="6" y1="24" x2="18" y2="24" stroke="currentColor" strokeWidth="2"/>
        <rect x="18" y="10" width="4" height="28" rx="1.5" fill="currentColor" opacity="0.7"/>
        <rect x="26" y="10" width="4" height="28" rx="1.5" fill="currentColor" opacity="0.7"/>
        <line x1="30" y1="24" x2="42" y2="24" stroke="currentColor" strokeWidth="2"/>
        <line x1="24" y1="13" x2="24" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
        <line x1="21" y1="15.5" x2="27" y2="15.5" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: "ic", label: "ICs / MCUs", shortDesc: "Microcontrollers, op-amps, logic ICs",
    color: "bg-slate-50 border-slate-200 hover:border-slate-400",
    badgeColor: "bg-slate-100 text-slate-700",
    iconColor: "text-slate-600",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <rect x="12" y="12" width="24" height="24" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="15" y="15" width="18" height="18" rx="2" fill="currentColor" opacity="0.25"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <line x1="5" y1={17+i*5} x2="12" y2={17+i*5} stroke="currentColor" strokeWidth="1.5"/>
            <line x1="36" y1={17+i*5} x2="43" y2={17+i*5} stroke="currentColor" strokeWidth="1.5"/>
          </g>
        ))}
        <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: "transistor", label: "Transistors", shortDesc: "NPN, PNP, MOSFET, BJT",
    color: "bg-green-50 border-green-200 hover:border-green-400",
    badgeColor: "bg-green-100 text-green-700",
    iconColor: "text-green-600",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <circle cx="24" cy="24" r="14" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="6" y1="24" x2="16" y2="24" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="16" y1="14" x2="16" y2="34" stroke="currentColor" strokeWidth="2"/>
        <line x1="16" y1="19" x2="28" y2="13" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="16" y1="29" x2="28" y2="35" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="28" y1="13" x2="28" y2="7" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="28" y1="35" x2="28" y2="41" stroke="currentColor" strokeWidth="1.5"/>
        <polygon points="24,31 28,35 24,39" fill="currentColor" opacity="0.7"/>
      </svg>
    ),
  },
  {
    id: "diode", label: "Diodes", shortDesc: "Rectifier, Zener, Schottky, TVS",
    color: "bg-red-50 border-red-200 hover:border-red-400",
    badgeColor: "bg-red-100 text-red-700",
    iconColor: "text-red-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <line x1="6" y1="24" x2="16" y2="24" stroke="currentColor" strokeWidth="2"/>
        <line x1="32" y1="24" x2="42" y2="24" stroke="currentColor" strokeWidth="2"/>
        <polygon points="16,12 16,36 32,24" fill="currentColor" opacity="0.6"/>
        <line x1="32" y1="12" x2="32" y2="36" stroke="currentColor" strokeWidth="2.5"/>
      </svg>
    ),
  },
  {
    id: "inductor", label: "Inductors", shortDesc: "SMD coil, toroid, power",
    color: "bg-yellow-50 border-yellow-200 hover:border-yellow-400",
    badgeColor: "bg-yellow-100 text-yellow-700",
    iconColor: "text-yellow-600",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <line x1="3" y1="24" x2="9" y2="24" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 24 Q13 16 17 24 Q21 32 25 24 Q29 16 33 24 Q37 32 41 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <line x1="41" y1="24" x2="46" y2="24" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    id: "connector", label: "Connectors", shortDesc: "JST, Dupont, pin headers",
    color: "bg-teal-50 border-teal-200 hover:border-teal-400",
    badgeColor: "bg-teal-100 text-teal-700",
    iconColor: "text-teal-600",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <rect x="6" y="13" width="16" height="22" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="26" y="13" width="16" height="22" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
        {[0,1,2].map(i => (
          <g key={i}>
            <circle cx="14" cy={19+i*5} r="2.5" fill="currentColor" opacity="0.7"/>
            <circle cx="34" cy={19+i*5} r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7"/>
          </g>
        ))}
      </svg>
    ),
  },
  {
    id: "led", label: "LEDs", shortDesc: "Through-hole, SMD, RGB, IR",
    color: "bg-amber-50 border-amber-200 hover:border-amber-400",
    badgeColor: "bg-amber-100 text-amber-700",
    iconColor: "text-amber-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <polygon points="8,34 28,34 28,20 8,20" fill="currentColor" opacity="0.6" rx="2"/>
        <line x1="14" y1="34" x2="14" y2="42" stroke="currentColor" strokeWidth="2"/>
        <line x1="22" y1="34" x2="22" y2="42" stroke="currentColor" strokeWidth="2"/>
        <line x1="30" y1="16" x2="38" y2="9" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <line x1="30" y1="22" x2="40" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: "sensor", label: "Sensors", shortDesc: "Temperature, Hall, current",
    color: "bg-purple-50 border-purple-200 hover:border-purple-400",
    badgeColor: "bg-purple-100 text-purple-700",
    iconColor: "text-purple-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <circle cx="24" cy="22" r="12" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="24" cy="22" r="6" fill="currentColor" opacity="0.2"/>
        <circle cx="24" cy="22" r="2.5" fill="currentColor" opacity="0.8"/>
        {[0,60,120,180,240,300].map((d, i) => (
          <line key={i} x1={24+Math.cos(d*Math.PI/180)*8} y1={22+Math.sin(d*Math.PI/180)*8} x2={24+Math.cos(d*Math.PI/180)*11} y2={22+Math.sin(d*Math.PI/180)*11} stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
        ))}
        <line x1="24" y1="34" x2="24" y2="42" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    id: "crystal", label: "Crystals", shortDesc: "Quartz, oscillators, resonators",
    color: "bg-cyan-50 border-cyan-200 hover:border-cyan-400",
    badgeColor: "bg-cyan-100 text-cyan-700",
    iconColor: "text-cyan-600",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <line x1="5" y1="24" x2="13" y2="24" stroke="currentColor" strokeWidth="2"/>
        <line x1="35" y1="24" x2="43" y2="24" stroke="currentColor" strokeWidth="2"/>
        <rect x="13" y="13" width="22" height="22" rx="3" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="20" y1="13" x2="20" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
        <line x1="28" y1="13" x2="28" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: "relay", label: "Relays", shortDesc: "SPDT, DPDT, solid state",
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
    badgeColor: "bg-emerald-100 text-emerald-700",
    iconColor: "text-emerald-600",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <rect x="7" y="10" width="34" height="28" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="16" width="12" height="7" rx="1.5" fill="currentColor" opacity="0.4"/>
        <line x1="23" y1="26" x2="37" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="37" cy="20" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <circle cx="37" cy="28" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
  },
  {
    id: "switch", label: "Switches", shortDesc: "Tact, toggle, push buttons",
    color: "bg-sky-50 border-sky-200 hover:border-sky-400",
    badgeColor: "bg-sky-100 text-sky-700",
    iconColor: "text-sky-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <line x1="6" y1="24" x2="17" y2="24" stroke="currentColor" strokeWidth="2"/>
        <line x1="31" y1="24" x2="42" y2="24" stroke="currentColor" strokeWidth="2"/>
        <circle cx="17" cy="24" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.1"/>
        <circle cx="31" cy="24" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.1"/>
        <line x1="20" y1="24" x2="28" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "module", label: "Modules", shortDesc: "WiFi, BT, LoRa, dev boards",
    color: "bg-pink-50 border-pink-200 hover:border-pink-400",
    badgeColor: "bg-pink-100 text-pink-700",
    iconColor: "text-pink-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <rect x="6" y="12" width="36" height="24" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="12" y="18" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.4"/>
        <rect x="26" y="18" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.2"/>
        {[0,1,2,3].map(i => <line key={i} x1={10+i*8} y1="36" x2={10+i*8} y2="42" stroke="currentColor" strokeWidth="1.5"/>)}
      </svg>
    ),
  },
  {
    id: "power", label: "Power ICs", shortDesc: "Voltage reg, LDO, DCDC",
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    badgeColor: "bg-violet-100 text-violet-700",
    iconColor: "text-violet-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <polygon points="24,6 30,20 44,20 33,29 37,43 24,34 11,43 15,29 4,20 18,20" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: "display", label: "Displays", shortDesc: "OLED, LCD, TFT, 7-seg",
    color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
    badgeColor: "bg-indigo-100 text-indigo-700",
    iconColor: "text-indigo-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <rect x="5" y="10" width="38" height="26" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="14" width="30" height="18" rx="1.5" fill="currentColor" opacity="0.2"/>
        <line x1="14" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <line x1="14" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
        <line x1="20" y1="36" x2="28" y2="36" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    id: "other", label: "Other", shortDesc: "Misc components",
    color: "bg-gray-50 border-gray-200 hover:border-gray-400",
    badgeColor: "bg-gray-100 text-gray-700",
    iconColor: "text-gray-500",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
        <circle cx="24" cy="24" r="16" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="24" cy="24" r="5" fill="currentColor" opacity="0.4"/>
        <circle cx="12" cy="14" r="3" fill="currentColor" opacity="0.3"/>
        <circle cx="36" cy="14" r="3" fill="currentColor" opacity="0.3"/>
        <circle cx="12" cy="34" r="3" fill="currentColor" opacity="0.3"/>
        <circle cx="36" cy="34" r="3" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
  },
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

  // Per-type family & variant counts
  const typeFamilyCount = (id: string) => (families as any[]).filter((f: any) => f.component_type === id).length;
  const typeVariantCount = (id: string) => {
    const fids = (families as any[]).filter((f: any) => f.component_type === id).map((f: any) => f.id);
    return fids.reduce((s: number, id: string) => s + ((allVariants as any)[id]?.length || 0), 0);
  };

  return (
    <div className="space-y-5">

      {/* ── Global search + New Family ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input value={searchQ} onChange={e => { setSearchQ(e.target.value); if (e.target.value) setFilterType("all"); }}
            placeholder="Search component families… e.g. 10kΩ, NE555" className="pl-9 h-10 text-sm" />
          {searchQ && (
            <button onClick={() => setSearchQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button className="gap-1.5 h-10 shrink-0"
          onClick={() => { setEditingFamily(null); setFamilyForm(emptyFamily()); setShowFamilyModal(true); }}>
          <Plus className="w-4 h-4" /> New Family
        </Button>
      </div>

      {/* ── Visual category navigation grid ── */}
      {!searchQ && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* "All" card */}
          <button
            onClick={() => setFilterType("all")}
            className={`relative text-left p-4 rounded-xl border-2 transition-all duration-150 hover:shadow-sm ${
              filterType === "all"
                ? "bg-secondary/10 border-secondary shadow-sm"
                : "bg-card border-border hover:border-secondary/50"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${filterType === "all" ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                <Package className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filterType === "all" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                {totalFamilies}
              </span>
            </div>
            <p className="font-bold text-sm text-foreground leading-tight">All Types</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{totalVariants} variants total</p>
          </button>

          {COMPONENT_TYPES.map(type => {
            const fc = typeFamilyCount(type.id);
            const vc = typeVariantCount(type.id);
            const isActive = filterType === type.id;
            return (
              <motion.button
                key={type.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setFilterType(isActive ? "all" : type.id)}
                className={`relative text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                  isActive
                    ? `${type.color} shadow-sm ring-1 ring-inset ring-current/20`
                    : `${type.color} opacity-80 hover:opacity-100`
                } ${fc === 0 ? "opacity-40" : ""}`}
              >
                {/* Count badge */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/60 ${type.iconColor}`}>
                    {type.icon}
                  </div>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${type.badgeColor}`}>
                    {fc}
                  </span>
                </div>
                <p className="font-bold text-sm text-foreground leading-tight">{type.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{type.shortDesc}</p>
                {vc > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">{vc} variants</p>
                )}
                {isActive && (
                  <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-current opacity-60" />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Active filter indicator */}
      {!searchQ && filterType !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {COMPONENT_TYPES.find(t => t.id === filterType)?.label}
          </span>
          <span className="text-xs text-muted-foreground">— {filteredFamilies.length} famil{filteredFamilies.length !== 1 ? "ies" : "y"}</span>
          <button onClick={() => setFilterType("all")}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Show all
          </button>
        </div>
      )}
      {searchQ && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredFamilies.length}</span> result{filteredFamilies.length !== 1 ? "s" : ""} for "<span className="text-foreground">{searchQ}</span>"
        </p>
      )}

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
          family={(families as any[]).find((f: any) => f.id === variantModalFamilyId) || null}
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
