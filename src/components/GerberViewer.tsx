/**
 * GerberViewer — simple reliable 2D view: Top + Bottom side by side
 * Uses web-gerber SVG rendering only (no Three.js, no canvas baking)
 */
import { useEffect, useState, useCallback } from "react";
import { Layers, Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAYER_ROLE: Record<string, string> = {
  ".gtl": "top_copper",  ".cmp": "top_copper",  ".g1": "top_copper",
  ".gts": "top_mask",    ".stc": "top_mask",
  ".gto": "top_silk",    ".plc": "top_silk",
  ".gbl": "btm_copper",  ".sol": "btm_copper",  ".g2": "btm_copper",
  ".gbs": "btm_mask",    ".sts": "btm_mask",
  ".gbo": "btm_silk",    ".pls": "btm_silk",
  ".gko": "outline",     ".gm1": "outline",     ".gm2": "outline", ".gm3": "outline",
  ".drl": "drill",       ".xln": "drill",       ".exc": "drill",
  ".ncd": "drill",
  ".gbr": "top_copper",  ".ger": "top_copper",
};

const LAYER_STACK = [
  { role: "top_silk",   label: "Top Silk",        dot: "#ffffff" },
  { role: "top_mask",   label: "Top Solder Mask",  dot: "#22c55e" },
  { role: "top_copper", label: "Top Copper",        dot: "#f59e0b" },
  { role: "outline",    label: "Outline",           dot: "#94a3b8" },
  { role: "drill",      label: "Drill",             dot: "#64748b" },
  { role: "btm_copper", label: "Bot Copper",        dot: "#f59e0b" },
  { role: "btm_mask",   label: "Bot Solder Mask",   dot: "#22c55e" },
  { role: "btm_silk",   label: "Bot Silk",          dot: "#ffffff" },
];

const MASK_BG: Record<string, string> = {
  green: "#0d3318", red: "#2a0000", blue: "#050d2a",
  black: "#111111", white: "#cccccc", yellow: "#2a1e00",
};

type LayerMap = Record<string, string>;

interface GerberViewerProps {
  file: File;
  pcbColor?: string;
}

async function extractLayersFromZip(file: File): Promise<LayerMap> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const layers: LayerMap = {};
  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const clean = (filename.split("/").pop() || filename).toLowerCase();
    const ext = "." + clean.split(".").pop();
    const role = LAYER_ROLE[ext];
    if (!role || layers[role]) continue;
    try {
      const content = await entry.async("string");
      if (content.trim().length > 20) layers[role] = content;
    } catch { /* skip */ }
  }
  return layers;
}

/** Render a single gerber string to an SVG string */
async function gerberToSvg(gerberStr: string, fillColor: string): Promise<string | null> {
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const svg = toHtml(renderSVG(plot(parse(gerberStr))) as any);
    if (!svg || svg.length < 30) return null;
    return svg
      .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
      .replace(/stroke="[^"]*"/g, `stroke="${fillColor}"`);
  } catch {
    return null;
  }
}

/** Composite multiple SVG layers into one by overlaying them in a foreignObject-free way */
async function buildSideSvg(
  layers: LayerMap,
  side: "top" | "btm",
  maskBg: string,
): Promise<string | null> {
  const p = side;

  // Render each sub-layer
  const copperSvg = layers[`${p}_copper`] ? await gerberToSvg(layers[`${p}_copper`], "#d4a84b") : null;
  const silkSvg   = layers[`${p}_silk`]   ? await gerberToSvg(layers[`${p}_silk`],   "#f0f0f0") : null;
  const outlineSvg = layers.outline        ? await gerberToSvg(layers.outline,         "#888888") : null;

  const primary = copperSvg || silkSvg || outlineSvg;
  if (!primary) return null;

  // Extract viewBox from primary layer
  const vbMatch = primary.match(/viewBox="([^"]+)"/);
  const vb = vbMatch ? vbMatch[1] : "0 0 100 100";
  const [vx, vy, vw, vh] = vb.split(/\s+/).map(Number);

  const extract = (svgStr: string | null): string => {
    if (!svgStr) return "";
    // Pull inner content between <svg...> and </svg>
    const inner = svgStr.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
    return inner;
  };

  // Stack layers: outline → copper → silk
  const combined = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" style="background:${maskBg}; width:100%; height:100%;">
    <g opacity="0.6">${extract(outlineSvg)}</g>
    <g>${extract(copperSvg)}</g>
    <g opacity="0.85">${extract(silkSvg)}</g>
  </svg>`;

  return combined;
}

export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const [layers, setLayers] = useState<LayerMap>({});
  const [topSvg, setTopSvg]   = useState<string | null>(null);
  const [btmSvg, setBtmSvg]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState("Reading file…");
  const [error, setError]     = useState<string | null>(null);
  const [zoom, setZoom]       = useState(1);
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
      const count = Object.keys(parsed).length;

      if (count === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl / .gbl / .gko files.");
        setLoading(false);
        return;
      }

      setMsg("Rendering top side…");
      const top = await buildSideSvg(parsed, "top", maskBg);
      setTopSvg(top);

      setMsg("Rendering bottom side…");
      const btm = await buildSideSvg(parsed, "btm", maskBg);
      setBtmSvg(btm);

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
          <button onClick={() => setShowStack(s => !s)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border transition-colors ${showStack ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="w-3 h-3" /> Stack
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}><ZoomOut className="w-3.5 h-3.5" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, z + 0.2))}><ZoomIn className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)} title="Reset zoom"><span className="text-xs">1:1</span></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} title="Reload"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex">
        {/* Main 2D canvas */}
        <div className="flex-1 relative" style={{ minHeight: 360, background: "#0a0f0a" }}>

          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(10,15,10,0.96)" }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{msg}</p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6"
              style={{ background: "rgba(10,15,10,0.96)" }}>
              <AlertCircle className="w-7 h-7 text-destructive" />
              <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={load}>
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && (
            <div className="overflow-auto p-3" style={{ maxHeight: 400 }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.15s", display: "inline-flex", gap: 16 }}>
                {/* Top side */}
                <div className="flex flex-col gap-1">
                  <div className="text-center">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-green-400 border border-green-800/50" style={{ background: "rgba(34,197,94,0.08)" }}>
                      TOP
                    </span>
                  </div>
                  <div style={{ width: 280, height: 280, background: maskBg, borderRadius: 4, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {topSvg
                      ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: topSvg }} />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-muted-foreground opacity-50">No top layers</span>
                        </div>
                    }
                  </div>
                </div>

                {/* Bottom side */}
                <div className="flex flex-col gap-1">
                  <div className="text-center">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-blue-400 border border-blue-800/50" style={{ background: "rgba(96,165,250,0.08)" }}>
                      BOTTOM
                    </span>
                  </div>
                  <div style={{ width: 280, height: 280, background: maskBg, borderRadius: 4, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", transform: "scaleX(-1)" }}>
                    {btmSvg
                      ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: btmSvg }} />
                      : <div className="w-full h-full flex items-center justify-center" style={{ transform: "scaleX(-1)" }}>
                          <span className="text-xs text-muted-foreground opacity-50">No bottom layers</span>
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
            Combined 2D view · Top &amp; Bottom · Copper + Silkscreen
          </p>
        </div>
      )}
    </div>
  );
}
