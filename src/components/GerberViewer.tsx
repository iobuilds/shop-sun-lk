import { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers, Loader2, AlertCircle, RotateCcw, Box, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, Minimize2
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

// ─── Colors per layer role ────────────────────────────────────────────────
const LAYER_TRACE_COLOR: Record<string, string> = {
  top_copper: "#d4a84b",
  btm_copper: "#d4a84b",
  top_silk:   "#ffffff",
  btm_silk:   "#ffffff",
  top_mask:   "rgba(0,180,80,0.55)",
  btm_mask:   "rgba(0,180,80,0.55)",
  outline:    "#888888",
  drill:      "#333333",
};

const MASK_HEX: Record<string, string> = {
  green:  "#1a6b2e", red: "#8b0000", blue: "#0a3d8f",
  black:  "#1a1a1a", white: "#e8e8e8", yellow: "#b8860b",
};

const MASK_NUM: Record<string, number> = {
  green:  0x1a6b2e, red: 0x8b0000, blue: 0x0a3d8f,
  black:  0x1a1a1a, white: 0xe8e8e8, yellow: 0xb8860b,
};

// Exploded-view layer stack definition
const EXPLODED_LAYERS = [
  { role: "top_silk",   label: "Top Silk",   color: "#e0e0e0", yMul:  3 },
  { role: "top_mask",   label: "Top Mask",   color: null,      yMul:  2 },
  { role: "top_copper", label: "Top Copper", color: "#c8a44a", yMul:  1 },
  { role: "outline",    label: "Outline",    color: "#888888", yMul:  0 },
  { role: "btm_copper", label: "Bot Copper", color: "#c8a44a", yMul: -1 },
  { role: "btm_mask",   label: "Bot Mask",   color: null,      yMul: -2 },
  { role: "btm_silk",   label: "Bot Silk",   color: "#e0e0e0", yMul: -3 },
];

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

    // Inject explicit size and override trace colors; background stays transparent
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
      img.onerror = (_e) => rej(new Error("svg img load fail"));
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
    if (c) { ctx.drawImage(c, 0, 0); }
  }

  // 3. Exposed pad brightening via mask layer
  const maskLayer = layers[`${prefix}_mask`];
  if (maskLayer) {
    const c = await renderLayerToCanvas(maskLayer, size, size, "#e8c060");
    if (c) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(c, 0, 0);
      ctx.globalAlpha = 1.0;
    }
  }

  // 4. Silkscreen (white text/markings)
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

/** Build a 2D composite SVG string for the 2D view mode */
async function buildComposite2dSvg(layers: LayerMap, maskHex: string): Promise<string | null> {
  // Prefer top_copper as the main display layer
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

/** Get board dimensions from outline SVG viewBox, scaled to target size */
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
  const [layerCount, setLayerCount] = useState(0);
  const [view, setView] = useState<"2d" | "3d">("3d");
  const [mode3d, setMode3d] = useState<"solid" | "exploded">("solid");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [zoom2d, setZoom2d] = useState(1);

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
      setLayerCount(count);

      if (count === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl / .gbl / .gko files.");
        setLoading(false);
        return;
      }

      // Build 2D SVG for fallback/2d mode
      const svg2d = await buildComposite2dSvg(parsed, maskHex);
      setSvgContent(svg2d);
      setLoading(false);
    } catch (err: any) {
      setError("Parse error: " + (err?.message || "unknown"));
      setLoading(false);
    }
  }, [file, maskHex, destroy3d]);

  // ── Build 3D scene ──────────────────────────────────────────────────────
  const init3d = useCallback(async (layerData: LayerMap, exploded: boolean) => {
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

      if (exploded) {
        // ── EXPLODED VIEW: individual layer planes ───────────────────────
        const GAP = 8; // gap between layers
        const planeGeo = new THREE.PlaneGeometry(boardW, boardD);

        for (const layerDef of EXPLODED_LAYERS) {
          const gerberStr = layerData[layerDef.role];
          const yPos = layerDef.yMul * GAP;
          const color = layerDef.color ?? maskHex;

          let mat: THREE.MeshStandardMaterial;

          if (gerberStr) {
            const traceCol = layerDef.color ?? "#d4a84b";
            const c = await renderLayerToCanvas(gerberStr, 512, 512, traceCol);
            if (c) {
              const tex = new THREE.CanvasTexture(c);
              // bg canvas with color
              const bgCanvas = document.createElement("canvas");
              bgCanvas.width = 512; bgCanvas.height = 512;
              const bgCtx = bgCanvas.getContext("2d")!;
              bgCtx.fillStyle = layerDef.role.includes("mask") ? maskHex : "#111111";
              bgCtx.fillRect(0, 0, 512, 512);
              bgCtx.drawImage(c, 0, 0);
              const bgTex = new THREE.CanvasTexture(bgCanvas);
              mat = new THREE.MeshStandardMaterial({
                map: bgTex,
                roughness: 0.4,
                metalness: layerDef.role.includes("copper") ? 0.6 : 0.05,
                transparent: layerDef.role.includes("mask"),
                opacity: layerDef.role.includes("mask") ? 0.75 : 1.0,
                side: THREE.DoubleSide,
              });
            } else {
              mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
            }
          } else {
            // Layer not present — show faint placeholder
            mat = new THREE.MeshStandardMaterial({
              color: 0x333333, transparent: true, opacity: 0.15, side: THREE.DoubleSide
            });
          }

          const mesh = new THREE.Mesh(planeGeo, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(0, yPos, 0);
          scene.add(mesh);

          // Label sprite
          const labelCanvas = document.createElement("canvas");
          labelCanvas.width = 256; labelCanvas.height = 64;
          const lCtx = labelCanvas.getContext("2d")!;
          lCtx.fillStyle = "rgba(0,0,0,0.6)";
          lCtx.roundRect(2, 2, 252, 60, 8);
          lCtx.fill();
          lCtx.fillStyle = color === "#e0e0e0" ? "#ffffff" : color;
          lCtx.font = "bold 26px monospace";
          lCtx.textAlign = "center";
          lCtx.textBaseline = "middle";
          lCtx.fillText(layerDef.label, 128, 32);
          const lTex = new THREE.CanvasTexture(labelCanvas);
          const lMat = new THREE.SpriteMaterial({ map: lTex, transparent: true });
          const sprite = new THREE.Sprite(lMat);
          sprite.scale.set(18, 4.5, 1);
          sprite.position.set(boardW / 2 + 12, yPos, 0);
          scene.add(sprite);

          // Connector line (thin cylinder)
          if (layerDef.yMul !== 0) {
            const lineGeo = new THREE.CylinderGeometry(0.15, 0.15, Math.abs(yPos), 4);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
            const lineMesh = new THREE.Mesh(lineGeo, lineMat);
            lineMesh.position.set(-boardW / 2 - 2, yPos / 2, 0);
            scene.add(lineMesh);
          }
        }

        camera.position.set(0, 0, 160);
        camera.lookAt(0, 0, 0);
        controls.minDistance = 60;
        controls.maxDistance = 500;
        controls.autoRotateSpeed = 0.3;

      } else {
        // ── SOLID VIEW: composite textures on PCB box ────────────────────
        const [topCanvas, btmCanvas] = await Promise.all([
          buildFaceTexture(layerData, "top", maskHex, 1024),
          buildFaceTexture(layerData, "btm", maskHex, 1024),
        ]);

        const topTex = new THREE.CanvasTexture(topCanvas);
        const btmTex = new THREE.CanvasTexture(btmCanvas);

        const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.1 });
        const btmMat = new THREE.MeshStandardMaterial({ map: btmTex, roughness: 0.4, metalness: 0.1 });
        const sideMat = new THREE.MeshStandardMaterial({ color: 0xd4c48a, roughness: 0.85 }); // FR4 edge

        const boardGeo = new THREE.BoxGeometry(boardW, boardH, boardD);
        const board = new THREE.Mesh(boardGeo, [
          sideMat, sideMat,  // ±X
          topMat,            // +Y (top face)
          btmMat,            // -Y (bottom face)
          sideMat, sideMat,  // ±Z
        ]);
        board.castShadow = true;
        board.receiveShadow = true;
        scene.add(board);

        // Thin copper rim bevel
        const rimGeo = new THREE.BoxGeometry(boardW + 0.4, boardH + 0.3, boardD + 0.4);
        const rimMat = new THREE.MeshStandardMaterial({
          color: 0xb8860b, roughness: 0.9, transparent: true, opacity: 0.1
        });
        scene.add(new THREE.Mesh(rimGeo, rimMat));
      }

      // Grid floor
      const grid = new THREE.GridHelper(500, 40, 0x1a2a3a, 0x0f1a22);
      grid.position.y = exploded ? -40 : -15;
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
  }, [maskHex, maskNum, destroy3d]);

  // ── Effect: load on file change ─────────────────────────────────────────
  useEffect(() => {
    loadLayers();
    return destroy3d;
  }, [file]); // eslint-disable-line

  // ── Effect: init 3D when layers ready or mode changes ───────────────────
  useEffect(() => {
    if (view === "3d" && Object.keys(layers).length > 0 && !loading) {
      init3d(layers, mode3d === "exploded");
    } else if (view === "2d") {
      destroy3d();
    }
  }, [view, mode3d, layers]); // eslint-disable-line

  // ── Effect: after initial load, trigger 3D ──────────────────────────────
  useEffect(() => {
    if (!loading && view === "3d" && Object.keys(layers).length > 0) {
      init3d(layers, mode3d === "exploded");
    }
  }, [loading]); // eslint-disable-line

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">PCB Preview</span>
          {layerCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {layerCount} layer{layerCount !== 1 ? "s" : ""}
            </span>
          )}
          {Object.keys(layers).map(n => (
            <span key={n} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono hidden sm:inline">
              {n.replace(/_/g, " ")}
            </span>
          ))}
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

          {/* 3D sub-mode toggle */}
          {view === "3d" && (
            <div className="flex rounded-lg border border-border overflow-hidden ml-1">
              <button onClick={() => setMode3d("solid")}
                title="Solid view — all layers composited"
                className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${mode3d === "solid" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Minimize2 className="w-3 h-3" /> Solid
              </button>
              <button onClick={() => setMode3d("exploded")}
                title="Exploded view — all layers separated"
                className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${mode3d === "exploded" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Maximize2 className="w-3 h-3" /> Layers
              </button>
            </div>
          )}

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
            else { destroy3d(); init3d(layers, mode3d === "exploded"); }
          }} title="Reset view">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadLayers} title="Reload file">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Viewport ── */}
      <div className="relative" style={{ height: 400, background: "#0d1117" }}>

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
            <p className="text-sm text-muted-foreground">
              {view === "3d" && mode3d === "exploded"
                ? "Rendering all Gerber layers…"
                : "Building PCB preview…"}
            </p>
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

      {/* ── Footer hint ── */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {view === "3d"
              ? mode3d === "exploded"
                ? "All PCB layers separated · Drag to rotate · Scroll to zoom"
                : "All layers composited · Drag to rotate · Scroll to zoom"
              : "Top copper + silkscreen · 2D flat view"}
          </p>
        </div>
      )}
    </div>
  );
}
