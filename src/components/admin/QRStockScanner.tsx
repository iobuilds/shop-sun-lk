import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, QrCode, Package, Plus, Edit3, Check, X, AlertCircle, Loader2, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Parse LCSC QR data: {pbn:...,on:WM...,pc:C5381776,pm:TP4054,qty:100,...} */
function parseLcscQR(raw: string): { lcsc: string; mpn: string; qty: number; orderRef: string } | null {
  try {
    const cleaned = raw.trim().replace(/^\{/, "").replace(/\}$/, "");
    const result: Record<string, string> = {};
    cleaned.split(",").forEach((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      result[key] = val;
    });
    const lcsc = result["pc"] || "";
    const mpn = result["pm"] || "";
    const qty = parseInt(result["qty"] || "0", 10);
    const orderRef = result["on"] || result["pbn"] || "";
    if (!lcsc && !mpn) return null;
    return { lcsc, mpn, qty, orderRef };
  } catch {
    return null;
  }
}

interface ScannedData {
  lcsc: string;
  mpn: string;
  qty: number;
  orderRef: string;
}

interface ReceiptForm {
  qty: string;
  buyPrice: string;
  buyDate: string;
  notes: string;
}

const today = () => new Date().toISOString().split("T")[0];

type PermissionState = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export default function QRStockScanner() {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [scanned, setScanned] = useState<ScannedData | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<any | null | "not_found">(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualQR, setManualQR] = useState("");
  const [form, setForm] = useState<ReceiptForm>({ qty: "", buyPrice: "", buyDate: today(), notes: "" });
  const [permState, setPermState] = useState<PermissionState>("idle");

  // Stock receipts history
  const { data: receipts, refetch: refetchReceipts } = useQuery({
    queryKey: ["stock-receipts"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stock_receipts")
        .select("*, products(name, sku, images)")
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  // Check existing permission state on mount
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermState("unavailable");
      return;
    }
    navigator.permissions?.query({ name: "camera" as PermissionName }).then((result) => {
      if (result.state === "granted") setPermState("granted");
      else if (result.state === "denied") setPermState("denied");
      result.onchange = () => {
        if (result.state === "granted") setPermState("granted");
        else if (result.state === "denied") setPermState("denied");
        else setPermState("idle");
      };
    }).catch(() => {/* permissions API not available */});
  }, []);

  const requestCameraPermission = useCallback(async () => {
    setPermState("requesting");
    try {
      // Trigger the browser permission prompt via getUserMedia (requires user gesture)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Got permission — stop the temporary stream, let ZXing manage it
      stream.getTracks().forEach(t => t.stop());
      setPermState("granted");
      // Auto-start scanner after permission granted
      setTimeout(() => startScannerInternal(), 100);
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setPermState("denied");
        toast({ title: "Camera permission denied", description: "Please allow camera access in your browser settings and refresh.", variant: "destructive" });
      } else if (e.name === "NotFoundError") {
        setPermState("unavailable");
        toast({ title: "No camera found", description: "No camera device was detected on this device.", variant: "destructive" });
      } else {
        setPermState("idle");
        toast({ title: "Camera error", description: e.message, variant: "destructive" });
      }
    }
  }, []);

  const startScannerInternal = useCallback(async () => {
    try {
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      setCameras(devices);
      const camId = selectedCamera || devices[0]?.deviceId;
      if (!camId) { toast({ title: "No camera found", variant: "destructive" }); return; }
      setScanning(true);
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        camId,
        videoRef.current!,
        (result) => {
          if (result) handleQRDetected(result.getText());
        }
      );
      controlsRef.current = controls;
    } catch (e: any) {
      toast({ title: "Camera error", description: e.message, variant: "destructive" });
      setScanning(false);
    }
  }, [selectedCamera]);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (permState !== "granted") {
      await requestCameraPermission();
    } else {
      await startScannerInternal();
    }
  }, [permState, requestCameraPermission, startScannerInternal]);

  useEffect(() => {
    return () => { controlsRef.current?.stop(); };
  }, []);

  const handleQRDetected = useCallback(async (raw: string) => {
    stopScanner();
    const parsed = parseLcscQR(raw);
    if (!parsed) {
      toast({ title: "Unrecognised QR", description: "Could not parse LCSC QR data", variant: "destructive" });
      return;
    }
    setScanned(parsed);
    setForm({ qty: String(parsed.qty || ""), buyPrice: "", buyDate: today(), notes: "" });
    await lookupProduct(parsed.lcsc, parsed.mpn);
  }, [stopScanner]);

  const lookupProduct = async (lcsc: string, mpn: string) => {
    setLookingUp(true);
    setMatchedProduct(null);
    try {
      // Try matching by SKU (lcsc part number or mpn)
      let { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .or(`sku.ilike.${lcsc},sku.ilike.${mpn}`)
        .maybeSingle();
      if (!data && lcsc) {
        const r = await supabase.from("products").select("*, categories(name)").ilike("sku", `%${lcsc}%`).maybeSingle();
        data = r.data;
      }
      setMatchedProduct(data || "not_found");
    } finally {
      setLookingUp(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualQR.trim()) return;
    const parsed = parseLcscQR(manualQR.trim());
    if (!parsed) {
      toast({ title: "Invalid QR data", description: "Expected format: {pc:C...,pm:...,qty:...}", variant: "destructive" });
      return;
    }
    setScanned(parsed);
    setManualQR("");
    setForm({ qty: String(parsed.qty || ""), buyPrice: "", buyDate: today(), notes: "" });
    await lookupProduct(parsed.lcsc, parsed.mpn);
  };

  const saveStockReceipt = async () => {
    if (!scanned || !matchedProduct || matchedProduct === "not_found") return;
    const qty = parseInt(form.qty, 10);
    if (!qty || qty <= 0) { toast({ title: "Enter a valid quantity", variant: "destructive" }); return; }
    setSaving(true);
    try {
      // Insert receipt record
      const { error: rErr } = await (supabase as any).from("stock_receipts").insert({
        product_id: matchedProduct.id,
        lcsc_part_number: scanned.lcsc || null,
        mpn: scanned.mpn || null,
        qty_received: qty,
        buy_price: form.buyPrice ? parseFloat(form.buyPrice) : null,
        buy_date: form.buyDate || today(),
        order_reference: scanned.orderRef || null,
        notes: form.notes || null,
      });
      if (rErr) throw rErr;

      // Update product stock + cost price
      const updateData: any = {
        stock_quantity: (matchedProduct.stock_quantity || 0) + qty,
        updated_at: new Date().toISOString(),
      };
      if (form.buyPrice) updateData.cost_price = parseFloat(form.buyPrice);

      const { error: pErr } = await supabase.from("products").update(updateData).eq("id", matchedProduct.id);
      if (pErr) throw pErr;

      toast({ title: "✅ Stock updated", description: `+${qty} units added to ${matchedProduct.name}` });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      refetchReceipts();
      resetState();
    } catch (e: any) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setScanned(null);
    setMatchedProduct(null);
    setForm({ qty: "", buyPrice: "", buyDate: today(), notes: "" });
  };

  const goToAddProduct = () => {
    // Notify parent to open product dialog with prefilled LCSC data
    if (!scanned) return;
    // Store in sessionStorage so AdminDashboard can pick it up
    sessionStorage.setItem("prefill_lcsc", scanned.lcsc || scanned.mpn || "");
    window.dispatchEvent(new CustomEvent("openAddProductFromQR", { detail: { lcsc: scanned.lcsc, mpn: scanned.mpn } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
          <ScanLine className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">QR Stock Scanner</h2>
          <p className="text-sm text-muted-foreground">Scan LCSC packaging QR codes to update inventory</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Scanner ── */}
        <div className="space-y-4">
          {/* Camera viewer */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? "block" : "hidden"}`} />

              {/* Permission denied state */}
              {!scanning && permState === "denied" && (
                <div className="flex flex-col items-center gap-3 text-center px-6 py-10">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                    <CameraOff className="w-7 h-7 text-destructive" />
                  </div>
                  <p className="text-sm font-semibold text-destructive">Camera Access Denied</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Your browser has blocked camera access. Click the camera icon in your browser's address bar and set it to <strong>Allow</strong>, then refresh the page.
                  </p>
                </div>
              )}

              {/* Unavailable state */}
              {!scanning && permState === "unavailable" && (
                <div className="flex flex-col items-center gap-3 text-center px-6 py-10">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <CameraOff className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No Camera Found</p>
                  <p className="text-xs text-muted-foreground">No camera was detected. Use the manual entry below instead.</p>
                </div>
              )}

              {/* Requesting permission state */}
              {!scanning && permState === "requesting" && (
                <div className="flex flex-col items-center gap-3 text-center px-6 py-10">
                  <Loader2 className="w-10 h-10 animate-spin text-secondary" />
                  <p className="text-sm text-muted-foreground">Requesting camera permission…</p>
                  <p className="text-xs text-muted-foreground">Please click <strong>Allow</strong> in the browser popup</p>
                </div>
              )}

              {/* Idle / ready state */}
              {!scanning && (permState === "idle" || permState === "granted") && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground py-10">
                  <QrCode className="w-14 h-14 opacity-20" />
                  <p className="text-sm">
                    {permState === "granted" ? "Click Start Camera to begin scanning" : "Camera access is required to scan QR codes"}
                  </p>
                </div>
              )}

              {/* Scanning overlay */}
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-52 h-52">
                    <div className="absolute inset-0 border-2 border-secondary/40 rounded-lg" />
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-secondary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-secondary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-secondary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-secondary rounded-br-lg" />
                    <motion.div
                      className="absolute left-1 right-1 h-0.5 bg-secondary/70 rounded-full shadow-[0_0_8px_2px_hsl(var(--secondary)/0.4)]"
                      animate={{ top: ["10%", "85%", "10%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <span className="text-xs text-secondary/80 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                      Align QR code within the frame
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Permission status bar */}
            {permState === "denied" && (
              <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive flex-1">Camera blocked — update permissions in browser settings</p>
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setPermState("idle")}>Retry</Button>
              </div>
            )}

            <div className="p-4 flex items-center gap-3">
              {cameras.length > 1 && scanning && (
                <select
                  value={selectedCamera}
                  onChange={e => { stopScanner(); setSelectedCamera(e.target.value); }}
                  className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
                >
                  {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 6)}`}</option>)}
                </select>
              )}
              {permState !== "unavailable" && (
                <Button
                  onClick={scanning ? stopScanner : startScanner}
                  variant={scanning ? "destructive" : "default"}
                  disabled={permState === "requesting"}
                  className="gap-2 flex-1"
                >
                  {permState === "requesting"
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Requesting…</>
                    : scanning
                      ? <><CameraOff className="w-4 h-4" /> Stop Scanner</>
                      : <><Camera className="w-4 h-4" /> {permState === "granted" ? "Start Camera" : "Enable Camera"}</>
                  }
                </Button>
              )}
            </div>
          </div>

          {/* Manual QR input */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-muted-foreground" /> Manual QR Data Entry
            </p>
            <p className="text-xs text-muted-foreground">Paste or type QR content if camera is not available</p>
            <div className="flex gap-2">
              <Input
                value={manualQR}
                onChange={e => setManualQR(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManualSubmit()}
                placeholder="{pbn:...,pc:C5381776,pm:TP4054,qty:100,...}"
                className="text-xs font-mono"
              />
              <Button onClick={handleManualSubmit} size="sm" variant="outline">Parse</Button>
            </div>
          </div>
        </div>

        {/* ── Right: Result panel ── */}
        <div>
          <AnimatePresence mode="wait">
            {lookingUp && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-card rounded-xl border border-border p-8 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                <p className="text-sm">Looking up part in database…</p>
              </motion.div>
            )}

            {!lookingUp && !scanned && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-card rounded-xl border border-dashed border-border p-8 flex flex-col items-center gap-3 text-muted-foreground">
                <QrCode className="w-10 h-10 opacity-20" />
                <p className="text-sm text-center">Scan a QR code or paste QR data to get started</p>
              </motion.div>
            )}

            {!lookingUp && scanned && matchedProduct && matchedProduct !== "not_found" && (
              <motion.div key="found" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-card rounded-xl border border-secondary/30 overflow-hidden">
                {/* Product header */}
                <div className="flex items-center gap-3 p-4 bg-secondary/5 border-b border-border">
                  <img src={matchedProduct.images?.[0] || "/placeholder.svg"} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{matchedProduct.name}</p>
                    <p className="text-xs text-secondary font-mono">{matchedProduct.sku}</p>
                    <p className="text-xs text-muted-foreground">{(matchedProduct.categories as any)?.name || "Uncategorized"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Current Stock</p>
                    <p className="text-xl font-bold text-foreground">{matchedProduct.stock_quantity ?? 0}</p>
                  </div>
                </div>

                {/* Scanned info */}
                <div className="px-4 py-3 bg-muted/20 border-b border-border flex flex-wrap gap-4 text-xs">
                  {scanned.mpn && <span><span className="text-muted-foreground">MPN: </span><span className="font-mono font-medium text-foreground">{scanned.mpn}</span></span>}
                  {scanned.lcsc && <span><span className="text-muted-foreground">LCSC: </span><span className="font-mono font-medium text-secondary">{scanned.lcsc}</span></span>}
                  {scanned.orderRef && <span><span className="text-muted-foreground">Order: </span><span className="font-mono text-foreground">{scanned.orderRef}</span></span>}
                </div>

                {/* Receipt form */}
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Qty Received *</Label>
                      <Input type="number" min={1} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} className="h-9 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Buy Price (Rs.)</Label>
                      <Input type="number" min={0} step="0.01" value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} placeholder="Optional" className="h-9 mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Buy Date</Label>
                    <Input type="date" value={form.buyDate} onChange={e => setForm(f => ({ ...f, buyDate: e.target.value }))} className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" className="h-9 mt-1" />
                  </div>

                  {form.qty && (
                    <div className="bg-secondary/5 rounded-lg px-3 py-2 text-sm text-secondary font-medium border border-secondary/20">
                      New stock: {matchedProduct.stock_quantity ?? 0} → <strong>{(matchedProduct.stock_quantity ?? 0) + parseInt(form.qty || "0", 10)}</strong> units
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={resetState} className="gap-1"><X className="w-3 h-3" /> Clear</Button>
                    <Button size="sm" onClick={saveStockReceipt} disabled={saving || !form.qty} className="flex-1 gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Confirm & Update Stock
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {!lookingUp && scanned && matchedProduct === "not_found" && (
              <motion.div key="notfound" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-card rounded-xl border border-accent/40 overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-accent/5 border-b border-border">
                  <AlertCircle className="w-8 h-8 text-accent-foreground flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Product Not Found</p>
                    <p className="text-xs text-muted-foreground">This part is not in your product catalog yet</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono space-y-1">
                    {scanned.lcsc && <div><span className="text-muted-foreground">LCSC: </span><span className="text-secondary font-bold">{scanned.lcsc}</span></div>}
                    {scanned.mpn && <div><span className="text-muted-foreground">MPN: </span><span className="text-foreground font-bold">{scanned.mpn}</span></div>}
                    {scanned.qty > 0 && <div><span className="text-muted-foreground">Qty: </span><span className="text-foreground">{scanned.qty}</span></div>}
                    {scanned.orderRef && <div><span className="text-muted-foreground">Order Ref: </span><span className="text-foreground">{scanned.orderRef}</span></div>}
                  </div>
                  <p className="text-sm text-muted-foreground">Would you like to add this as a new product? The LCSC data will be auto-fetched.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetState} className="gap-1"><X className="w-3 h-3" /> Cancel</Button>
                    <Button size="sm" onClick={goToAddProduct} className="flex-1 gap-1"><Plus className="w-3 h-3" /> Add to Catalog</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Stock Receipt History ── */}
      {receipts && receipts.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-secondary" /> Recent Stock Receipts
            </h3>
            <Button variant="ghost" size="sm" onClick={() => refetchReceipts()} className="gap-1 text-xs">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Product</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">LCSC</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Qty</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Buy Price</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Buy Date</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Order Ref</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r: any) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <img src={r.products?.images?.[0] || "/placeholder.svg"} alt="" className="w-7 h-7 rounded object-cover border border-border" />
                        <span className="font-medium text-foreground truncate max-w-[160px]">{r.products?.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-secondary">{r.lcsc_part_number || r.mpn || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-secondary">+{r.qty_received}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{r.buy_price ? `Rs. ${r.buy_price}` : "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.buy_date || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.order_reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
