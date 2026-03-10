import { useState, useEffect, useCallback } from "react";
import { Layers, Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

// Gerber file extension to layer name mapping
const LAYER_MAP: Record<string, string> = {
  ".gtl": "Top Copper",
  ".gbl": "Bottom Copper",
  ".gts": "Top Solder Mask",
  ".gbs": "Bottom Solder Mask",
  ".gto": "Top Silkscreen",
  ".gbo": "Bottom Silkscreen",
  ".gko": "Board Outline",
  ".gm1": "Mechanical 1",
  ".gm2": "Mechanical 2",
  ".drl": "Drill",
  ".xln": "Drill",
  ".exc": "Drill",
  ".txt": "Drill",
  ".g1": "Inner Layer 1",
  ".g2": "Inner Layer 2",
  ".g3": "Inner Layer 3",
  ".g4": "Inner Layer 4",
  ".gbr": "Gerber",
  ".ger": "Gerber",
};

interface GerberViewerProps {
  file: File;
}

export default function GerberViewer({ file }: GerberViewerProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [layers, setLayers] = useState<{ name: string; ext: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const processFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSvgContent(null);
    setLayers([]);

    try {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();

      if (ext === ".zip" || ext === ".rar") {
        // Extract ZIP and find gerber files
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const gerberFiles: { name: string; ext: string; content: string }[] = [];

        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const fileExt = "." + filename.split(".").pop()?.toLowerCase();
          if (LAYER_MAP[fileExt] || fileExt === ".gbr" || fileExt === ".ger") {
            try {
              const content = await zipEntry.async("string");
              gerberFiles.push({
                name: filename.split("/").pop() || filename,
                ext: fileExt,
                content,
              });
            } catch {
              // Skip binary or unreadable files
            }
          }
        }

        setLayers(gerberFiles.map(f => ({ name: f.name, ext: f.ext })));

        if (gerberFiles.length === 0) {
          setError("No Gerber files found in the ZIP archive");
          setLoading(false);
          return;
        }

        // Pick the best layer to render: prefer top copper, then outline, then first file
        const preferred = [".gtl", ".gko", ".gbl", ".gto", ".gbr", ".ger"];
        let fileToRender = gerberFiles[0];
        for (const pref of preferred) {
          const found = gerberFiles.find(f => f.ext === pref);
          if (found) { fileToRender = found; break; }
        }

        setSelectedLayer(fileToRender.name);
        await renderGerber(fileToRender.content, fileToRender.ext);
      } else {
        // Single gerber file
        const content = await file.text();
        setLayers([{ name: file.name, ext }]);
        setSelectedLayer(file.name);
        await renderGerber(content, ext);
      }
    } catch (err: any) {
      console.error("Gerber processing error:", err);
      setError(err.message || "Failed to process Gerber file");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const renderGerber = async (gerberString: string, layerExt = "") => {
    try {
      const { parse, plot, renderSVG } = await import("web-gerber");
      const { toHtml } = await import("hast-util-to-html");

      const isOutline = [".gko", ".gm1", ".gm2"].includes(layerExt);
      const parseResult = parse(gerberString);
      const plotResult = plot(parseResult, isOutline);
      const svgTree = renderSVG(plotResult);
      const htmlSvg = toHtml(svgTree as any);
      setSvgContent(htmlSvg);
    } catch (err: any) {
      console.error("Gerber render error:", err);
      setError("Could not render this Gerber layer. File may be corrupt or unsupported.");
    }
  };

  const switchLayer = async (layerName: string) => {
    if (layerName === selectedLayer) return;
    setSelectedLayer(layerName);
    setLoading(true);

    try {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (ext === ".zip") {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          const shortName = filename.split("/").pop() || filename;
          if (shortName === layerName && !zipEntry.dir) {
            const content = await zipEntry.async("string");
            const layerExt = "." + layerName.split(".").pop()?.toLowerCase();
            await renderGerber(content, layerExt);
            break;
          }
        }
      }
    } catch (err: any) {
      setError("Failed to render layer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    processFile();
  }, [processFile]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Gerber Preview</span>
          {layers.length > 0 && (
            <span className="text-xs text-muted-foreground">({layers.length} layer{layers.length > 1 ? "s" : ""})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Layer selector for ZIP files */}
      {layers.length > 1 && (
        <div className="px-3 py-2 bg-muted/30 border-b border-border flex gap-1.5 flex-wrap">
          {layers.map(l => {
            const layerLabel = LAYER_MAP[l.ext] || l.name;
            return (
              <button key={l.name} onClick={() => switchLayer(l.name)}
                className={`px-2 py-0.5 text-xs rounded-md border transition-all ${selectedLayer === l.name ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40"}`}>
                {layerLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Viewer */}
      <div className="relative min-h-[200px] max-h-[400px] overflow-auto bg-[#1a1a2e] flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Rendering Gerber...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-12 px-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive text-center">{error}</p>
          </div>
        )}

        {svgContent && !loading && (
          <div
            className="p-4 transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {/* Layer info footer */}
      {layers.length > 0 && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-3 h-3" />
            <span>Viewing: {selectedLayer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
