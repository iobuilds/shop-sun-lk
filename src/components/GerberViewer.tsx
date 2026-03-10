import { useEffect, useRef, useState, useCallback } from "react";
import { Layers, Loader2, AlertCircle, RotateCcw, Maximize2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

// Gerber layer extension to semantic role mapping
const LAYER_ROLE: Record<string, keyof typeof ROLE_KEYS | null> = {
  ".gtl": "top_copper",
  ".gts": "top_mask",
  ".gto": "top_silk",
  ".gbl": "btm_copper",
  ".gbs": "btm_mask",
  ".gbo": "btm_silk",
  ".gko": "outline",
  ".gm1": "outline",
  ".drl": "drill",
  ".xln": "drill",
  ".exc": "drill",
  ".txt": "drill",
  ".g1": "top_copper",
  ".g2": "btm_copper",
  ".gbr": "top_copper",
  ".ger": "top_copper",
};

const ROLE_KEYS = {
  top_copper: true,
  top_mask: true,
  top_silk: true,
  btm_copper: true,
  btm_mask: true,
  btm_silk: true,
  outline: true,
  drill: true,
};

type LayerRole = keyof typeof ROLE_KEYS;
type LayerMap = Partial<Record<LayerRole, string>>;

interface GerberViewerProps {
  file: File;
}

async function extractLayersFromZip(file: File): Promise<LayerMap> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const layers: LayerMap = {};

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const ext = "." + filename.split(".").pop()?.toLowerCase();
    const role = LAYER_ROLE[ext];
    if (!role) continue;
    // Don't overwrite already found preferred layers
    if (layers[role]) continue;
    try {
      const content = await zipEntry.async("string");
      layers[role] = content;
    } catch {
      // skip binary
    }
  }
  return layers;
}

async function buildMesh(gerberString: string, color: any, isOutline = false) {
  const { parse, plot, renderThree } = await import("web-gerber");
  const parsed = parse(gerberString);
  const plotted = plot(parsed, isOutline);
  return renderThree(plotted, color, undefined, false);
}

export default function GerberViewer({ file }: GerberViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layerCount, setLayerCount] = useState(0);

  const resetCamera = useCallback(() => {
    (rendererRef.current as any)?.Controls?.reset?.();
  }, []);

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);

    // Destroy old renderer if any
    if (rendererRef.current) {
      try { rendererRef.current.Renderer?.dispose?.(); } catch {}
      rendererRef.current = null;
      containerRef.current.innerHTML = "";
    }

    try {
      const {
        NewRenderByElement,
        assemblyPCBToThreeJS,
        DefaultLaminar,
        defaultColor,
      } = await import("web-gerber");

      // Init Three.js renderer inside our container
      const three = NewRenderByElement(containerRef.current, {
        AddAnimationLoop: true,
        AddOrbitControls: true,
        AddResizeListener: true,
        AddAxesHelper: false,
      });
      rendererRef.current = three;

      // Extract layer content
      let layers: LayerMap = {};
      const ext = "." + file.name.split(".").pop()?.toLowerCase();

      if (ext === ".zip" || ext === ".rar") {
        layers = await extractLayersFromZip(file);
      } else {
        const content = await file.text();
        const role = (LAYER_ROLE[ext] ?? "top_copper") as LayerRole;
        layers[role] = content;
      }

      const count = Object.keys(layers).length;
      setLayerCount(count);

      if (count === 0) {
        setError("No recognizable Gerber layers found in the file.");
        setLoading(false);
        return;
      }

      // Build meshes for each found layer in parallel
      const [
        top_copper_mesh,
        top_mask_mesh,
        top_silk_mesh,
        btm_copper_mesh,
        btm_mask_mesh,
        btm_silk_mesh,
        outline_mesh,
        drill_mesh,
      ] = await Promise.all([
        layers.top_copper ? buildMesh(layers.top_copper, defaultColor.Copper) : Promise.resolve(null),
        layers.top_mask   ? buildMesh(layers.top_mask,   defaultColor.SolderMask) : Promise.resolve(null),
        layers.top_silk   ? buildMesh(layers.top_silk,   defaultColor.Silkscreen) : Promise.resolve(null),
        layers.btm_copper ? buildMesh(layers.btm_copper, defaultColor.Copper) : Promise.resolve(null),
        layers.btm_mask   ? buildMesh(layers.btm_mask,   defaultColor.SolderMask) : Promise.resolve(null),
        layers.btm_silk   ? buildMesh(layers.btm_silk,   defaultColor.Silkscreen) : Promise.resolve(null),
        layers.outline    ? buildMesh(layers.outline,    defaultColor.BaseBoard, true) : Promise.resolve(null),
        layers.drill      ? buildMesh(layers.drill,      defaultColor.Drill) : Promise.resolve(null),
      ]);

      // Assemble PCB structure — only include non-null meshes
      const pcb_struct: any = {
        Top: {
          ...(top_copper_mesh ? { Copper: top_copper_mesh } : {}),
          ...(top_mask_mesh   ? { SolidMask: top_mask_mesh } : {}),
          ...(top_silk_mesh   ? { Silkscreen: top_silk_mesh } : {}),
        },
        Btm: {
          ...(btm_copper_mesh ? { Copper: btm_copper_mesh } : {}),
          ...(btm_mask_mesh   ? { SolidMask: btm_mask_mesh } : {}),
          ...(btm_silk_mesh   ? { Silkscreen: btm_silk_mesh } : {}),
        },
        ...(outline_mesh ? { Outline: outline_mesh } : {}),
        ...(drill_mesh   ? { Drill: drill_mesh } : {}),
      };

      assemblyPCBToThreeJS(three.Scene, pcb_struct, DefaultLaminar);

      // Position camera nicely
      try {
        const THREE = await import("three");
        three.Camera.position.set(0, 0, 80);
        three.Camera.lookAt(new THREE.Vector3(0, 0, 0));
        (three as any).Controls?.update?.();
      } catch {}

      setLoading(false);
    } catch (err: any) {
      console.error("3D Gerber render error:", err);
      setError("Could not render 3D PCB preview. The file may be corrupt or unsupported.");
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    initViewer();
    return () => {
      if (rendererRef.current) {
        try { rendererRef.current.Renderer?.dispose?.(); } catch {}
        rendererRef.current = null;
      }
    };
  }, [initViewer]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">3D PCB Preview</span>
          {layerCount > 0 && (
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {layerCount} layer{layerCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetCamera} title="Reset camera">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={initViewer} title="Reload">
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="relative" style={{ height: 360, background: "#0d1117" }}>
        {/* Three.js mounts here */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d1117]/90 z-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Rendering 3D PCB...</p>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 bg-[#0d1117]/90 z-10">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive text-center">{error}</p>
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
