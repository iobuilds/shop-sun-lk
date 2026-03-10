import { useEffect, useRef, useState, useCallback } from "react";
import { Layers, Loader2, AlertCircle, RotateCcw, Box, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Extension → semantic role
const LAYER_ROLE: Record<string, string> = {
  ".gtl": "top_copper",
  ".gts": "top_mask",
  ".gto": "top_silk",
  ".gbl": "btm_copper",
  ".gbs": "btm_mask",
  ".gbo": "btm_silk",
  ".gko": "outline",
  ".gm1": "outline",
  ".gm2": "outline",
  ".gm3": "outline",
  ".drl": "drill",
  ".xln": "drill",
  ".exc": "drill",
  ".ncd": "drill",
  ".txt": "drill",
  ".gbr": "top_copper",
  ".ger": "top_copper",
  ".g1":  "top_copper",
  ".g2":  "btm_copper",
  ".sol": "btm_copper",
  ".cmp": "top_copper",
  ".plc": "top_silk",
  ".pls": "btm_silk",
  ".stc": "top_mask",
  ".sts": "btm_mask",
};

const MASK_COLORS: Record<string, number> = {
  green:  0x1a6b2e,
  red:    0x8b0000,
  blue:   0x0a3d8f,
  black:  0x1a1a1a,
  white:  0xe8e8e8,
  yellow: 0xb8860b,
};

const MASK_HEX: Record<string, string> = {
  green:  "#1a6b2e",
  red:    "#8b0000",
  blue:   "#0a3d8f",
  black:  "#1a1a1a",
  white:  "#e8e8e8",
  yellow: "#b8860b",
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

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const cleanName = (filename.split("/").pop() || filename).toLowerCase();
    const ext = "." + cleanName.split(".").pop();
    const role = LAYER_ROLE[ext];
    if (!role) continue;
    if (layers[role]) continue; // first found wins
    try {
      const content = await zipEntry.async("string");
      if (content.trim().length > 20) layers[role] = content;
    } catch { /* skip binary */ }
  }
  return layers;
}

// Render a single gerber layer to SVG string
async function renderLayerToSvg(gerberStr: string): Promise<string | null> {
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const parsed = parse(gerberStr);
    const plotted = plot(parsed);
    const svgTree = renderSVG(plotted);
    const html = toHtml(svgTree as any);
    return html || null;
  } catch {
    return null;
  }
}

// Fix SVG: inject explicit width/height from viewBox so canvas can render it
function fixSvgDimensions(svgStr: string, targetW: number, targetH: number): string {
  // Add explicit width/height if missing or zero
  let fixed = svgStr
    .replace(/<svg([^>]*)>/, (match, attrs) => {
      const hasWidth = /width="[^"]*"/.test(attrs);
      const hasHeight = /height="[^"]*"/.test(attrs);
      let newAttrs = attrs;
      if (!hasWidth) newAttrs += ` width="${targetW}"`;
      if (!hasHeight) newAttrs += ` height="${targetH}"`;
      // Replace width="0" or height="0"
      newAttrs = newAttrs
        .replace(/width="0"/, `width="${targetW}"`)
        .replace(/height="0"/, `height="${targetH}"`);
      return `<svg${newAttrs}>`;
    });
  return fixed;
}

// Convert SVG string to ImageBitmap for Three.js texture
async function svgToImageBitmap(svgStr: string, w: number, h: number): Promise<ImageBitmap | null> {
  try {
    const fixed = fixSvgDimensions(svgStr, w, h);
    const blob = new Blob([fixed], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.width = w;
    img.height = h;

    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = (_e: any) => rej(new Error("img load failed"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return await createImageBitmap(canvas);
  } catch {
    return null;
  }
}

export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [zoom2d, setZoom2d] = useState(1);
  const [svgReady, setSvgReady] = useState(false);

  const destroy3d = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (rendererRef.current) {
      try { rendererRef.current.dispose?.(); } catch {}
      rendererRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = "";
  }, []);

  // Load layers + build SVG preview
  const loadLayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSvgContent(null);
    setSvgReady(false);

    try {
      let layers: LayerMap = {};
      const ext = "." + file.name.split(".").pop()?.toLowerCase();

      if (ext === ".zip" || ext === ".rar") {
        layers = await extractLayersFromZip(file);
      } else {
        const content = await file.text();
        layers[LAYER_ROLE[ext] ?? "top_copper"] = content;
      }

      const count = Object.keys(layers).length;
      setLayerCount(count);
      setLayerNames(Object.keys(layers));

      if (count === 0) {
        setError("No Gerber layers found. Ensure your ZIP contains .gtl, .gbl, .gko, or similar Gerber files.");
        setLoading(false);
        return;
      }

      // Render primary layer to SVG for 2D view
      const primaryLayer =
        layers.top_copper ||
        layers.btm_copper ||
        layers.outline ||
        Object.values(layers)[0];

      const svgStr = await renderLayerToSvg(primaryLayer);

      if (svgStr) {
        // Make SVG fill a nice dark background with copper-colored traces
        const coloredSvg = svgStr
          .replace(/<svg/, '<svg style="background:#0d2318;"')
          .replace(/fill="[^"]*"/g, 'fill="#c0a84b"')
          .replace(/stroke="[^"]*"/g, 'stroke="#c0a84b"');
        setSvgContent(coloredSvg);
        setSvgReady(true);
      } else {
        setError("Could not render SVG preview for this Gerber file.");
      }

      setLoading(false);
    } catch (err: any) {
      console.error("GerberViewer load error:", err);
      setError("Failed to parse Gerber file: " + (err?.message || "unknown error"));
      setLoading(false);
    }
  }, [file]);

  // Build 3D scene
  const init3d = useCallback(async () => {
    if (!containerRef.current || !svgContent) return;
    setLoading(true);
    destroy3d();

    try {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js" as any);

      const W = containerRef.current.clientWidth || 600;
      const H = 380;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x0d1117, 1);
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0d1117, 150, 400);

      const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000);
      camera.position.set(0, 70, 110);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = 20;
      controls.maxDistance = 400;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(60, 100, 60);
      sun.castShadow = true;
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
      fill.position.set(-40, -20, -40);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffeecc, 0.3);
      rim.position.set(0, -50, 80);
      scene.add(rim);

      // Board dimensions from SVG viewBox
      let boardW = 80, boardD = 60;
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(Number);
        if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
          const scale = 90 / Math.max(parts[2], parts[3]);
          boardW = parts[2] * scale;
          boardD = parts[3] * scale;
        }
      }
      const boardH = 1.6;

      const colorKey = (pcbColor || "green").toLowerCase();
      const maskColor = MASK_COLORS[colorKey] ?? MASK_COLORS.green;

      // Build SVG texture for top face
      const bitmap = await svgToImageBitmap(svgContent, 1024, 1024);
      const topMat = bitmap
        ? new THREE.MeshStandardMaterial({
            map: new THREE.CanvasTexture(bitmap as any),
            roughness: 0.35,
            metalness: 0.15,
          })
        : new THREE.MeshStandardMaterial({ color: maskColor, roughness: 0.35, metalness: 0.1 });

      const sideMat = new THREE.MeshStandardMaterial({ color: 0xd4c48a, roughness: 0.8 }); // FR4 edge
      const btmMat = new THREE.MeshStandardMaterial({ color: maskColor, roughness: 0.45, metalness: 0.1 });

      const boardGeo = new THREE.BoxGeometry(boardW, boardH, boardD);
      const board = new THREE.Mesh(boardGeo, [
        sideMat, sideMat,  // ±X
        topMat,            // +Y top
        btmMat,            // -Y bottom
        sideMat, sideMat,  // ±Z
      ]);
      board.castShadow = true;
      board.receiveShadow = true;
      scene.add(board);

      // Thin copper rim
      const rimGeo = new THREE.BoxGeometry(boardW + 0.3, boardH + 0.2, boardD + 0.3);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.8, transparent: true, opacity: 0.12 });
      scene.add(new THREE.Mesh(rimGeo, rimMat));

      // Ground grid
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

      // Resize handler
      const ro = new ResizeObserver(() => {
        const w = containerRef.current?.clientWidth || W;
        renderer.setSize(w, H);
        camera.aspect = w / H;
        camera.updateProjectionMatrix();
      });
      if (containerRef.current) ro.observe(containerRef.current);

      setLoading(false);
    } catch (err: any) {
      console.error("3D init error:", err);
      setError("3D render failed. Using 2D view.");
      setView("2d");
      setLoading(false);
    }
  }, [svgContent, pcbColor, destroy3d]);

  // Load on mount / file change
  useEffect(() => {
    loadLayers();
    return destroy3d;
  }, [file]); // eslint-disable-line

  // When switching views
  useEffect(() => {
    if (view === "3d" && svgReady) {
      init3d();
    } else {
      destroy3d();
      setLoading(false);
    }
  }, [view]); // eslint-disable-line

  // When SVG loads and we're in 3D mode, init 3D
  useEffect(() => {
    if (svgReady && view === "3d") {
      init3d();
    }
  }, [svgReady]); // eslint-disable-line

  const colorKey = (pcbColor || "green").toLowerCase();
  const maskHex = MASK_HEX[colorKey] ?? MASK_HEX.green;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">PCB Preview</span>
          {layerCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {layerCount} layer{layerCount !== 1 ? "s" : ""}
            </span>
          )}
          {layerNames.slice(0, 4).map(n => (
            <span key={n} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {n.replace("_", " ")}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-border overflow-hidden mr-1">
            <button onClick={() => setView("2d")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${view === "2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              2D
            </button>
            <button onClick={() => setView("3d")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${view === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              3D
            </button>
          </div>
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
            else { destroy3d(); init3d(); }
          }} title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadLayers} title="Reload">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative" style={{ height: 380, background: view === "3d" ? "#0d1117" : "#0d2318" }}>

        {/* 2D view */}
        {view === "2d" && svgContent && !loading && (
          <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4"
            style={{ background: "#0d2318" }}>
            <div
              style={{
                transform: `scale(${zoom2d})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease",
                maxWidth: "100%",
                maxHeight: "100%",
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        )}

        {/* 3D canvas */}
        {view === "3d" && <div ref={containerRef} className="absolute inset-0 w-full h-full" />}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ background: "rgba(13,17,23,0.95)" }}>
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Parsing Gerber layers…</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 z-10"
            style={{ background: "rgba(13,17,23,0.95)" }}>
            <AlertCircle className="w-7 h-7 text-destructive" />
            <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadLayers}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}

        {/* 2D empty */}
        {view === "2d" && !svgContent && !loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No preview available</p>
          </div>
        )}

        {/* Color indicator */}
        {!loading && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1">
            <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: maskHex }} />
            <span className="text-xs text-white/70">{pcbColor}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {view === "3d"
              ? "Drag to rotate · Scroll to zoom · Auto-rotating"
              : "Scroll to zoom · Top copper layer"}
          </p>
        </div>
      )}
    </div>
  );
}
