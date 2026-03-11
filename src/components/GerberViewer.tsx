import { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers, Loader2, AlertCircle, RotateCcw, Box, RefreshCw,
  ZoomIn, ZoomOut, CheckCircle2, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Layer role mapping ────────────────────────────────────────────────────
const LAYER_ROLE: Record<string, string> = {
  ".gtl": "top_copper",  ".cmp": "top_copper",  ".g1": "top_copper",
  ".gts": "top_mask",    ".stc": "top_mask",
  ".gto": "top_silk",    ".plc": "top_silk",
  ".gbl": "btm_copper",  ".sol": "btm_copper",  ".g2": "btm_copper",
  ".gbs": "btm_mask",    ".sts": "btm_mask",
  ".gbo": "btm_silk",    ".pls": "btm_silk",
  ".gko": "outline",     ".gm1": "outline",     ".gm2": "outline", ".gm3": "outline",
  ".drl": "drill",       ".xln": "drill",       ".exc": "drill",
  ".ncd": "drill",       ".txt": "drill",
  ".gbr": "top_copper",  ".ger": "top_copper",
};

// ─── Layer stack definition (for sidebar display) ─────────────────────────
const LAYER_STACK = [
  { role: "top_silk",   label: "Top Silkscreen",  color: "#e0e0e0", dot: "#ffffff" },
  { role: "top_mask",   label: "Top Solder Mask",  color: "#1a6b2e", dot: "#22c55e" },
  { role: "top_copper", label: "Top Copper",        color: "#d4a84b", dot: "#f59e0b" },
  { role: "outline",    label: "Board Outline",     color: "#888888", dot: "#94a3b8" },
  { role: "drill",      label: "Drill",             color: "#555555", dot: "#64748b" },
  { role: "btm_copper", label: "Bot Copper",        color: "#d4a84b", dot: "#f59e0b" },
  { role: "btm_mask",   label: "Bot Solder Mask",  color: "#1a6b2e", dot: "#22c55e" },
  { role: "btm_silk",   label: "Bot Silkscreen",   color: "#e0e0e0", dot: "#ffffff" },
];

const MASK_HEX: Record<string, string> = {
  green:  "#1a6b2e", red: "#8b0000", blue: "#0a3d8f",
  black:  "#1a1a1a", white: "#e8e8e8", yellow: "#b8860b",
};

const MASK_NUM: Record<string, number> = {
  green:  0x1a6b2e, red: 0x8b0000, blue: 0x0a3d8f,
  black:  0x1a1a1a, white: 0xe8e8e8, yellow: 0xb8860b,
};

type LayerMap = Record<string, string>;

interface GerberViewerProps {
  file: File;
  pcbColor?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────

async function extractLayersFromZip(file: File): Promise<LayerMap> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const layers: LayerMap = {};
  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const clean = (filename.split("/").pop() || filename).toLowerCase();
    const ext = "." + clean.split(".").pop();
    const role = LAYER_ROLE[ext];
    if (!role || layers[role]) continue;
    try {
      const content = await zipEntry.async("string");
      if (content.trim().length > 20) layers[role] = content;
    } catch { /* skip binary */ }
  }
  return layers;
}

/** Render a single Gerber layer to a canvas with transparent background + colored traces */
async function renderLayerToCanvas(
  gerberStr: string,
  w: number, h: number,
  traceColor: string,
): Promise<HTMLCanvasElement | null> {
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const parsed = parse(gerberStr);
    const plotted = plot(parsed, false);
    const svgTree = renderSVG(plotted);
    let svgStr = toHtml(svgTree as any);
    if (!svgStr || svgStr.length < 30) return null;

    svgStr = svgStr
      .replace(/<svg([^>]*)>/, (m, attrs) => {
        let a = attrs
          .replace(/width="[^"]*"/, `width="${w}"`)
          .replace(/height="[^"]*"/, `height="${h}"`);
        if (!/width="/.test(a)) a += ` width="${w}"`;
        if (!/height="/.test(a)) a += ` height="${h}"`;
        return `<svg${a}>`;
      })
      .replace(/fill="[^"]*"/g, `fill="${traceColor}"`)
      .replace(/stroke="[^"]*"/g, `stroke="${traceColor}"`);

    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg img load fail"));
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas;
  } catch {
    return null;
  }
}

/** Build a composite face texture by stacking multiple Gerber layers */
async function buildFaceTexture(
  layers: LayerMap,
  side: "top" | "btm",
  maskHex: string,
  size = 1024,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // 1. Solder mask base
  ctx.fillStyle = maskHex;
  ctx.fillRect(0, 0, size, size);

  const prefix = side === "top" ? "top" : "btm";

  // 2. Copper traces (gold)
  const copperLayer = layers[`${prefix}_copper`];
  if (copperLayer) {
    const c = await renderLayerToCanvas(copperLayer, size, size, "#d4a84b");
    if (c) ctx.drawImage(c, 0, 0);
  }

  // 3. Mask highlights
  const maskLayer = layers[`${prefix}_mask`];
  if (maskLayer) {
    const c = await renderLayerToCanvas(maskLayer, size, size, "#e8c060");
    if (c) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(c, 0, 0);
      ctx.globalAlpha = 1.0;
    }
  }

  // 4. Silkscreen
  const silkLayer = layers[`${prefix}_silk`];
  if (silkLayer) {
    const c = await renderLayerToCanvas(silkLayer, size, size, "#ffffff");
    if (c) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(c, 0, 0);
      ctx.globalAlpha = 1.0;
    }
  }

  return canvas;
}

/** Build a 2D composite SVG string */
async function buildComposite2dSvg(layers: LayerMap, maskHex: string): Promise<string | null> {
  const primary = layers.top_copper || layers.btm_copper || layers.outline;
  if (!primary) return null;
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const parsed = parse(primary);
    const plotted = plot(parsed, false);
    const svgTree = renderSVG(plotted);
    let svgStr = toHtml(svgTree as any);
    if (!svgStr) return null;
    return svgStr
      .replace(/<svg/, `<svg style="background:${maskHex};"`)
      .replace(/fill="[^"]*"/g, 'fill="#d4a84b"')
      .replace(/stroke="[^"]*"/g, 'stroke="#d4a84b"');
  } catch { return null; }
}

/** Get board dimensions from outline layer */
async function getBoardDimensions(outlineStr: string | undefined): Promise<{ w: number; d: number }> {
  const fallback = { w: 80, d: 60 };
  if (!outlineStr) return fallback;
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const svg = toHtml(renderSVG(plot(parse(outlineStr), true)) as any);
    const m = svg.match(/viewBox="([^"]+)"/);
    if (!m) return fallback;
    const [, , , vw, vh] = m[1].split(/\s+/).map(Number);
    if (!vw || !vh) return fallback;
    const scale = 90 / Math.max(vw, vh);
    return { w: vw * scale, d: vh * scale };
  } catch { return fallback; }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const container3dRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const animRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerMap>({});
  const [view, setView] = useState<"2d" | "3d">("3d");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [zoom2d, setZoom2d] = useState(1);
  const [showStack, setShowStack] = useState(true);

  const colorKey = (pcbColor || "green").toLowerCase();
  const maskHex = MASK_HEX[colorKey] ?? MASK_HEX.green;
  const maskNum = MASK_NUM[colorKey] ?? MASK_NUM.green;

  const destroy3d = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (rendererRef.current) {
      try { rendererRef.current.dispose?.(); } catch {}
      rendererRef.current = null;
    }
    if (container3dRef.current) container3dRef.current.innerHTML = "";
  }, []);

  // ── Load + parse layers ──────────────────────────────────────────────────
  const loadLayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSvgContent(null);
    destroy3d();

    try {
      let parsed: LayerMap = {};
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (ext === ".zip" || ext === ".rar") {
        parsed = await extractLayersFromZip(file);
      } else {
        const content = await file.text();
        parsed[LAYER_ROLE[ext] ?? "top_copper"] = content;
      }

      const count = Object.keys(parsed).length;
      setLayers(parsed);

      if (count === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl / .gbl / .gko files.");
        setLoading(false);
        return;
      }

      const svg2d = await buildComposite2dSvg(parsed, maskHex);
      setSvgContent(svg2d);
      setLoading(false);
    } catch (err: any) {
      setError("Parse error: " + (err?.message || "unknown"));
      setLoading(false);
    }
  }, [file, maskHex, destroy3d]);

  // ── Build 3D scene (solid combined view only) ───────────────────────────
  const init3d = useCallback(async (layerData: LayerMap) => {
    if (!container3dRef.current || Object.keys(layerData).length === 0) return;
    setLoading(true);
    destroy3d();

    try {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js" as any);

      const W = container3dRef.current.clientWidth || 600;
      const H = 380;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x0d1117, 1);
      renderer.shadowMap.enabled = true;
      container3dRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000);
      camera.position.set(0, 60, 110);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = 15;
      controls.maxDistance = 400;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(60, 100, 60); sun.castShadow = true; scene.add(sun);
      const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
      fill.position.set(-40, -30, -40); scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffeecc, 0.25);
      rim.position.set(0, -60, 80); scene.add(rim);

      // Board dimensions
      const { w: boardW, d: boardD } = await getBoardDimensions(layerData.outline);
      const boardH = 1.6;

      // Build composite textures for both faces
      const [topCanvas, btmCanvas] = await Promise.all([
        buildFaceTexture(layerData, "top", maskHex, 1024),
        buildFaceTexture(layerData, "btm", maskHex, 1024),
      ]);

      const topTex = new THREE.CanvasTexture(topCanvas);
      const btmTex = new THREE.CanvasTexture(btmCanvas);

      const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.1 });
      const btmMat = new THREE.MeshStandardMaterial({ map: btmTex, roughness: 0.4, metalness: 0.1 });
      const sideMat = new THREE.MeshStandardMaterial({ color: 0xd4c48a, roughness: 0.85 });

      const boardGeo = new THREE.BoxGeometry(boardW, boardH, boardD);
      const board = new THREE.Mesh(boardGeo, [
        sideMat, sideMat,
        topMat,
        btmMat,
        sideMat, sideMat,
      ]);
      board.castShadow = true;
      board.receiveShadow = true;
      scene.add(board);

      // Copper rim bevel
      const rimGeo = new THREE.BoxGeometry(boardW + 0.4, boardH + 0.3, boardD + 0.4);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xb8860b, roughness: 0.9, transparent: true, opacity: 0.1
      });
      scene.add(new THREE.Mesh(rimGeo, rimMat));

      // Grid floor
      const grid = new THREE.GridHelper(500, 40, 0x1a2a3a, 0x0f1a22);
      grid.position.y = -15;
      scene.add(grid);

      // Animate
      const animate = () => {
        animRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Resize observer
      const ro = new ResizeObserver(() => {
        const w = container3dRef.current?.clientWidth || W;
        renderer.setSize(w, H);
        camera.aspect = w / H;
        camera.updateProjectionMatrix();
      });
      if (container3dRef.current) ro.observe(container3dRef.current);

      setLoading(false);
    } catch (err: any) {
      console.error("3D init error:", err);
      setError("3D render failed. Switching to 2D.");
      setView("2d");
      setLoading(false);
    }
  }, [maskHex, destroy3d]);

  useEffect(() => {
    loadLayers();
    return destroy3d;
  }, [file]); // eslint-disable-line

  useEffect(() => {
    if (view === "3d" && Object.keys(layers).length > 0 && !loading) {
      init3d(layers);
    } else if (view === "2d") {
      destroy3d();
    }
  }, [view, layers]); // eslint-disable-line

  useEffect(() => {
    if (!loading && view === "3d" && Object.keys(layers).length > 0) {
      init3d(layers);
    }
  }, [loading]); // eslint-disable-line

  const layerCount = Object.keys(layers).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">PCB Preview</span>
          {layerCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {layerCount} layer{layerCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 2D / 3D toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("2d")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${view === "2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              2D
            </button>
            <button onClick={() => setView("3d")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${view === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              3D
            </button>
          </div>

          {/* Layer stack toggle */}
          <button
            onClick={() => setShowStack(s => !s)}
            title="Toggle layer stack"
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border transition-colors ml-1 ${showStack ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="w-3 h-3" /> Stack
          </button>

          {/* 2D zoom controls */}
          {view === "2d" && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom2d(z => Math.max(0.2, z - 0.25))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom2d * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom2d(z => Math.min(5, z + 0.25))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </>
          )}

          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
            if (view === "2d") setZoom2d(1);
            else { destroy3d(); init3d(layers); }
          }} title="Reset view">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadLayers} title="Reload file">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Main content: viewer + layer stack ── */}
      <div className="flex">
        {/* ── Viewport ── */}
        <div className="relative flex-1" style={{ height: 400, background: "#0d1117" }}>

          {/* 3D canvas */}
          <div ref={container3dRef} className={`absolute inset-0 w-full h-full ${view !== "3d" ? "hidden" : ""}`} />

          {/* 2D SVG view */}
          {view === "2d" && svgContent && !loading && (
            <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4"
              style={{ background: "#0a180f" }}>
              <div
                style={{ transform: `scale(${zoom2d})`, transformOrigin: "center", transition: "transform 0.15s" }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20"
              style={{ background: "rgba(13,17,23,0.96)" }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Building PCB preview…</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 z-20"
              style={{ background: "rgba(13,17,23,0.96)" }}>
              <AlertCircle className="w-7 h-7 text-destructive" />
              <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadLayers}>
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            </div>
          )}

          {/* 2D empty state */}
          {view === "2d" && !svgContent && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No preview available</p>
            </div>
          )}

          {/* PCB color chip */}
          {!loading && !error && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1 z-10">
              <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: maskHex }} />
              <span className="text-xs text-white/70">{pcbColor}</span>
            </div>
          )}
        </div>

        {/* ── Layer Stack Panel ── */}
        {showStack && (
          <div className="w-48 border-l border-border bg-muted/20 flex flex-col" style={{ height: 400 }}>
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-primary" />
                Gerber Stack
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {LAYER_STACK.map((layer, i) => {
                const present = !!layers[layer.role];
                return (
                  <div key={layer.role} className={`flex items-center gap-2 px-3 py-1.5 ${present ? "" : "opacity-35"}`}>
                    {/* Order number */}
                    <span className="text-[10px] text-muted-foreground w-3 shrink-0 font-mono">{i + 1}</span>
                    {/* Color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ background: present ? layer.dot : "#374151" }}
                    />
                    {/* Label */}
                    <span className="text-[11px] text-foreground leading-tight flex-1">{layer.label}</span>
                    {/* Present indicator */}
                    {present
                      ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      : <XCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    }
                  </div>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                {layerCount} / {LAYER_STACK.length} layers detected
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer hint ── */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {view === "3d"
              ? "All layers composited · Drag to rotate · Scroll to zoom"
              : "Top copper + silkscreen · 2D flat view"}
          </p>
        </div>
      )}
    </div>
  );
}
