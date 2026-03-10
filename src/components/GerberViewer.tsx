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
  ".drl": "drill",
  ".xln": "drill",
  ".exc": "drill",
  ".gbr": "top_copper",
  ".ger": "top_copper",
  ".g1":  "top_copper",
  ".g2":  "btm_copper",
};

// Colors matching solder mask options
const MASK_COLORS: Record<string, string> = {
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

// Render a single gerber to SVG string
async function renderToSvg(gerberStr: string, isOutline = false): Promise<string | null> {
  try {
    const { parse, plot, renderSVG } = await import("web-gerber");
    const { toHtml } = await import("hast-util-to-html");
    const parsed = parse(gerberStr);
    const plotted = plot(parsed, isOutline);
    const svgTree = renderSVG(plotted);
    return toHtml(svgTree as any);
  } catch { return null; }
}

// Convert an SVG string to a canvas ImageBitmap
async function svgToImageBitmap(svgStr: string, w: number, h: number): Promise<ImageBitmap | null> {
  try {
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.width = w; img.height = h;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "transparent";
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return await createImageBitmap(canvas);
  } catch { return null; }
}

export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [zoom2d, setZoom2d] = useState(1);

  const destroy = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (rendererRef.current) {
      try { rendererRef.current.dispose?.(); } catch {}
      rendererRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = "";
  }, []);

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);
    destroy();

    try {
      // ── 1. Extract layers ──────────────────────────────────────────────
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
      if (count === 0) {
        setError("No Gerber layers found. Please upload a valid ZIP with Gerber files.");
        setLoading(false);
        return;
      }

      // ── 2. Render top + outline to SVG (for 2D view & texture) ────────
      const primaryLayer = layers.top_copper || layers.btm_copper || layers.outline || Object.values(layers)[0];
      const outlineSvg = layers.outline ? await renderToSvg(layers.outline, true) : null;
      const topSvg = await renderToSvg(primaryLayer);
      const displaySvg = topSvg || outlineSvg;
      setSvgContent(displaySvg);

      // ── 3. Build 3D scene with Three.js ───────────────────────────────
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js" as any);

      const W = containerRef.current.clientWidth || 600;
      const H = 380;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x0d1117, 1);
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
      camera.position.set(0, 60, 100);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 10;
      controls.maxDistance = 300;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(50, 80, 50);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0x8888ff, 0.3);
      backLight.position.set(-30, -20, -30);
      scene.add(backLight);

      // PCB board dimensions — parse outline bbox if available, else default
      let boardW = 80, boardH = 60;
      if (outlineSvg) {
        const match = outlineSvg.match(/viewBox="([^"]+)"/);
        if (match) {
          const [, minX, minY, vbW, vbH] = match[1].split(" ").map(Number);
          if (vbW > 0 && vbH > 0) {
            const scale = 80 / Math.max(vbW, vbH);
            boardW = vbW * scale;
            boardH = vbH * scale;
          }
        }
      }
      const boardDepth = 1.6;

      // Main PCB substrate
      const maskColor = MASK_COLORS[(pcbColor || "green").toLowerCase()] || MASK_COLORS.green;
      const boardGeo = new THREE.BoxGeometry(boardW, boardDepth, boardH);

      // Top surface: apply SVG as texture
      let topMaterial: InstanceType<typeof THREE.MeshStandardMaterial>;
      if (displaySvg) {
        const bitmap = await svgToImageBitmap(displaySvg, 512, 512);
        if (bitmap) {
          const tex = new THREE.CanvasTexture(bitmap as any);
          topMaterial = new THREE.MeshStandardMaterial({ map: tex, color: maskColor, roughness: 0.4, metalness: 0.1 });
        } else {
          topMaterial = new THREE.MeshStandardMaterial({ color: maskColor, roughness: 0.4 });
        }
      } else {
        topMaterial = new THREE.MeshStandardMaterial({ color: maskColor, roughness: 0.4 });
      }

      const sideMaterial = new THREE.MeshStandardMaterial({ color: 0xd4a84b, roughness: 0.6 }); // FR4 edge gold
      const btmMaterial = new THREE.MeshStandardMaterial({ color: maskColor, roughness: 0.5 });

      const materials = [
        sideMaterial, sideMaterial, // +X, -X
        topMaterial,                // +Y (top)
        btmMaterial,                // -Y (bottom)
        sideMaterial, sideMaterial, // +Z, -Z
      ];

      const board = new THREE.Mesh(boardGeo, materials);
      board.rotation.x = -Math.PI / 12;
      board.castShadow = true;
      board.receiveShadow = true;
      scene.add(board);

      // Copper edge strip (gold rim)
      const edgeGeo = new (THREE as any).BoxGeometry(boardW + 0.2, boardDepth + 0.1, boardH + 0.2);
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.7, transparent: true, opacity: 0.15 });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = board.rotation.x;
      scene.add(edge);

      // Grid ground plane
      const grid = new THREE.GridHelper(300, 30, 0x1a2a3a, 0x1a2a3a);
      grid.position.y = -20;
      scene.add(grid);

      // Animation loop
      const animate = () => {
        animRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        const w = containerRef.current?.clientWidth || W;
        renderer.setSize(w, H);
        camera.aspect = w / H;
        camera.updateProjectionMatrix();
      });
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      setLoading(false);
    } catch (err: any) {
      console.error("Gerber 3D init error:", err);
      setError("3D render failed — switching to 2D view.");
      setView("2d");
      setLoading(false);
    }
  }, [file, pcbColor, destroy]);

  useEffect(() => {
    initViewer();
    return destroy;
  }, [initViewer, destroy]);

  // When switching to 2d, destroy 3D renderer
  useEffect(() => {
    if (view === "2d") {
      destroy();
    } else {
      initViewer();
    }
  }, [view]); // eslint-disable-line

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
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
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden mr-1">
            <button onClick={() => setView("3d")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${view === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              3D
            </button>
            <button onClick={() => setView("2d")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${view === "2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              2D
            </button>
          </div>
          {view === "2d" && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom2d(z => Math.max(0.3, z - 0.2))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom2d * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom2d(z => Math.min(4, z + 0.2))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
            if (view === "3d") initViewer();
            else setZoom2d(1);
          }} title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={initViewer} title="Reload">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative" style={{ height: 380, background: view === "3d" ? "#0d1117" : "#1a1a2e" }}>
        {/* 3D canvas mounts here */}
        {view === "3d" && <div ref={containerRef} className="absolute inset-0 w-full h-full" />}

        {/* 2D SVG view */}
        {view === "2d" && svgContent && !loading && (
          <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4">
            <div
              style={{ transform: `scale(${zoom2d})`, transformOrigin: "center center", transition: "transform 0.2s" }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d1117]/95 z-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Rendering PCB preview...</p>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && view !== "2d" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 bg-[#0d1117]/95 z-10">
            <AlertCircle className="w-7 h-7 text-destructive" />
            <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={initViewer}>
                <RefreshCw className="w-3 h-3 mr-1" /> Retry 3D
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setView("2d")}>
                View 2D
              </Button>
            </div>
          </div>
        )}

        {/* 2D empty state */}
        {view === "2d" && !svgContent && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No 2D preview available</p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!loading && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {view === "3d" ? "Drag to rotate · Scroll to zoom · Right-click to pan" : "PCB top copper layer preview"}
          </p>
        </div>
      )}
    </div>
  );
}
