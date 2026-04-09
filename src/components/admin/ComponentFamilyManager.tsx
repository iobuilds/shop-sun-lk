import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Pencil, ChevronRight, ChevronLeft,
  Package, X, Upload, Link as LinkIcon, ImagePlus, Loader2,
  Layers, Search, Eye, EyeOff, Zap, CheckCircle2, Settings2,
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
      const { uploadToStorage } = await import("@/lib/storageUpload");
      const url = await uploadToStorage(file, "components");
      if (url) onChange([...images, url]);
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
// Built-in component types
// ─────────────────────────────────────────────────────────────────────────────
const BUILTIN_TYPES = [
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
        <polygon points="8,34 28,34 28,20 8,20" fill="currentColor" opacity="0.6"/>
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

// Generic icon for custom types
const CustomTypeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
    <rect x="8" y="8" width="32" height="32" rx="4" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="24" y1="16" x2="24" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <line x1="16" y1="24" x2="32" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CUSTOM_TYPE_COLOR = "bg-fuchsia-50 border-fuchsia-200 hover:border-fuchsia-400";
const CUSTOM_TYPE_BADGE = "bg-fuchsia-100 text-fuchsia-700";
const CUSTOM_TYPE_ICON = "text-fuchsia-500";

const MOUNT_TYPES = ["SMD", "Through-hole"];

const typeInfo = (id: string, customTypes: CustomType[]) => {
  const builtin = BUILTIN_TYPES.find(t => t.id === id);
  if (builtin) return builtin;
  const custom = customTypes.find(t => t.id === id);
  if (custom) return {
    id: custom.id, label: custom.label, shortDesc: custom.shortDesc,
    color: CUSTOM_TYPE_COLOR, badgeColor: CUSTOM_TYPE_BADGE,
    iconColor: CUSTOM_TYPE_ICON, icon: <CustomTypeIcon />,
  };
  return BUILTIN_TYPES[BUILTIN_TYPES.length - 1];
};

// Custom types stored in localStorage
interface CustomType {
  id: string; label: string; shortDesc: string;
}

const CUSTOM_TYPES_KEY = "admin_custom_component_types";
const loadCustomTypes = (): CustomType[] => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY) || "[]"); }
  catch { return []; }
};
const saveCustomTypes = (types: CustomType[]) => {
  localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(types));
};

const emptyFamily = (type?: string) => ({
  name: "", slug: "", component_type: type || "resistor",
  description: "", images: [] as string[], datasheet_url: "",
  is_active: true, sort_order: 0,
});
const emptyVariant = () => ({
  mount_type: "SMD", value: "", package: "", tolerance: "",
  wattage: "", voltage_rating: "", sku: "", price: 0,
  stock_quantity: 0, is_available: true, images: [] as string[],
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant form modal
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

  const wasOpen = useRef(false);
  if (open && !wasOpen.current) wasOpen.current = true;
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

  // Drill-down navigation: null = home grid, string = inside a type
  const [activeType, setActiveType] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");

  // Custom types
  const [customTypes, setCustomTypes] = useState<CustomType[]>(loadCustomTypes);
  const [showNewTypeModal, setShowNewTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({ label: "", shortDesc: "" });

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

  // All types (builtin + custom)
  const allTypes = [
    ...BUILTIN_TYPES,
    ...customTypes.map(ct => ({
      ...ct, color: CUSTOM_TYPE_COLOR, badgeColor: CUSTOM_TYPE_BADGE,
      iconColor: CUSTOM_TYPE_ICON, icon: <CustomTypeIcon />,
    })),
  ];

  const typeFamilyCount = (id: string) => (families as any[]).filter((f: any) => f.component_type === id).length;
  const typeVariantCount = (id: string) => {
    const fids = (families as any[]).filter((f: any) => f.component_type === id).map((f: any) => f.id);
    return fids.reduce((s: number, fid: string) => s + ((allVariants as any)[fid]?.length || 0), 0);
  };
  const totalFamilies = (families as any[]).length;
  const totalVariants = Object.values(allVariants as Record<string, any[]>).reduce((s, a) => s + a.length, 0);

  // Families shown in the drill-down or search view
  const filteredFamilies = (families as any[]).filter((f: any) => {
    const typeMatch = activeType ? f.component_type === activeType : true;
    if (!typeMatch) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  // Active type info
  const activeTypeInfo = activeType ? allTypes.find(t => t.id === activeType) : null;

  // Save custom type
  const handleCreateCustomType = () => {
    if (!newTypeForm.label.trim()) return;
    const id = slugify(newTypeForm.label);
    if (allTypes.find(t => t.id === id)) {
      toast({ title: "Type already exists", variant: "destructive" }); return;
    }
    const newTypes = [...customTypes, { id, label: newTypeForm.label.trim(), shortDesc: newTypeForm.shortDesc.trim() }];
    setCustomTypes(newTypes);
    saveCustomTypes(newTypes);
    setNewTypeForm({ label: "", shortDesc: "" });
    setShowNewTypeModal(false);
    toast({ title: `"${newTypeForm.label}" type created` });
  };

  const handleDeleteCustomType = (id: string) => {
    const newTypes = customTypes.filter(t => t.id !== id);
    setCustomTypes(newTypes);
    saveCustomTypes(newTypes);
    toast({ title: "Custom type removed" });
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Drill-down: inside a type ── */}
      {activeType && !searchQ ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeType}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Header bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setActiveType(null); setExpandedFamily(null); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to categories
              </button>
              <span className="text-muted-foreground">/</span>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${activeTypeInfo?.color}`}>
                <span className={activeTypeInfo?.iconColor + " scale-75 inline-flex"}>{activeTypeInfo?.icon}</span>
                {activeTypeInfo?.label}
              </div>
              <Badge variant="outline" className="ml-1">{filteredFamilies.length} famil{filteredFamilies.length !== 1 ? "ies" : "y"}</Badge>
              <div className="flex-1" />
              <Button size="sm" className="gap-1.5"
                onClick={() => {
                  setEditingFamily(null);
                  setFamilyForm(emptyFamily(activeType));
                  setShowFamilyModal(true);
                }}>
                <Plus className="w-4 h-4" /> New Family
              </Button>
            </div>

            {/* Search within type */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder={`Search ${activeTypeInfo?.label} families…`}
                className="pl-9 h-10 text-sm" />
              {searchQ && (
                <button onClick={() => setSearchQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Family list */}
            {FamilyList({
              filteredFamilies, allVariants, searchQ, isLoading,
              expandedFamily, setExpandedFamily,
              openEditFamily, deleteFamily, toggleFamilyActive,
              openAddVariantModal, openEditVariantModal,
              deleteVariant, toggleVariantAvailable,
              inlineEdit, setInlineEdit, saveInlineEdit,
              customTypes,
              activeType,
            })}
          </motion.div>
        </AnimatePresence>
      ) : (
        /* ── Home grid view ── */
        <AnimatePresence mode="wait">
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {/* Global search + New Family */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search all component families… e.g. 10kΩ, NE555" className="pl-9 h-10 text-sm" />
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

            {/* Search results */}
            {searchQ ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{filteredFamilies.length}</span> result{filteredFamilies.length !== 1 ? "s" : ""} for "<span className="text-foreground">{searchQ}</span>"
                </p>
                {FamilyList({
                  filteredFamilies, allVariants, searchQ, isLoading,
                  expandedFamily, setExpandedFamily,
                  openEditFamily, deleteFamily, toggleFamilyActive,
                  openAddVariantModal, openEditVariantModal,
                  deleteVariant, toggleVariantAvailable,
                  inlineEdit, setInlineEdit, saveInlineEdit,
                  customTypes,
                  activeType: null,
                })}
              </div>
            ) : (
              /* Category grid */
              <div className="space-y-4">
                {/* Stats row */}
                <div className="flex items-center gap-4 px-1">
                  <span className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{totalFamilies}</span> families</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{totalVariants}</span> variants total</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{allTypes.length}</span> types</span>
                </div>

                {/* Built-in type cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {allTypes.map(type => {
                    const fc = typeFamilyCount(type.id);
                    const vc = typeVariantCount(type.id);
                    const isCustom = !!customTypes.find(ct => ct.id === type.id);
                    return (
                      <div key={type.id} className="relative group/card">
                        <motion.button
                          whileHover={{ y: -2, scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setActiveType(type.id); setExpandedFamily(null); setSearchQ(""); }}
                          className={`w-full relative text-left p-4 rounded-xl border-2 transition-all duration-150 group ${type.color}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/60 ${type.iconColor}`}>
                              {type.icon}
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${type.badgeColor}`}>
                                {fc}
                              </span>
                              {vc > 0 && (
                                <span className="text-[9px] text-muted-foreground font-medium">{vc}v</span>
                              )}
                            </div>
                          </div>
                          <p className="font-bold text-sm text-foreground leading-tight">{type.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{type.shortDesc}</p>
                          {/* Hover arrow */}
                          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity">
                            <ChevronRight className="w-4 h-4 text-foreground" />
                          </div>
                          {/* Custom badge */}
                          {isCustom && (
                            <span className="absolute top-2 left-2 text-[9px] bg-fuchsia-200 text-fuchsia-700 px-1 py-0.5 rounded font-bold">custom</span>
                          )}
                        </motion.button>
                        {/* Delete button — only for custom types, shown on hover */}
                        {isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remove custom type "${type.label}"? This won't delete existing families.`)) handleDeleteCustomType(type.id);
                            }}
                            className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive/80 shadow-sm"
                            title="Delete type"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* + Add New Type card */}
                  <motion.button
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowNewTypeModal(true)}
                    className="relative text-left p-4 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary hover:bg-primary/5 transition-all duration-150 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="font-bold text-sm text-muted-foreground group-hover:text-foreground leading-tight transition-colors">New Type</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Create custom category</p>
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
                  {allTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
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

      {/* ── New Custom Type Modal ── */}
      <Dialog open={showNewTypeModal} onOpenChange={v => !v && setShowNewTypeModal(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" /> Create Custom Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Type Name *</Label>
              <Input
                value={newTypeForm.label}
                onChange={e => setNewTypeForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Optocoupler, Motor Driver…"
                autoFocus
              />
              {newTypeForm.label && (
                <p className="text-[11px] text-muted-foreground mt-1">ID: <span className="font-mono">{slugify(newTypeForm.label)}</span></p>
              )}
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">Short Description</Label>
              <Input
                value={newTypeForm.shortDesc}
                onChange={e => setNewTypeForm(f => ({ ...f, shortDesc: e.target.value }))}
                placeholder="e.g. PC817, 4N35, solid-state…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewTypeModal(false)}>Cancel</Button>
            <Button disabled={!newTypeForm.label.trim()} onClick={handleCreateCustomType}>
              Create Type
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Family list (extracted to avoid repetition)
// ─────────────────────────────────────────────────────────────────────────────
function FamilyList({
  filteredFamilies, allVariants, searchQ, isLoading,
  expandedFamily, setExpandedFamily,
  openEditFamily, deleteFamily, toggleFamilyActive,
  openAddVariantModal, openEditVariantModal,
  deleteVariant, toggleVariantAvailable,
  inlineEdit, setInlineEdit, saveInlineEdit,
  customTypes, activeType,
}: any) {
  const allTypes = [
    ...BUILTIN_TYPES,
    ...customTypes.map((ct: CustomType) => ({
      ...ct, color: CUSTOM_TYPE_COLOR, badgeColor: CUSTOM_TYPE_BADGE,
      iconColor: CUSTOM_TYPE_ICON, icon: <CustomTypeIcon />,
    })),
  ];
  const tInfo = (id: string) => allTypes.find(t => t.id === id) || allTypes[allTypes.length - 1];

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-[68px] bg-muted animate-pulse rounded-xl" />)}
    </div>
  );

  if (filteredFamilies.length === 0) return (
    <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">{searchQ ? "No families match your search" : `No families in ${activeType ? tInfo(activeType)?.label : "this category"} yet`}</p>
      {!searchQ && <p className="text-sm mt-1">Click <strong>New Family</strong> to get started</p>}
    </div>
  );

  return (
    <div className="space-y-2">
      {filteredFamilies.map((family: any) => {
        const variants: any[] = (allVariants as Record<string, any[]>)[family.id] || [];
        const isExpanded = expandedFamily === family.id;
        const availCount = variants.filter((v: any) => v.is_available).length;
        const ti = tInfo(family.component_type);

        return (
          <div key={family.id} className={`bg-card rounded-xl border transition-all overflow-hidden ${
            isExpanded ? "border-secondary/40 shadow-sm" : "border-border hover:border-border/80"
          }`}>
            {/* Family header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setExpandedFamily(isExpanded ? null : family.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              </button>

              <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {family.images?.[0]
                  ? <img src={family.images[0]} alt={family.name} className="w-full h-full object-contain p-1" />
                  : <Package className="w-4 h-4 text-muted-foreground/40" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{family.name}</span>
                  {!activeType && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ti.color}`}>
                      {ti.label}
                    </span>
                  )}
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

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {family.is_active ? "Active" : "Hidden"}
                </span>
                <Switch checked={family.is_active}
                  onCheckedChange={(v: boolean) => toggleFamilyActive.mutate({ id: family.id, val: v })}
                  className="data-[state=checked]:bg-secondary" />
              </div>

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

            {/* Variants panel */}
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
                        <div className="hidden lg:grid grid-cols-[36px_140px_90px_70px_70px_70px_90px_90px_110px] gap-2 px-3 py-2 bg-muted/60 border-b border-border">
                          {["", "Value / SKU", "Package", "Mount", "Tol.", "Watt.", "Price", "Stock", ""].map((h, i) => (
                            <div key={i} className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ${i === 8 ? "text-right" : ""}`}>{h}</div>
                          ))}
                        </div>

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
                              <div className="hidden lg:flex items-center">
                                <div className="w-7 h-7 rounded bg-muted border border-border overflow-hidden flex items-center justify-center">
                                  {imgSrc
                                    ? <img src={imgSrc} alt="" className="w-full h-full object-contain p-0.5" />
                                    : <Package className="w-3 h-3 text-muted-foreground/30" />
                                  }
                                </div>
                              </div>

                              <div className="flex items-center gap-2 lg:block">
                                {imgSrc && (
                                  <img src={imgSrc} alt="" className="lg:hidden w-7 h-7 object-contain rounded bg-muted border border-border shrink-0" />
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{v.value || "—"}</p>
                                  {v.sku && <p className="text-[10px] text-muted-foreground font-mono leading-none">{v.sku}</p>}
                                </div>
                                <div className="lg:hidden flex gap-1 ml-auto flex-wrap">
                                  {v.package && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{v.package}</span>}
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${v.mount_type === "SMD" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>{v.mount_type}</span>
                                </div>
                              </div>

                              <div className="hidden lg:block text-xs font-mono text-muted-foreground">{v.package || "—"}</div>
                              <div className="hidden lg:block">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${v.mount_type === "SMD" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
                                  {v.mount_type}
                                </span>
                              </div>
                              <div className="hidden lg:block text-xs text-muted-foreground">{v.tolerance || "—"}</div>
                              <div className="hidden lg:block text-xs text-muted-foreground">{v.wattage || "—"}</div>

                              {/* Price inline edit */}
                              <div className="hidden lg:block">
                                {isEditingPrice ? (
                                  <input autoFocus type="number" defaultValue={v.price}
                                    onChange={e => setInlineEdit((ie: any) => ie ? { ...ie, value: e.target.value } : ie)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e: any) => e.key === "Enter" && saveInlineEdit()}
                                    className="w-full text-xs font-mono border border-secondary rounded px-1.5 py-1 bg-background focus:outline-none" />
                                ) : (
                                  <button
                                    onClick={() => setInlineEdit({ id: v.id, field: "price", value: String(v.price) })}
                                    className="text-xs font-semibold text-foreground hover:text-secondary transition-colors cursor-text"
                                    title="Click to edit price">
                                    {v.price > 0 ? `Rs.${v.price}` : <span className="text-muted-foreground">—</span>}
                                  </button>
                                )}
                              </div>

                              {/* Stock inline edit */}
                              <div className="hidden lg:block">
                                {isEditingStock ? (
                                  <input autoFocus type="number" defaultValue={v.stock_quantity}
                                    onChange={e => setInlineEdit((ie: any) => ie ? { ...ie, value: e.target.value } : ie)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e: any) => e.key === "Enter" && saveInlineEdit()}
                                    className="w-full text-xs font-mono border border-secondary rounded px-1.5 py-1 bg-background focus:outline-none" />
                                ) : (
                                  <button
                                    onClick={() => setInlineEdit({ id: v.id, field: "stock_quantity", value: String(v.stock_quantity) })}
                                    className={`text-xs font-semibold cursor-text transition-colors ${
                                      v.stock_quantity === 0 ? "text-destructive hover:text-destructive/80" :
                                      v.stock_quantity < 10 ? "text-amber-600 hover:text-amber-500" : "text-foreground hover:text-secondary"
                                    }`}
                                    title="Click to edit stock">
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
                                  }`}>
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
  );
}

export default ComponentFamilyManager;
