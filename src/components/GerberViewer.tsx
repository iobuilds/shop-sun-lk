import { useEffect, useRef, useState, useCallback } from "react";
import { Layers, Loader2, AlertCircle, RotateCcw, Box, RefreshCw } from "lucide-react";
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
  ".txt": "drill",
  ".gbr": "top_copper",
  ".ger": "top_copper",
  ".g1":  "top_copper",
  ".g2":  "btm_copper",
  ".g3":  "top_copper",
  ".g4":  "btm_copper",
};

type LayerMap = Record<string, string>;

interface GerberViewerProps {
  file: File;
}

async function extractLayersFromZip(file: File): Promise<LayerMap> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const layers: LayerMap = {};

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const cleanName = filename.split("/").pop() || filename;
    const ext = "." + cleanName.split(".").pop()?.toLowerCase();
    const role = LAYER_ROLE[ext];
    if (!role) continue;
    // Don't overwrite already-found layer for this role
    if (layers[role]) continue;
    try {
      const content = await zipEntry.async("string");
      // Basic sanity check: gerber files start with % or G
      if (content.trim().length > 10) {
        layers[role] = content;
      }
    } catch {
      // skip binary/unreadable files
    }
  }
  return layers;
}

// Safe mesh builder — never throws, returns null on failure
async function safeBuildMesh(gerberString: string, color: any, isOutline = false): Promise<any> {
  try {
    const { parse, plot, renderThree } = await import("web-gerber");
    const parsed = parse(gerberString);
    const plotted = plot(parsed, isOutline);
    const mesh = renderThree(plotted, color, undefined, false);
    // Validate mesh is a real Three.js object with scale
    if (!mesh || typeof mesh !== "object" || !("scale" in mesh)) return null;
    return mesh;
  } catch {
    return null;
  }
}

export default function GerberViewer({ file }: GerberViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [meshCount, setMeshCount] = useState(0);

  const destroyRenderer = useCallback(() => {
    if (rendererRef.current) {
      try { (rendererRef.current as any).Renderer?.dispose?.(); } catch {}
      rendererRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, []);

  const resetCamera = useCallback(() => {
    try {
      const r = rendererRef.current as any;
      if (r?.Controls) {
        r.Controls.reset();
      } else if (r?.Camera) {
        r.Camera.position.set(0, 50, 120);
        r.Camera.lookAt(0, 0, 0);
      }
    } catch {}
  }, []);

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);
    destroyRenderer();

    try {
      const {
        NewRenderByElement,
        assemblyPCBToThreeJS,
        DefaultLaminar,
        defaultColor,
      } = await import("web-gerber");

      // Mount Three.js into container div
      const three = NewRenderByElement(containerRef.current, {
        AddAnimationLoop: true,
        AddOrbitControls: true,
        AddResizeListener: true,
        AddAxesHelper: false,
      });
      rendererRef.current = three;

      // Parse layers
      let layers: LayerMap = {};
      const ext = "." + file.name.split(".").pop()?.toLowerCase();

      if (ext === ".zip" || ext === ".rar") {
        layers = await extractLayersFromZip(file);
      } else {
        const content = await file.text();
        const role = LAYER_ROLE[ext] ?? "top_copper";
        layers[role] = content;
      }

      const foundRoles = Object.keys(layers);
      setLayerCount(foundRoles.length);

      if (foundRoles.length === 0) {
        setError("No Gerber layers found. Please upload a valid ZIP with Gerber files.");
        setLoading(false);
        return;
      }

      // Build all meshes concurrently, safely
      const [
        top_copper, top_mask, top_silk,
        btm_copper, btm_mask, btm_silk,
        outline, drill,
      ] = await Promise.all([
        safeBuildMesh(layers.top_copper ?? "", defaultColor.Copper),
        safeBuildMesh(layers.top_mask   ?? "", defaultColor.SolderMask),
        safeBuildMesh(layers.top_silk   ?? "", defaultColor.Silkscreen),
        safeBuildMesh(layers.btm_copper ?? "", defaultColor.Copper),
        safeBuildMesh(layers.btm_mask   ?? "", defaultColor.SolderMask),
        safeBuildMesh(layers.btm_silk   ?? "", defaultColor.Silkscreen),
        safeBuildMesh(layers.outline    ?? "", defaultColor.BaseBoard, true),
        safeBuildMesh(layers.drill      ?? "", defaultColor.Drill),
      ]);

      // Count valid meshes
      const validMeshes = [top_copper, top_mask, top_silk, btm_copper, btm_mask, btm_silk, outline, drill].filter(Boolean);
      setMeshCount(validMeshes.length);

      if (validMeshes.length === 0) {
        setError("No renderable layers found. The Gerber data may be empty or unsupported.");
        setLoading(false);
        return;
      }

      // Build Top/Btm only if they have at least one valid mesh
      const topLayers: Record<string, any> = {};
      if (top_copper) topLayers.Copper = top_copper;
      if (top_mask)   topLayers.SolidMask = top_mask;
      if (top_silk)   topLayers.Silkscreen = top_silk;

      const btmLayers: Record<string, any> = {};
      if (btm_copper) btmLayers.Copper = btm_copper;
      if (btm_mask)   btmLayers.SolidMask = btm_mask;
      if (btm_silk)   btmLayers.Silkscreen = btm_silk;

      const hasTop = Object.keys(topLayers).length > 0;
      const hasBtm = Object.keys(btmLayers).length > 0;

      if (outline) {
        // Full assembly with outline (best result)
        const pcb_struct: any = {
          ...(hasTop ? { Top: topLayers } : {}),
          ...(hasBtm ? { Btm: btmLayers } : {}),
          Outline: outline,
          ...(drill ? { Drill: drill } : {}),
        };
        assemblyPCBToThreeJS(three.Scene, pcb_struct, DefaultLaminar);
      } else {
        // No outline — add meshes directly to scene with manual z-offsets
        let z = 0;
        const step = 0.2;
        const addToScene = (mesh: any) => {
          if (!mesh) return;
          mesh.position.z = z;
          z += step;
          three.Scene.add(mesh);
        };
        [btm_copper, btm_mask, btm_silk, top_copper, top_mask, top_silk, drill].forEach(addToScene);
      }

      // Auto-fit camera
      try {
        const THREE = await import("three");
        const box = new THREE.Box3().setFromObject(three.Scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 1.8;
        three.Camera.position.set(center.x, center.y + dist * 0.4, center.z + dist);
        three.Camera.lookAt(center);
        if ((three as any).Controls) {
          (three as any).Controls.target.copy(center);
          (three as any).Controls.update();
        }
      } catch {}

      setLoading(false);
    } catch (err: any) {
      console.error("3D Gerber render error:", err);
      setError("Could not render 3D PCB preview. The file may be corrupt or unsupported.");
      setLoading(false);
    }
  }, [file, destroyRenderer]);

  useEffect(() => {
    initViewer();
    return destroyRenderer;
  }, [initViewer, destroyRenderer]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">3D PCB Preview</span>
          {layerCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {layerCount} layer{layerCount !== 1 ? "s" : ""}
            </span>
          )}
          {meshCount > 0 && (
            <span className="text-xs text-muted-foreground">
              · {meshCount} rendered
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetCamera} title="Reset camera">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={initViewer} title="Reload viewer">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="relative" style={{ height: 380, background: "#0d1117" }}>
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d1117]/95 z-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Rendering 3D PCB...</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 bg-[#0d1117]/95 z-10">
            <AlertCircle className="w-7 h-7 text-destructive" />
            <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={initViewer}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            Drag to rotate · Scroll to zoom · Right-click to pan
          </p>
        </div>
      )}
    </div>
  );
}
