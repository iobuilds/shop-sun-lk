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

// ─── Layer stack for sidebar ──────────────────────────────────────────────
const LAYER_STACK = [
  { role: "top_silk",   label: "Top Silkscreen",  dot: "#ffffff" },
  { role: "top_mask",   label: "Top Solder Mask", dot: "#22c55e" },
  { role: "top_copper", label: "Top Copper",       dot: "#f59e0b" },
  { role: "outline",    label: "Board Outline",    dot: "#94a3b8" },
  { role: "drill",      label: "Drill",            dot: "#64748b" },
  { role: "btm_copper", label: "Bot Copper",       dot: "#f59e0b" },
  { role: "btm_mask",   label: "Bot Solder Mask",  dot: "#22c55e" },
  { role: "btm_silk",   label: "Bot Silkscreen",   dot: "#ffffff" },
];

const MASK_HEX: Record<string, string> = {
  green: "#1a6b2e", red: "#8b0000", blue: "#0a3d8f",
  black: "#1a1a1a", white: "#e8e8e8", yellow: "#b8860b",
};
const MASK_NUM: Record<string, number> = {
  green: 0x1a6b2e, red: 0x8b0000, blue: 0x0a3d8f,
  black: 0x1a1a1a, white: 0xe8e8e8, yellow: 0xb8860b,
};

type LayerMap = Record<string, string>;

interface GerberViewerProps {
  file: File;
  pcbColor?: string;
}

// ─── Yield to browser between tasks ───────────────────────────────────────
function yieldFrame(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

// ─── Per-operation timeout wrapper ────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

// ─── Extract layers from ZIP (low memory: text only) ──────────────────────
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
      const content = await withTimeout(zipEntry.async("string"), 5000);
      if (content.trim().length > 20) layers[role] = content;
    } catch { /* skip */ }
    await yieldFrame(); // yield between each file
  }
  return layers;
}

/** Render a single Gerber layer to canvas — with 8s timeout & yield */
async function renderLayerToCanvas(
  gerberStr: string,
  w: number, h: number,
  traceColor: string,
): Promise<HTMLCanvasElement | null> {
  // Truncate very large files to prevent freeze
  const MAX_CHARS = 300_000;
  const src = gerberStr.length > MAX_CHARS ? gerberStr.slice(0, MAX_CHARS) : gerberStr;

  try {
    await yieldFrame();
    const renderWork = async () => {
      const { parse, plot, renderSVG } = await import("web-gerber");
      const { toHtml } = await import("hast-util-to-html");

      await yieldFrame();
      const parsed = parse(src);
      await yieldFrame();
      const plotted = plot(parsed, false);
      await yieldFrame();
      const svgTree = renderSVG(plotted);
      await yieldFrame();
      let svgStr = toHtml(svgTree as any);
      if (!svgStr || svgStr.length < 30) return null;

      svgStr = svgStr
        .replace(/<svg([^>]*)>/, (_m, attrs) => {
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
        img.onerror = () => rej(new Error("img load fail"));
        setTimeout(() => rej(new Error("img timeout")), 6000);
        img.src = url;
      });
      URL.revokeObjectURL(url);
      await yieldFrame();

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      return canvas;
    };

    return await withTimeout(renderWork(), 12000);
  } catch (e) {
    console.warn("Layer render skipped:", (e as Error).message);
    return null;
  }
}

/** Build composite face texture — reduced to 512px to avoid OOM */
async function buildFaceTexture(
  layers: LayerMap,
  side: "top" | "btm",
  maskHex: string,
  size = 512,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = maskHex;
  ctx.fillRect(0, 0, size, size);

  const prefix = side === "top" ? "top" : "btm";

  const copper = layers[`${prefix}_copper`];
  if (copper) {
    const c = await renderLayerToCanvas(copper, size, size, "#d4a84b");
    if (c) ctx.drawImage(c, 0, 0);
  }
  await yieldFrame();

  const mask = layers[`${prefix}_mask`];
  if (mask) {
    const c = await renderLayerToCanvas(mask, size, size, "#e8c060");
    if (c) { ctx.globalAlpha = 0.35; ctx.drawImage(c, 0, 0); ctx.globalAlpha = 1; }
  }
  await yieldFrame();

  const silk = layers[`${prefix}_silk`];
  if (silk) {
    const c = await renderLayerToCanvas(silk, size, size, "#ffffff");
    if (c) { ctx.globalAlpha = 0.85; ctx.drawImage(c, 0, 0); ctx.globalAlpha = 1; }
  }

  return canvas;
}

/** Build 2D SVG — uses only top_copper/outline */
async function buildComposite2dSvg(layers: LayerMap, maskHex: string): Promise<string | null> {
  const primary = layers.top_copper || layers.btm_copper || layers.outline;
  if (!primary) return null;
  try {
    await yieldFrame();
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    await yieldFrame();
    const parsed = parse(primary.length > 200_000 ? primary.slice(0, 200_000) : primary);
    await yieldFrame();
    const plotted = plot(parsed, false);
    await yieldFrame();
    const svgTree = renderSVG(plotted);
    await yieldFrame();
    let svgStr = toHtml(svgTree as any);
    if (!svgStr) return null;
    return svgStr
      .replace(/<svg/, `<svg style="background:${maskHex};"`)
      .replace(/fill="[^"]*"/g, 'fill="#d4a84b"')
      .replace(/stroke="[^"]*"/g, 'stroke="#d4a84b"');
  } catch { return null; }
}

/** Get board dimensions from outline */
async function getBoardDimensions(outlineStr: string | undefined): Promise<{ w: number; d: number }> {
  const fallback = { w: 80, d: 60 };
  if (!outlineStr) return fallback;
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    await yieldFrame();
    const svg = toHtml(renderSVG(plot(parse(outlineStr), true)) as any);
    const m = svg.match(/viewBox="([^"]+)"/);
    if (!m) return fallback;
    const parts = m[1].split(/\s+/).map(Number);
    const vw = parts[2], vh = parts[3];
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
  const abortRef = useRef<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Reading Gerber file…");
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
    abortRef.current = false;
    setLoading(true);
    setLoadingMsg("Reading Gerber file…");
    setError(null);
    setSvgContent(null);
    destroy3d();

    try {
      let parsed: LayerMap = {};
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (ext === ".zip" || ext === ".rar") {
        setLoadingMsg("Extracting layers from ZIP…");
        parsed = await withTimeout(extractLayersFromZip(file), 30000);
      } else {
        const content = await withTimeout(file.text(), 5000);
        parsed[LAYER_ROLE[ext] ?? "top_copper"] = content;
      }

      if (abortRef.current) return;
      const count = Object.keys(parsed).length;
      setLayers(parsed);

      if (count === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl / .gbl / .gko files.");
        setLoading(false);
        return;
      }

      setLoadingMsg("Building 2D preview…");
      await yieldFrame();
      const svg2d = await withTimeout(buildComposite2dSvg(parsed, maskHex), 15000).catch(() => null);
      if (!abortRef.current) setSvgContent(svg2d);
      setLoading(false);
    } catch (err: any) {
      if (!abortRef.current) {
        setError("Parse error: " + (err?.message || "unknown"));
        setLoading(false);
      }
    }
  }, [file, maskHex, destroy3d]);

  // ── Build 3D scene ───────────────────────────────────────────────────────
  const init3d = useCallback(async (layerData: LayerMap) => {
    if (!container3dRef.current || Object.keys(layerData).length === 0) return;
    abortRef.current = false;
    setLoading(true);
    setLoadingMsg("Building 3D board…");
    destroy3d();

    try {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js" as any);

      if (abortRef.current) return;
      const W = container3dRef.current.clientWidth || 600;
      const H = 380;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x0d1117, 1);
      renderer.shadowMap.enabled = false; // disable shadows to reduce GPU load
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

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(60, 100, 60); scene.add(sun);
      const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
      fill.position.set(-40, -30, -40); scene.add(fill);

      setLoadingMsg("Rendering top copper layer…");
      await yieldFrame();

      const { w: boardW, d: boardD } = await getBoardDimensions(layerData.outline);
      const boardH = 1.6;

      if (abortRef.current) return;

      setLoadingMsg("Compositing top face…");
      const topCanvas = await withTimeout(buildFaceTexture(layerData, "top", maskHex, 512), 25000)
        .catch(() => { const c = document.createElement("canvas"); c.width=512;c.height=512; const ctx=c.getContext("2d")!; ctx.fillStyle=maskHex; ctx.fillRect(0,0,512,512); return c; });

      if (abortRef.current) return;

      setLoadingMsg("Compositing bottom face…");
      const btmCanvas = await withTimeout(buildFaceTexture(layerData, "btm", maskHex, 512), 25000)
        .catch(() => { const c = document.createElement("canvas"); c.width=512;c.height=512; const ctx=c.getContext("2d")!; ctx.fillStyle=maskHex; ctx.fillRect(0,0,512,512); return c; });

      if (abortRef.current) return;

      const topTex = new THREE.CanvasTexture(topCanvas);
      const btmTex = new THREE.CanvasTexture(btmCanvas);

      const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.1 });
      const btmMat = new THREE.MeshStandardMaterial({ map: btmTex, roughness: 0.4,  metalness: 0.1 });
      const sideMat = new THREE.MeshStandardMaterial({ color: 0xd4c48a, roughness: 0.85 });

      const boardGeo = new THREE.BoxGeometry(boardW, boardH, boardD);
      const board = new THREE.Mesh(boardGeo, [sideMat, sideMat, topMat, btmMat, sideMat, sideMat]);
      scene.add(board);

      const grid = new THREE.GridHelper(500, 40, 0x1a2a3a, 0x0f1a22);
      grid.position.y = -15;
      scene.add(grid);

      const animate = () => {
        animRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

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
      if (!abortRef.current) {
        setError("3D render failed — switching to 2D.");
        setView("2d");
        setLoading(false);
      }
    }
  }, [maskHex, destroy3d]);

  useEffect(() => {
    loadLayers();
    return () => { abortRef.current = true; destroy3d(); };
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

          <button
            onClick={() => setShowStack(s => !s)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border transition-colors ml-1 ${showStack ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="w-3 h-3" /> Stack
          </button>

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

      {/* ── Main content ── */}
      <div className="flex">
        {/* ── Viewport ── */}
        <div className="relative flex-1" style={{ height: 400, background: "#0d1117" }}>

          <div ref={container3dRef} className={`absolute inset-0 w-full h-full ${view !== "3d" ? "hidden" : ""}`} />

          {view === "2d" && svgContent && !loading && (
            <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4" style={{ background: "#0a180f" }}>
              <div
                style={{ transform: `scale(${zoom2d})`, transformOrigin: "center", transition: "transform 0.15s" }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20"
              style={{ background: "rgba(13,17,23,0.96)" }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{loadingMsg}</p>
              <p className="text-xs text-muted-foreground/60">Complex boards may take 20–40 seconds…</p>
            </div>
          )}

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

          {view === "2d" && !svgContent && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No preview available</p>
            </div>
          )}

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
                    <span className="text-[10px] text-muted-foreground w-3 shrink-0 font-mono">{i + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ background: present ? layer.dot : "#374151" }} />
                    <span className="text-[11px] text-foreground leading-tight flex-1">{layer.label}</span>
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
                {loading ? "Detecting layers…" : `${layerCount} / ${LAYER_STACK.length} detected`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {view === "3d"
              ? "All layers composited · Drag to rotate · Scroll to zoom"
              : "Top copper · 2D flat view"}
          </p>
        </div>
      )}
    </div>
  );
}
