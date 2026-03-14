/**
 * ImageEditor — Canva-like canvas editor for admins/moderators
 * Powered by Fabric.js with layers, text, images, backgrounds, download & save
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Type, Image as ImageIcon, Square, Circle, Trash2, Download, Save,
  Layers, ChevronUp, ChevronDown, Eye, EyeOff, Lock, Unlock, Plus,
  FolderOpen, RotateCcw, Undo2, Redo2, AlignCenter, AlignLeft, AlignRight,
  Bold, Italic, Underline, Palette, Upload, Loader2, X, RefreshCw
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── System web-safe fonts ─────────────────────────────────────────────────────
const SYSTEM_FONTS = [
  "Arial", "Arial Black", "Comic Sans MS", "Courier New", "Georgia",
  "Impact", "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype",
  "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana",
  "Gill Sans", "Optima", "Futura",
];

const PRESET_SIZES = [
  { label: "Square 1080×1080", w: 1080, h: 1080 },
  { label: "Banner 1200×628", w: 1200, h: 628 },
  { label: "Story 1080×1920", w: 1080, h: 1920 },
  { label: "A4 Portrait", w: 794, h: 1123 },
  { label: "Custom…", w: 0, h: 0 },
];

const BG_PRESETS = [
  "#ffffff", "#000000", "#f3f4f6", "#1e293b",
  "#0f172a", "#16a34a", "#dc2626", "#2563eb",
  "#9333ea", "#ea580c", "#0891b2", "#be185d",
];

interface LayerItem {
  id: string;
  label: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [canvasW, setCanvasW] = useState(1080);
  const [canvasH, setCanvasH] = useState(1080);
  const [customW, setCustomW] = useState("1080");
  const [customH, setCustomH] = useState("1080");
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selected, setSelected] = useState<fabric.Object | null>(null);
  const [designName, setDesignName] = useState("Untitled Design");
  const [saving, setSaving] = useState(false);
  const [loadDialog, setLoadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const historyPaused = useRef(false);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<"layers" | "add" | "props">("add");
  const queryClient = useQueryClient();

  // Text properties
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontColor, setFontColor] = useState("#000000");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");

  // Shape properties
  const [fillColor, setFillColor] = useState("#3b82f6");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [opacity, setOpacity] = useState(100);

  // ── Saved designs ─────────────────────────────────────────────────────────
  const { data: savedDesigns, isLoading: loadingDesigns } = useQuery({
    queryKey: ["image-designs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("image_designs" as any).select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // ── Products for image picker ─────────────────────────────────────────────
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, images").order("name");
      return data || [];
    },
  });

  // ── Init canvas ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasW,
      height: canvasH,
      backgroundColor: bgColor,
      preserveObjectStacking: true,
      selection: true,
    });
    fabricRef.current = canvas;

    // Event listeners
    canvas.on("selection:created", (e) => setSelected(e.selected?.[0] || null));
    canvas.on("selection:updated", (e) => setSelected(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => setSelected(null));
    canvas.on("object:added", () => { refreshLayers(canvas); pushHistory(canvas); });
    canvas.on("object:removed", () => { refreshLayers(canvas); pushHistory(canvas); });
    canvas.on("object:modified", () => { refreshLayers(canvas); pushHistory(canvas); });

    // Push initial empty state
    pushHistory(canvas);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Sync selected object props to panel ───────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    setOpacity(Math.round((selected.opacity ?? 1) * 100));
    if (selected instanceof fabric.IText || selected instanceof fabric.Textbox) {
      setFontSize(selected.fontSize ?? 48);
      setFontFamily((selected.fontFamily as string) ?? "Arial");
      setFontColor((selected.fill as string) ?? "#000000");
      setIsBold(selected.fontWeight === "bold");
      setIsItalic(selected.fontStyle === "italic");
      setIsUnderline(selected.underline ?? false);
      setTextAlign((selected.textAlign as any) ?? "left");
      setSideTab("props");
    } else if (selected instanceof fabric.Rect || selected instanceof fabric.Circle || selected instanceof fabric.Ellipse) {
      setFillColor((selected.fill as string) ?? "#3b82f6");
      setStrokeColor((selected.stroke as string) ?? "#000000");
      setStrokeWidth(selected.strokeWidth ?? 0);
      setSideTab("props");
    }
  }, [selected]);

  // ── History helpers ───────────────────────────────────────────────────────
  const pushHistory = useCallback((canvas: fabric.Canvas) => {
    if (historyPaused.current) return;
    const json = JSON.stringify((canvas.toJSON as (ps?: string[]) => any)(["id", "locked"]));
    setHistory(prev => {
      const next = [...prev.slice(0, historyIdx + 1), json];
      setHistoryIdx(next.length - 1);
      return next;
    });
  }, [historyIdx]);

  const undo = useCallback(async () => {
    if (!fabricRef.current || historyIdx <= 0) return;
    const idx = historyIdx - 1;
    historyPaused.current = true;
    await fabricRef.current.loadFromJSON(JSON.parse(history[idx]));
    fabricRef.current.renderAll();
    refreshLayers(fabricRef.current);
    historyPaused.current = false;
    setHistoryIdx(idx);
  }, [history, historyIdx]);

  const redo = useCallback(async () => {
    if (!fabricRef.current || historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    historyPaused.current = true;
    await fabricRef.current.loadFromJSON(JSON.parse(history[idx]));
    fabricRef.current.renderAll();
    refreshLayers(fabricRef.current);
    historyPaused.current = false;
    setHistoryIdx(idx);
  }, [history, historyIdx]);

  // ── Layers ────────────────────────────────────────────────────────────────
  const refreshLayers = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects();
    setLayers(objs.map((obj, i) => ({
      id: (obj as any).id || `obj-${i}`,
      label: getObjLabel(obj, i),
      type: obj.type || "object",
      visible: obj.visible !== false,
      locked: (obj as any).locked === true,
    })).reverse());
  };

  const getObjLabel = (obj: fabric.Object, i: number) => {
    if (obj instanceof fabric.IText || obj instanceof fabric.Textbox) {
      const txt = (obj as fabric.IText).text || "";
      return `T: ${txt.substring(0, 16)}${txt.length > 16 ? "…" : ""}`;
    }
    if (obj instanceof fabric.Image) return `Image ${i + 1}`;
    if (obj instanceof fabric.Rect) return `Rectangle ${i + 1}`;
    if (obj instanceof fabric.Circle) return `Circle ${i + 1}`;
    return `Layer ${i + 1}`;
  };

  const selectByIndex = (reversedIdx: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects();
    const realIdx = objs.length - 1 - reversedIdx;
    canvas.setActiveObject(objs[realIdx]);
    canvas.renderAll();
    setSelected(objs[realIdx]);
  };

  const toggleVisibility = (reversedIdx: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects();
    const obj = objs[objs.length - 1 - reversedIdx];
    obj.set("visible", !obj.visible);
    canvas.renderAll();
    refreshLayers(canvas);
  };

  const moveLayer = (reversedIdx: number, dir: "up" | "down") => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects();
    const realIdx = objs.length - 1 - reversedIdx;
    const obj = objs[realIdx];
    if (dir === "up") canvas.bringObjectForward(obj);
    else canvas.sendObjectBackwards(obj);
    canvas.renderAll();
    refreshLayers(canvas);
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelected(null);
  };

  // ── Add elements ─────────────────────────────────────────────────────────
  const addText = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new fabric.IText("Double-click to edit", {
      left: 100, top: 100,
      fontFamily, fontSize,
      fill: fontColor,
      fontWeight: isBold ? "bold" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
    } as any);
    (text as any).id = `text-${Date.now()}`;
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const addRect = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: 100, top: 100, width: 200, height: 120,
      fill: fillColor, stroke: strokeColor,
      strokeWidth: strokeWidth, rx: 8, ry: 8,
    });
    (rect as any).id = `rect-${Date.now()}`;
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  };

  const addCircle = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const circle = new fabric.Circle({
      left: 100, top: 100, radius: 80,
      fill: fillColor, stroke: strokeColor, strokeWidth,
    });
    (circle as any).id = `circle-${Date.now()}`;
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
  };

  const addImageFromUrl = (url: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img) => {
      const maxSide = 300;
      const scale = Math.min(maxSide / (img.width || 1), maxSide / (img.height || 1));
      img.set({ left: 80, top: 80, scaleX: scale, scaleY: scale });
      (img as any).id = `img-${Date.now()}`;
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `editor/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); setUploading(false); return; }
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    setUploading(false);
    addImageFromUrl(data.publicUrl);
  };

  // ── Background ────────────────────────────────────────────────────────────
  const applyBgColor = (color: string) => {
    setBgColor(color);
    if (fabricRef.current) {
      fabricRef.current.set("backgroundColor", color);
      fabricRef.current.renderAll();
    }
  };

  const setBgImage = (url: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img) => {
      img.set({ scaleX: canvas.width! / (img.width || 1), scaleY: canvas.height! / (img.height || 1) });
      canvas.backgroundImage = img;
      canvas.renderAll();
    });
  };

  // ── Update selected props ─────────────────────────────────────────────────
  const updateSelected = (props: Record<string, any>) => {
    const canvas = fabricRef.current;
    if (!canvas || !selected) return;
    selected.set(props);
    canvas.renderAll();
    pushHistory(canvas);
  };

  // ── Canvas size ───────────────────────────────────────────────────────────
  const applyCanvasSize = (w: number, h: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setCanvasW(w); setCanvasH(h);
    canvas.setDimensions({ width: w, height: h });
    canvas.renderAll();
  };

  // ── Save design ───────────────────────────────────────────────────────────
  const saveDesign = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSaving(true);
    const canvasJson = canvas.toJSON(["id", "locked"]);
    const thumbnail = canvas.toDataURL({ format: "jpeg", quality: 0.5, multiplier: 0.2 });
    // Upload thumbnail
    let thumbUrl: string | null = null;
    try {
      const blob = await (await fetch(thumbnail)).blob();
      const path = `editor/thumbs/${Date.now()}.jpg`;
      await supabase.storage.from("images").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      const { data } = supabase.storage.from("images").getPublicUrl(path);
      thumbUrl = data.publicUrl;
    } catch { /* skip thumb on error */ }

    const payload = {
      name: designName,
      canvas_json: canvasJson as any,
      canvas_width: canvasW,
      canvas_height: canvasH,
      thumbnail_url: thumbUrl,
      updated_at: new Date().toISOString(),
    };

    if (editingDesignId) {
      const { error } = await supabase.from("image_designs" as any).update(payload).eq("id", editingDesignId);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Design saved ✓" }); queryClient.invalidateQueries({ queryKey: ["image-designs"] }); }
    } else {
      const { data, error } = await supabase.from("image_designs" as any).insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); }
      else { setEditingDesignId((data as any).id); toast({ title: "Design saved ✓" }); queryClient.invalidateQueries({ queryKey: ["image-designs"] }); }
    }
    setSaving(false);
  };

  // ── Load design ───────────────────────────────────────────────────────────
  const loadDesign = (d: any) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    historyPaused.current = true;
    canvas.loadFromJSON(d.canvas_json, () => {
      canvas.setWidth(d.canvas_width); canvas.setHeight(d.canvas_height);
      canvas.renderAll();
      refreshLayers(canvas);
      setCanvasW(d.canvas_width); setCanvasH(d.canvas_height);
      setDesignName(d.name);
      setEditingDesignId(d.id);
      setHistory([JSON.stringify(d.canvas_json)]);
      setHistoryIdx(0);
      historyPaused.current = false;
    });
    setLoadDialog(false);
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const download = (format: "png" | "jpeg") => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL({ format, quality: 1, multiplier: 1 });
    const a = document.createElement("a");
    a.href = url; a.download = `${designName}.${format}`; a.click();
  };

  const newDesign = () => {
    fabricRef.current?.clear();
    applyBgColor("#ffffff");
    setDesignName("Untitled Design");
    setEditingDesignId(null);
    setLayers([]);
    setSelected(null);
    setHistory([]);
    setHistoryIdx(-1);
  };

  // Scale factor for display (canvas may be large but we show it smaller)
  const PREVIEW_MAX = 680;
  const scale = Math.min(PREVIEW_MAX / canvasW, PREVIEW_MAX / canvasH, 1);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* ── Top toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-wrap">
        <Input
          value={designName}
          onChange={e => setDesignName(e.target.value)}
          className="h-8 text-sm font-semibold w-48 border-dashed"
        />
        <div className="flex-1" />
        {/* Size preset */}
        <Select
          value={`${canvasW}x${canvasH}`}
          onValueChange={v => {
            const preset = PRESET_SIZES.find(p => `${p.w}x${p.h}` === v);
            if (preset && preset.w > 0) applyCanvasSize(preset.w, preset.h);
          }}
        >
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Canvas size" /></SelectTrigger>
          <SelectContent>
            {PRESET_SIZES.filter(p => p.w > 0).map(p => (
              <SelectItem key={p.label} value={`${p.w}x${p.h}`}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Custom size inputs */}
        <div className="flex items-center gap-1">
          <Input value={customW} onChange={e => setCustomW(e.target.value)} className="h-8 text-xs w-16 text-center" placeholder="W" />
          <span className="text-muted-foreground text-xs">×</span>
          <Input value={customH} onChange={e => setCustomH(e.target.value)} className="h-8 text-xs w-16 text-center" placeholder="H" />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
            const w = parseInt(customW); const h = parseInt(customH);
            if (w > 0 && h > 0) applyCanvasSize(w, h);
          }}>Apply</Button>
        </div>
        <div className="h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} title="Undo" disabled={historyIdx <= 0}><Undo2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} title="Redo" disabled={historyIdx >= history.length - 1}><Redo2 className="w-4 h-4" /></Button>
        <div className="h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={newDesign} title="New Design"><RefreshCw className="w-4 h-4" /></Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setLoadDialog(true)}>
          <FolderOpen className="w-3.5 h-3.5" /> Open
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={saveDesign} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => download("png")}>
          <Download className="w-3.5 h-3.5" /> PNG
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => download("jpeg")}>
          <Download className="w-3.5 h-3.5" /> JPG
        </Button>
        {selected && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={deleteSelected} title="Delete selected">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel */}
        <div className="w-64 border-r border-border bg-card flex flex-col overflow-hidden">
          <Tabs value={sideTab} onValueChange={v => setSideTab(v as any)} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-2 mt-2 grid grid-cols-3 h-8">
              <TabsTrigger value="add" className="text-xs">Add</TabsTrigger>
              <TabsTrigger value="layers" className="text-xs">Layers</TabsTrigger>
              <TabsTrigger value="props" className="text-xs">Props</TabsTrigger>
            </TabsList>

            {/* ── Add panel ── */}
            <TabsContent value="add" className="flex-1 overflow-y-auto p-3 space-y-4 mt-0">
              {/* Text */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Text</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="text-xs gap-1 h-9" onClick={addText}>
                    <Type className="w-3.5 h-3.5" /> Add Text
                  </Button>
                </div>
              </section>

              {/* Shapes */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Shapes</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="text-xs gap-1 h-9" onClick={addRect}><Square className="w-3.5 h-3.5" /> Rectangle</Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1 h-9" onClick={addCircle}><Circle className="w-3.5 h-3.5" /> Circle</Button>
                </div>
              </section>

              {/* Upload image */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upload Image</p>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors text-center">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{uploading ? "Uploading…" : "Click to upload"}</span>
                  </div>
                </label>
              </section>

              {/* Product images */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product Images</p>
                <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
                  {(products || []).filter(p => p.images?.length).slice(0, 30).map(p => (
                    <button
                      key={p.id}
                      onClick={() => addImageFromUrl(p.images![0])}
                      className="group relative aspect-square rounded overflow-hidden border border-border hover:border-primary transition-colors"
                      title={p.name}
                    >
                      <img src={p.images![0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </button>
                  ))}
                  {!(products || []).filter(p => p.images?.length).length && (
                    <p className="col-span-3 text-xs text-muted-foreground text-center py-2">No product images</p>
                  )}
                </div>
              </section>

              {/* Background color */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Background Color</p>
                <div className="grid grid-cols-6 gap-1.5 mb-2">
                  {BG_PRESETS.map(c => (
                    <button
                      key={c}
                      onClick={() => applyBgColor(c)}
                      className={cn("w-8 h-8 rounded border-2 transition-transform hover:scale-110", bgColor === c ? "border-primary" : "border-border")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={bgColor} onChange={e => applyBgColor(e.target.value)}
                    className="h-8 w-8 rounded cursor-pointer border border-border p-0.5 bg-transparent" />
                  <Input value={bgColor} onChange={e => applyBgColor(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
              </section>

              {/* BG from URL */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Background Image (URL)</p>
                <div className="flex gap-1">
                  <Input id="bg-url" className="h-8 text-xs" placeholder="https://..." />
                  <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => {
                    const url = (document.getElementById("bg-url") as HTMLInputElement)?.value;
                    if (url) setBgImage(url);
                  }}>Set</Button>
                </div>
              </section>
            </TabsContent>

            {/* ── Layers panel ── */}
            <TabsContent value="layers" className="flex-1 overflow-y-auto p-2 mt-0">
              {layers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No layers yet. Add elements to get started.</p>
              )}
              <div className="space-y-1">
                {layers.map((layer, i) => {
                  const isActive = selected && (selected as any).id === layer.id;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => selectByIndex(i)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer group text-xs",
                        isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                      )}
                    >
                      <span className="flex-1 truncate text-foreground">{layer.label}</span>
                      <button className="opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground" onClick={e => { e.stopPropagation(); toggleVisibility(i); }}>
                        {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      <button className="opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground" onClick={e => { e.stopPropagation(); moveLayer(i, "up"); }}>
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button className="opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground" onClick={e => { e.stopPropagation(); moveLayer(i, "down"); }}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Properties panel ── */}
            <TabsContent value="props" className="flex-1 overflow-y-auto p-3 space-y-4 mt-0">
              {!selected && (
                <p className="text-xs text-muted-foreground text-center py-6">Select an object to edit its properties.</p>
              )}
              {selected && (
                <>
                  {/* Opacity */}
                  <div>
                    <Label className="text-xs mb-1 block">Opacity: {opacity}%</Label>
                    <Slider min={0} max={100} step={1} value={[opacity]} onValueChange={([v]) => { setOpacity(v); updateSelected({ opacity: v / 100 }); }} />
                  </div>

                  {/* Text props */}
                  {(selected instanceof fabric.IText || selected instanceof fabric.Textbox) && (
                    <>
                      <div>
                        <Label className="text-xs mb-1 block">Font</Label>
                        <Select value={fontFamily} onValueChange={v => { setFontFamily(v); updateSelected({ fontFamily: v }); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SYSTEM_FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Size: {fontSize}px</Label>
                        <Slider min={8} max={300} step={1} value={[fontSize]} onValueChange={([v]) => { setFontSize(v); updateSelected({ fontSize: v }); }} />
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { const b = !isBold; setIsBold(b); updateSelected({ fontWeight: b ? "bold" : "normal" }); }}
                          className={cn("flex-1 h-8 rounded border text-xs font-bold transition-colors", isBold ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>B</button>
                        <button onClick={() => { const it = !isItalic; setIsItalic(it); updateSelected({ fontStyle: it ? "italic" : "normal" }); }}
                          className={cn("flex-1 h-8 rounded border text-xs italic transition-colors", isItalic ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>I</button>
                        <button onClick={() => { const u = !isUnderline; setIsUnderline(u); updateSelected({ underline: u }); }}
                          className={cn("flex-1 h-8 rounded border text-xs underline transition-colors", isUnderline ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>U</button>
                      </div>
                      <div className="flex gap-1.5">
                        {(["left", "center", "right"] as const).map(a => (
                          <button key={a} onClick={() => { setTextAlign(a); updateSelected({ textAlign: a }); }}
                            className={cn("flex-1 h-8 rounded border flex items-center justify-center transition-colors", textAlign === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                            {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Color</Label>
                        <div className="flex gap-2">
                          <input type="color" value={fontColor} onChange={e => { setFontColor(e.target.value); updateSelected({ fill: e.target.value }); }}
                            className="h-8 w-8 rounded cursor-pointer border border-border p-0.5 bg-transparent" />
                          <Input value={fontColor} onChange={e => { setFontColor(e.target.value); updateSelected({ fill: e.target.value }); }} className="h-8 text-xs font-mono" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Shape props */}
                  {(selected instanceof fabric.Rect || selected instanceof fabric.Circle || selected instanceof fabric.Ellipse) && (
                    <>
                      <div>
                        <Label className="text-xs mb-1 block">Fill Color</Label>
                        <div className="flex gap-2">
                          <input type="color" value={fillColor} onChange={e => { setFillColor(e.target.value); updateSelected({ fill: e.target.value }); }}
                            className="h-8 w-8 rounded cursor-pointer border border-border p-0.5 bg-transparent" />
                          <Input value={fillColor} onChange={e => { setFillColor(e.target.value); updateSelected({ fill: e.target.value }); }} className="h-8 text-xs font-mono" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Stroke Color</Label>
                        <div className="flex gap-2">
                          <input type="color" value={strokeColor} onChange={e => { setStrokeColor(e.target.value); updateSelected({ stroke: e.target.value }); }}
                            className="h-8 w-8 rounded cursor-pointer border border-border p-0.5 bg-transparent" />
                          <Input value={strokeColor} onChange={e => { setStrokeColor(e.target.value); updateSelected({ stroke: e.target.value }); }} className="h-8 text-xs font-mono" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Stroke Width: {strokeWidth}px</Label>
                        <Slider min={0} max={20} step={1} value={[strokeWidth]} onValueChange={([v]) => { setStrokeWidth(v); updateSelected({ strokeWidth: v }); }} />
                      </div>
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Canvas area ── */}
        <div className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-6">
          <div className="shadow-2xl" style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: canvasW, height: canvasH }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>

      {/* ── Load designs dialog ── */}
      <Dialog open={loadDialog} onOpenChange={setLoadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5" /> Saved Designs</DialogTitle>
          </DialogHeader>
          {loadingDesigns ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !savedDesigns?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No saved designs yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {savedDesigns.map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => loadDesign(d)}
                  className="group border border-border rounded-xl overflow-hidden hover:border-primary transition-colors text-left"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    {d.thumbnail_url
                      ? <img src={d.thumbnail_url} alt={d.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      : <ImageIcon className="w-8 h-8 text-muted-foreground/40" />}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.canvas_width}×{d.canvas_height}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
