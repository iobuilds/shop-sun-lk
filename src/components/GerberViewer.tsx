/**
 * GerberViewer — uses web-gerber's native Three.js rendering pipeline
 * (renderThree + assemblyPCBToThreeJS) so NO canvas-baking / no main-thread freeze.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers, Loader2, AlertCircle, RotateCcw, RefreshCw,
  ZoomIn, ZoomOut, CheckCircle2, XCircle, Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Layer extensions → role ───────────────────────────────────────────────
const LAYER_ROLE: Record<string, string> = {
  ".gtl": "top_copper",  ".cmp": "top_copper",  ".g1": "top_copper",
  ".gts": "top_mask",    ".stc": "top_mask",
  ".gto": "top_silk",    ".plc": "top_silk",
  ".gbl": "btm_copper",  ".sol": "btm_copper",  ".g2": "btm_copper",
  ".gbs": "btm_mask",    ".sts": "btm_mask",
  ".gbo": "btm_silk",    ".pls": "btm_silk",
  ".gko": "outline",     ".gm1": "outline",     ".gm2": "outline",
  ".drl": "drill",       ".xln": "drill",       ".exc": "drill",
  ".ncd": "drill",       ".txt": "drill",
  ".gbr": "top_copper",  ".ger": "top_copper",
};

// ─── Layer stack sidebar ───────────────────────────────────────────────────
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

// Mask color hex lookup (for 2D bg tint only)
const MASK_HEX: Record<string, string> = {
  green: "#1a6b2e", red: "#8b0000", blue: "#0a3d8f",
  black: "#1a1a1a", white: "#d8d8d8", yellow: "#b8860b",
};

type LayerMap = Record<string, string>;

interface GerberViewerProps {
  file: File;
  pcbColor?: string;
}

// ─── ZIP extraction ────────────────────────────────────────────────────────
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
    } catch { /* skip binary */ }
  }
  return layers;
}

// ─── Build a single Three.js mesh from gerber string ──────────────────────
async function buildLayerMesh(
  gerberStr: string,
  color: number,
  doubleSide = false,
): Promise<any | null> {
  try {
    const { parse, plot, renderThree, defaultColor } = await import("web-gerber" as any);
    const THREE = await import("three");
    const plot_result = plot(parse(gerberStr));
    const mesh = renderThree(
      plot_result,
      color ?? defaultColor.BaseBoard,
      undefined,
      doubleSide,
    );
    return mesh ?? null;
  } catch (e) {
    console.warn("Layer mesh failed:", e);
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────
export default function GerberViewer({ file, pcbColor = "Green" }: GerberViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const cancelRef = useRef(false);

  const [layers, setLayers] = useState<LayerMap>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("Reading file…");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [zoom2d, setZoom2d] = useState(1);
  const [showStack, setShowStack] = useState(true);

  const colorKey = (pcbColor || "green").toLowerCase();
  const maskHex = MASK_HEX[colorKey] ?? MASK_HEX.green;

  // ── Destroy Three scene ──────────────────────────────────────────────────
  const destroy3d = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (rendererRef.current) {
      try { rendererRef.current.dispose?.(); } catch {}
      rendererRef.current = null;
    }
    if (mountRef.current) mountRef.current.innerHTML = "";
  }, []);

  // ── Parse ZIP → LayerMap ─────────────────────────────────────────────────
  const loadFile = useCallback(async () => {
    cancelRef.current = false;
    setLoading(true);
    setError(null);
    setSvgHtml(null);
    destroy3d();
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

      if (cancelRef.current) return;
      const count = Object.keys(parsed).length;
      setLayers(parsed);

      if (count === 0) {
        setError("No Gerber layers found. Make sure your ZIP contains .gtl/.gbl/.gko files.");
        setLoading(false);
        return;
      }

      // Quick 2D SVG for 2D fallback mode
      setMsg("Generating 2D preview…");
      try {
        const primary = parsed.top_copper || parsed.btm_copper || parsed.outline;
        if (primary) {
          const { parse, plot, renderSVG } = await import("web-gerber" as any);
          const { toHtml } = await import("hast-util-to-html");
          const svg = toHtml(renderSVG(plot(parse(primary))));
          if (!cancelRef.current && svg) {
            setSvgHtml(svg.replace(/<svg/, `<svg style="background:${maskHex};"`));
          }
        }
      } catch { /* 2D ok to fail */ }

      setLoading(false);
    } catch (err: any) {
      if (!cancelRef.current) {
        setError("Could not read file: " + (err?.message ?? "unknown error"));
        setLoading(false);
      }
    }
  }, [file, maskHex, destroy3d]);

  // ── Build Three.js scene using web-gerber's native API ───────────────────
  const init3d = useCallback(async (layerData: LayerMap) => {
    if (!mountRef.current || Object.keys(layerData).length === 0) return;
    cancelRef.current = false;
    destroy3d();
    setLoading(true);
    setMsg("Initialising 3D renderer…");

    try {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js" as any);
      const { assemblyPCBToThreeJS, DefaultLaminar } = await import("web-gerber" as any);

      if (cancelRef.current) return;

      const W = mountRef.current.clientWidth || 640;
      const H = 380;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x0d1117);
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Scene + camera
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 5000);
      camera.position.set(0, 80, 150);
      camera.lookAt(0, 0, 0);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(80, 150, 80);
      scene.add(dir);
      scene.add(new THREE.DirectionalLight(0x8899ff, 0.3).position.set(-60, -40, -60) && dir);
      const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
      fill.position.set(-60, -40, -60);
      scene.add(fill);

      // Grid
      const grid = new THREE.GridHelper(600, 50, 0x1a2a3a, 0x0f1a22);
      grid.position.y = -20;
      scene.add(grid);

      // Build each layer mesh using web-gerber's renderThree
      // Colors match PCB conventions
      const maskColor = parseInt(maskHex.replace("#", ""), 16);

      setMsg("Rendering Copper layers…");
      const [top_copper, btm_copper] = await Promise.all([
        layerData.top_copper ? buildLayerMesh(layerData.top_copper, 0xd4a84b) : null,
        layerData.btm_copper ? buildLayerMesh(layerData.btm_copper, 0xd4a84b) : null,
      ]);
      if (cancelRef.current) return;

      setMsg("Rendering Solder Mask layers…");
      const [top_mask, btm_mask] = await Promise.all([
        layerData.top_mask ? buildLayerMesh(layerData.top_mask, maskColor) : null,
        layerData.btm_mask ? buildLayerMesh(layerData.btm_mask, maskColor) : null,
      ]);
      if (cancelRef.current) return;

      setMsg("Rendering Silkscreen layers…");
      const [top_silk, btm_silk] = await Promise.all([
        layerData.top_silk ? buildLayerMesh(layerData.top_silk, 0xffffff) : null,
        layerData.btm_silk ? buildLayerMesh(layerData.btm_silk, 0xffffff) : null,
      ]);
      if (cancelRef.current) return;

      setMsg("Assembling PCB…");
      const outline = layerData.outline ? await buildLayerMesh(layerData.outline, 0xd4c48a) : null;
      const drill   = layerData.drill   ? await buildLayerMesh(layerData.drill,   0x222222) : null;
      if (cancelRef.current) return;

      // Build pcb_struct — only include present layers
      const pcb_struct: any = {};
      if (top_copper || top_mask || top_silk) {
        pcb_struct.Top = {};
        if (top_copper) pcb_struct.Top.Copper      = top_copper;
        if (top_mask)   pcb_struct.Top.SolidMask   = top_mask;
        if (top_silk)   pcb_struct.Top.Silkscreen  = top_silk;
      }
      if (btm_copper || btm_mask || btm_silk) {
        pcb_struct.Btm = {};
        if (btm_copper) pcb_struct.Btm.Copper      = btm_copper;
        if (btm_mask)   pcb_struct.Btm.SolidMask   = btm_mask;
        if (btm_silk)   pcb_struct.Btm.Silkscreen  = btm_silk;
      }
      if (outline) pcb_struct.Outline = outline;
      if (drill)   pcb_struct.Drill   = drill;

      try {
        assemblyPCBToThreeJS(scene, pcb_struct, DefaultLaminar);
      } catch {
        // Fallback: just add individual meshes directly
        [top_copper, btm_copper, top_mask, btm_mask, top_silk, btm_silk, outline, drill]
          .filter(Boolean).forEach(m => scene.add(m));
      }

      // Centre camera on board
      const box = new THREE.Box3().setFromObject(scene);
      const centre = new THREE.Vector3();
      box.getCenter(centre);
      const size = box.getSize(new THREE.Vector3()).length();
      controls.target.copy(centre);
      camera.position.set(centre.x, centre.y + size * 0.5, centre.z + size * 1.1);
      camera.lookAt(centre);
      controls.update();

      // Animate
      const tick = () => {
        animRef.current = requestAnimationFrame(tick);
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      // Resize
      const ro = new ResizeObserver(() => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        renderer.setSize(w, H);
        camera.aspect = w / H;
        camera.updateProjectionMatrix();
      });
      ro.observe(mountRef.current);

      setLoading(false);
    } catch (err: any) {
      console.error("3D error:", err);
      if (!cancelRef.current) {
        setError("3D render failed — falling back to 2D.");
        setView("2d");
        setLoading(false);
      }
    }
  }, [maskHex, destroy3d]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadFile();
    return () => { cancelRef.current = true; destroy3d(); };
  }, [file]); // eslint-disable-line

  useEffect(() => {
    if (view === "3d" && Object.keys(layers).length > 0 && !loading) init3d(layers);
    if (view === "2d") destroy3d();
  }, [view, layers]); // eslint-disable-line

  useEffect(() => {
    if (!loading && view === "3d" && Object.keys(layers).length > 0) init3d(layers);
  }, [loading]); // eslint-disable-line

  const layerCount = Object.keys(layers).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
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
          {/* 2D / 3D */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["3d", "2d"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors uppercase ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {v}
              </button>
            ))}
          </div>

          {/* Layer stack toggle */}
          <button onClick={() => setShowStack(s => !s)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border ml-1 transition-colors ${showStack ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="w-3 h-3" /> Stack
          </button>

          {/* 2D zoom */}
          {view === "2d" && (<>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom2d(z => Math.max(0.2, z - 0.2))}><ZoomOut className="w-3.5 h-3.5" /></Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom2d * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom2d(z => Math.min(5, z + 0.2))}><ZoomIn className="w-3.5 h-3.5" /></Button>
          </>)}

          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset"
            onClick={() => view === "2d" ? setZoom2d(1) : (destroy3d(), init3d(layers))}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reload" onClick={loadFile}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Viewer + Stack panel */}
      <div className="flex">
        {/* 3D / 2D viewport */}
        <div className="relative flex-1" style={{ height: 400, background: "#0d1117" }}>

          {/* Three.js canvas mount */}
          <div ref={mountRef} className={`absolute inset-0 w-full h-full ${view !== "3d" ? "hidden" : ""}`} />

          {/* 2D SVG */}
          {view === "2d" && svgHtml && !loading && (
            <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4"
              style={{ background: "#0a180f" }}>
              <div style={{ transform: `scale(${zoom2d})`, transformOrigin: "center", transition: "transform 0.15s" }}
                dangerouslySetInnerHTML={{ __html: svgHtml }} />
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(13,17,23,0.95)" }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{msg}</p>
              <p className="text-xs text-muted-foreground/50">Complex boards may take 15–30 s…</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6"
              style={{ background: "rgba(13,17,23,0.95)" }}>
              <AlertCircle className="w-7 h-7 text-destructive" />
              <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadFile}>
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            </div>
          )}

          {/* 2D empty */}
          {view === "2d" && !svgHtml && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No 2D preview available</p>
            </div>
          )}

          {/* Color badge */}
          {!loading && !error && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 z-10"
              style={{ background: "rgba(0,0,0,0.6)" }}>
              <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: maskHex }} />
              <span className="text-xs text-white/70">{pcbColor}</span>
            </div>
          )}
        </div>

        {/* Layer stack sidebar */}
        {showStack && (
          <div className="w-48 border-l border-border bg-muted/20 flex flex-col shrink-0" style={{ height: 400 }}>
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-primary" /> Gerber Stack
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
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
              <p className="text-[10px] text-muted-foreground">
                {loading ? "Detecting…" : `${layerCount} / ${LAYER_STACK.length} detected`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {view === "3d"
              ? "Native 3D mesh · Drag to rotate · Scroll to zoom"
              : "Top copper · 2D flat view"}
          </p>
        </div>
      )}
    </div>
  );
}
