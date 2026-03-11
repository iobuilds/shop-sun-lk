/**
 * GerberViewer — 2D combined view: TOP + BOTTOM side by side
 * Experimental reference-only viewer (not a final render)
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, FlaskConical } from "lucide-react";
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

const TOP_COPPER_COLOR  = "#cc0000";
const BTM_COPPER_COLOR  = "#0000cc";
const TOP_SILK_COLOR    = "#ffff00";
const BTM_SILK_COLOR    = "#ffff00";
const TOP_MASK_COLOR    = "#ff00ff";
const BTM_MASK_COLOR    = "#7f007f";
const OUTLINE_COLOR     = "#ffff00";
const DRILL_COLOR       = "#ffffff";

const MASK_BG: Record<string, string> = {
  green:  "#0d3318",
  red:    "#3a0808",
  blue:   "#081038",
  black:  "#0a0a0a",
  white:  "#c0c8c0",
  yellow: "#3a2c00",
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

function unionViewBox(boxes: string[]): string {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const vb of boxes) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length < 4 || parts.some(isNaN)) continue;
    const [x, y, w, h] = parts;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!isFinite(minX)) return "";
  const pw = (maxX - minX) * 0.02;
  const ph = (maxY - minY) * 0.02;
  return `${minX - pw} ${minY - ph} ${(maxX - minX) + pw * 2} ${(maxY - minY) + ph * 2}`;
}

async function parseSingleLayer(gerberStr: string): Promise<{ viewBox: string; inner: string } | null> {
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const rawSvg = toHtml(renderSVG(plot(parse(gerberStr), false)) as any);
    if (!rawSvg || rawSvg.length < 30) return null;
    const vbMatch = rawSvg.match(/viewBox="([^"]+)"/);
    const viewBox = vbMatch ? vbMatch[1] : "";
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

async function buildSide(layers: LayerMap, side: "top" | "btm"): Promise<SideData | null> {
  const p = side;
  const copperColor = p === "top" ? TOP_COPPER_COLOR : BTM_COPPER_COLOR;
  const silkColor   = p === "top" ? TOP_SILK_COLOR   : BTM_SILK_COLOR;
  const maskColor   = p === "top" ? TOP_MASK_COLOR   : BTM_MASK_COLOR;

  const defs: [string, string, number][] = [
    [`${p}_copper`, copperColor, 1.0],
    [`${p}_mask`,   maskColor,   0.25],
    [`${p}_silk`,   silkColor,   1.0],
    ["outline",     OUTLINE_COLOR, 0.9],
    ["drill",       DRILL_COLOR,   1.0],
  ];

  const allViewBoxes: string[] = [];
  const rendered: SideData["layers"] = [];

  for (const [role, color, opacity] of defs) {
    const gerberStr = layers[role];
    if (!gerberStr) continue;
    const parsed = await parseSingleLayer(gerberStr);
    if (!parsed) continue;
    if (parsed.viewBox) allViewBoxes.push(parsed.viewBox);
    rendered.push({ svg: parsed.inner, color, opacity });
  }

  if (rendered.length === 0) return null;
  const sharedViewBox = unionViewBox(allViewBoxes);
  if (!sharedViewBox) return null;
  return { viewBox: sharedViewBox, layers: rendered };
}

function composeSvg(data: SideData, maskBg: string): string {
  const layerMarkup = data.layers
    .map(l => `<g fill="${l.color}" stroke="${l.color}" stroke-width="0" opacity="${l.opacity}">${l.svg}</g>`)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" 
    style="width:100%;height:100%;background:${maskBg};"
    preserveAspectRatio="xMidYMid meet">
    ${layerMarkup}
  </svg>`;
}

export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const [topSvg,  setTopSvg]  = useState<string | null>(null);
  const [btmSvg,  setBtmSvg]  = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState("Reading file…");
  const [error,   setError]   = useState<string | null>(null);
  const [zoom,    setZoom]    = useState(1);

  const colorKey = (pcbColor || "green").toLowerCase();
  const maskBg   = MASK_BG[colorKey] ?? MASK_BG.green;

  const load = useCallback(async () => {
    setLoading(true); setError(null); setTopSvg(null); setBtmSvg(null);
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
      if (Object.keys(parsed).length === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl / .gbl / .gko files.");
        setLoading(false); return;
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

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Experimental disclaimer banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-700 dark:text-yellow-400">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" />
        <p className="text-xs font-medium">
          Experimental preview — for reference only. Colours and layout may not match final manufactured boards.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground">PCB 2D Preview · {file.name}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)))}><ZoomOut className="w-3.5 h-3.5" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(1)))}><ZoomIn className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)} title="Reset zoom">
            <span className="text-[10px] font-mono">1:1</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} title="Reload"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-auto" style={{ minHeight: 380, background: "#050b05" }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(5,11,5,0.97)" }}>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">{msg}</p>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6"
            style={{ background: "rgba(5,11,5,0.97)" }}>
            <AlertCircle className="w-7 h-7 text-destructive" />
            <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={load}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}
        {!loading && !error && (
          <div className="p-4 overflow-auto">
            <div style={{ display: "inline-flex", gap: 24, transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.15s" }}>
              {/* TOP */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold px-3 py-0.5 rounded-full border"
                  style={{ color: "#ff6060", borderColor: "rgba(255,96,96,0.35)", background: "rgba(255,96,96,0.1)" }}>
                  TOP
                </span>
                <div style={{ width: 320, height: 320, background: maskBg, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 20px rgba(0,0,0,0.7)" }}>
                  {topSvg
                    ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: topSvg }} />
                    : <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs opacity-40" style={{ color: "#aaa" }}>No top layers</span>
                      </div>
                  }
                </div>
              </div>
              {/* BOTTOM (mirrored) */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold px-3 py-0.5 rounded-full border"
                  style={{ color: "#6090ff", borderColor: "rgba(96,144,255,0.35)", background: "rgba(96,144,255,0.1)" }}>
                  BOTTOM
                </span>
                <div style={{ width: 320, height: 320, background: maskBg, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 20px rgba(0,0,0,0.7)", transform: "scaleX(-1)" }}>
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

      {/* Color legend */}
      {!loading && !error && (
        <div className="px-3 py-1.5 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><span style={{ color: TOP_COPPER_COLOR }}>■</span> Top Cu</span>
            <span className="flex items-center gap-1"><span style={{ color: BTM_COPPER_COLOR }}>■</span> Bot Cu</span>
            <span className="flex items-center gap-1"><span style={{ color: TOP_SILK_COLOR }}>■</span> Silk</span>
            <span className="flex items-center gap-1"><span style={{ color: TOP_MASK_COLOR }}>■</span> Mask</span>
            <span className="flex items-center gap-1"><span style={{ color: DRILL_COLOR }}>■</span> Drill</span>
          </p>
        </div>
      )}
    </div>
  );
}
