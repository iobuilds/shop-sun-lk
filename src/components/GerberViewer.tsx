/**
 * GerberViewer — 2D combined view: TOP + BOTTOM side by side
 * Each layer rendered as absolute-positioned overlay for correct alignment
 */
import { useEffect, useState, useCallback } from "react";
import {
  Layers, Loader2, AlertCircle, RefreshCw,
  ZoomIn, ZoomOut, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Layer extension → role ────────────────────────────────────────────────
const LAYER_ROLE: Record<string, string> = {
  ".gtl": "top_copper",  ".cmp": "top_copper",  ".g1": "top_copper",
  ".gts": "top_mask",    ".stc": "top_mask",
  ".gto": "top_silk",    ".plc": "top_silk",
  ".gbl": "btm_copper",  ".sol": "btm_copper",  ".g2": "btm_copper",
  ".gbs": "btm_mask",    ".sts": "btm_mask",
  ".gbo": "btm_silk",    ".pls": "btm_silk",
  ".gko": "outline",     ".gm1": "outline",     ".gm2": "outline", ".gm3": "outline",
  ".drl": "drill",       ".xln": "drill",       ".exc": "drill",   ".ncd": "drill",
  ".gbr": "top_copper",  ".ger": "top_copper",
};

const LAYER_STACK = [
  { role: "top_silk",   label: "Top Silk",        dot: "#ffffff" },
  { role: "top_mask",   label: "Top Solder Mask",  dot: "#22c55e" },
  { role: "top_copper", label: "Top Copper",        dot: "#fbbf24" },
  { role: "outline",    label: "Outline",           dot: "#94a3b8" },
  { role: "drill",      label: "Drill",             dot: "#64748b" },
  { role: "btm_copper", label: "Bot Copper",        dot: "#fbbf24" },
  { role: "btm_mask",   label: "Bot Solder Mask",   dot: "#22c55e" },
  { role: "btm_silk",   label: "Bot Silk",          dot: "#ffffff" },
];

// Mask board background colors
const MASK_BG: Record<string, string> = {
  green:  "#0e3d1a",
  red:    "#3d0a0a",
  blue:   "#0a1040",
  black:  "#111111",
  white:  "#c8c8c8",
  yellow: "#3d2d00",
};

type LayerMap = Record<string, string>;

interface SideData {
  viewBox: string;
  layers: { svg: string; color: string; opacity: number }[];
}

interface GerberViewerProps {
  file: File;
  pcbColor?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────

async function extractLayersFromZip(file: File): Promise<LayerMap> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const result: LayerMap = {};
  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const clean = (filename.split("/").pop() || filename).toLowerCase();
    const ext = "." + clean.split(".").pop();
    const role = LAYER_ROLE[ext];
    if (!role || result[role]) continue;
    try {
      const content = await entry.async("string");
      if (content.trim().length > 20) result[role] = content;
    } catch { /* skip */ }
  }
  return result;
}

/** Parse a gerber string → extract its viewBox and raw inner SVG content */
async function parseSingleLayer(gerberStr: string): Promise<{ viewBox: string; inner: string } | null> {
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const rawSvg = toHtml(renderSVG(plot(parse(gerberStr), false)) as any);
    if (!rawSvg || rawSvg.length < 30) return null;

    // Extract viewBox
    const vbMatch = rawSvg.match(/viewBox="([^"]+)"/);
    const viewBox = vbMatch ? vbMatch[1] : "";

    // Extract inner content (strip outer <svg> tag)
    const inner = rawSvg
      .replace(/<\?xml[^>]*\?>/, "")
      .replace(/<!DOCTYPE[^>]*>/, "")
      .replace(/<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .trim();

    return { viewBox, inner };
  } catch {
    return null;
  }
}

/** Build a composite SideData for one PCB face */
async function buildSide(layers: LayerMap, side: "top" | "btm"): Promise<SideData | null> {
  const p = side;

  // layer definitions: [role, fill color, opacity]
  const defs: [string, string, number][] = [
    [`${p}_copper`, "#ffc94d", 1.0],   // bright gold copper
    [`${p}_mask`,   "#1a6b2e", 0.35],  // translucent mask over copper
    [`${p}_silk`,   "#ffffff", 1.0],   // pure white silk
    ["outline",     "#ccddcc", 0.7],   // light outline
    ["drill",       "#000000", 1.0],   // black drills
  ];

  // Find the best viewBox (prefer copper or outline)
  let sharedViewBox = "";
  const rendered: { svg: string; color: string; opacity: number }[] = [];

  for (const [role, color, opacity] of defs) {
    const gerberStr = layers[role];
    if (!gerberStr) continue;
    const parsed = await parseSingleLayer(gerberStr);
    if (!parsed) continue;
    if (!sharedViewBox && parsed.viewBox) sharedViewBox = parsed.viewBox;
    rendered.push({ svg: parsed.inner, color, opacity });
  }

  if (rendered.length === 0 || !sharedViewBox) return null;
  return { viewBox: sharedViewBox, layers: rendered };
}

/** Compose all rendered layers into one <svg> string */
function composeSvg(data: SideData, maskBg: string): string {
  const layerMarkup = data.layers
    .map(l => `<g fill="${l.color}" stroke="${l.color}" opacity="${l.opacity}">${l.svg}</g>`)
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" 
    style="width:100%;height:100%;background:${maskBg};"
    preserveAspectRatio="xMidYMid meet">
    ${layerMarkup}
  </svg>`;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const [layers,    setLayers]    = useState<LayerMap>({});
  const [topSvg,    setTopSvg]    = useState<string | null>(null);
  const [btmSvg,    setBtmSvg]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState("Reading file…");
  const [error,     setError]     = useState<string | null>(null);
  const [zoom,      setZoom]      = useState(1);
  const [showStack, setShowStack] = useState(true);

  const colorKey = (pcbColor || "green").toLowerCase();
  const maskBg   = MASK_BG[colorKey] ?? MASK_BG.green;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTopSvg(null);
    setBtmSvg(null);
    setMsg("Extracting Gerber layers…");

    try {
      let parsed: LayerMap = {};
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (ext === ".zip" || ext === ".rar") {
        parsed = await extractLayersFromZip(file);
      } else {
        const txt = await file.text();
        parsed[LAYER_ROLE[ext] ?? "top_copper"] = txt;
      }

      setLayers(parsed);

      if (Object.keys(parsed).length === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl / .gbl / .gko files.");
        setLoading(false);
        return;
      }

      setMsg("Rendering top side…");
      const topData = await buildSide(parsed, "top");
      if (topData) setTopSvg(composeSvg(topData, maskBg));

      setMsg("Rendering bottom side…");
      const btmData = await buildSide(parsed, "btm");
      if (btmData) setBtmSvg(composeSvg(btmData, maskBg));

      setLoading(false);
    } catch (err: any) {
      setError("Parse error: " + (err?.message ?? "unknown"));
      setLoading(false);
    }
  }, [file, maskBg]);

  useEffect(() => { load(); }, [file]); // eslint-disable-line

  const layerCount = Object.keys(layers).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">PCB Preview</span>
          {layerCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {layerCount} layer{layerCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStack(s => !s)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border transition-colors ${showStack ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="w-3 h-3" /> Stack
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)))}><ZoomOut className="w-3.5 h-3.5" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(1)))}><ZoomIn className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)} title="Reset zoom">
            <span className="text-[10px] font-mono">1:1</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} title="Reload"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Viewer area */}
      <div className="flex">
        {/* PCB canvas */}
        <div className="flex-1 relative overflow-auto" style={{ minHeight: 380, background: "#080e08" }}>

          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(8,14,8,0.97)" }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{msg}</p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6"
              style={{ background: "rgba(8,14,8,0.97)" }}>
              <AlertCircle className="w-7 h-7 text-destructive" />
              <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={load}>
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && (
            <div className="p-4 overflow-auto" style={{ maxHeight: 400 }}>
              <div style={{ display: "inline-flex", gap: 20, transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.15s" }}>

                {/* TOP */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold px-3 py-0.5 rounded-full border"
                    style={{ color: "#4ade80", borderColor: "rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)" }}>
                    TOP
                  </span>
                  <div style={{ width: 300, height: 300, background: maskBg, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 0 16px rgba(0,0,0,0.6)" }}>
                    {topSvg
                      ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: topSvg }} />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs opacity-40" style={{ color: "#aaa" }}>No top layers</span>
                        </div>
                    }
                  </div>
                </div>

                {/* BOTTOM (mirrored horizontally) */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold px-3 py-0.5 rounded-full border"
                    style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)" }}>
                    BOTTOM
                  </span>
                  <div style={{ width: 300, height: 300, background: maskBg, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 0 16px rgba(0,0,0,0.6)", transform: "scaleX(-1)" }}>
                    {btmSvg
                      ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: btmSvg }} />
                      : <div className="w-full h-full flex items-center justify-center" style={{ transform: "scaleX(-1)" }}>
                          <span className="text-xs opacity-40" style={{ color: "#aaa" }}>No bottom layers</span>
                        </div>
                    }
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Layer stack sidebar */}
        {showStack && (
          <div className="w-44 border-l border-border bg-muted/20 flex flex-col shrink-0" style={{ maxHeight: 400 }}>
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-primary" /> Gerber Stack
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {LAYER_STACK.map((l, i) => {
                const present = !!layers[l.role];
                return (
                  <div key={l.role} className={`flex items-center gap-2 px-3 py-1.5 ${present ? "" : "opacity-30"}`}>
                    <span className="text-[10px] text-muted-foreground w-3 shrink-0 font-mono">{i + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ background: present ? l.dot : "#374151" }} />
                    <span className="text-[11px] text-foreground leading-tight flex-1">{l.label}</span>
                    {present
                      ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      : <XCircle className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                    }
                  </div>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">{layerCount}/{LAYER_STACK.length} detected</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="px-3 py-1.5 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            2D combined view · Copper <span style={{ color: "#ffc94d" }}>■</span> &nbsp; Silk <span style={{ color: "#ffffff" }}>■</span> &nbsp; Outline <span style={{ color: "#aaa" }}>■</span>
          </p>
        </div>
      )}
    </div>
  );
}
