import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Save, Eye, Upload, GripVertical, Plus, Trash2, Move, Type, Image,
  AlignLeft, AlignCenter, AlignRight, Loader2, FileText, Building2,
  Phone, Mail, MapPin, Hash, Calendar, CreditCard, RefreshCw, Cpu, Package
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocType = "standard" | "pcb" | "preorder";

type BlockType =
  | "logo" | "company_name" | "company_address" | "company_contact"
  | "divider" | "invoice_title" | "invoice_meta" | "ship_to"
  | "items_table" | "totals" | "notes" | "footer" | "custom_text"
  // PCB-specific
  | "pcb_specs_table" | "pcb_cost_summary" | "pcb_arrival_charges"
  // Pre-order-specific
  | "preorder_items_table" | "preorder_cost_summary" | "preorder_arrival_charges";

interface TemplateBlock {
  id: string;
  type: BlockType;
  label: string;
  visible: boolean;
  align: "left" | "center" | "right";
  fontSize?: number;
  bold?: boolean;
  color?: string;
  content?: string;
}

interface InvoiceTemplate {
  blocks: TemplateBlock[];
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string;
  paperSize: "a4" | "letter";
  showBorder: boolean;
  currencySymbol: string;
}

// ─── Settings keys ─────────────────────────────────────────────────────────

const SETTINGS_KEYS: Record<DocType, string> = {
  standard: "invoice_template",
  pcb: "pcb_invoice_template",
  preorder: "preorder_invoice_template",
};

// ─── Default blocks per type ──────────────────────────────────────────────

const STANDARD_BLOCKS: TemplateBlock[] = [
  { id: "logo", type: "logo", label: "Company Logo", visible: true, align: "left" },
  { id: "company_name", type: "company_name", label: "Company Name", visible: true, align: "left", fontSize: 22, bold: true, color: "#111111" },
  { id: "company_address", type: "company_address", label: "Company Address", visible: true, align: "left", fontSize: 9, color: "#666666" },
  { id: "company_contact", type: "company_contact", label: "Phone / Email", visible: true, align: "left", fontSize: 9, color: "#666666" },
  { id: "divider1", type: "divider", label: "Divider", visible: true, align: "left" },
  { id: "invoice_title", type: "invoice_title", label: "Invoice Title", visible: true, align: "right", fontSize: 18, bold: true, color: "#111111" },
  { id: "invoice_meta", type: "invoice_meta", label: "Invoice Details", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "divider2", type: "divider", label: "Divider", visible: true, align: "left" },
  { id: "ship_to", type: "ship_to", label: "Ship To", visible: true, align: "left", fontSize: 9, color: "#555555" },
  { id: "items_table", type: "items_table", label: "Items Table", visible: true, align: "left" },
  { id: "totals", type: "totals", label: "Totals Summary", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "notes", type: "notes", label: "Notes", visible: true, align: "left", fontSize: 8, color: "#888888" },
  { id: "footer", type: "footer", label: "Footer Text", visible: true, align: "center", fontSize: 8, color: "#aaaaaa", content: "Thank you for your purchase!" },
];

const PCB_BLOCKS: TemplateBlock[] = [
  { id: "logo", type: "logo", label: "Company Logo", visible: true, align: "left" },
  { id: "company_name", type: "company_name", label: "Company Name", visible: true, align: "left", fontSize: 22, bold: true, color: "#111111" },
  { id: "company_address", type: "company_address", label: "Company Address", visible: true, align: "left", fontSize: 9, color: "#666666" },
  { id: "company_contact", type: "company_contact", label: "Phone / Email", visible: true, align: "left", fontSize: 9, color: "#666666" },
  { id: "divider1", type: "divider", label: "Divider", visible: true, align: "left" },
  { id: "invoice_title", type: "invoice_title", label: "Invoice Title", visible: true, align: "right", fontSize: 18, bold: true, color: "#111111" },
  { id: "invoice_meta", type: "invoice_meta", label: "Invoice Details", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "divider2", type: "divider", label: "Divider", visible: true, align: "left" },
  { id: "ship_to", type: "ship_to", label: "Customer Info", visible: true, align: "left", fontSize: 9, color: "#555555" },
  { id: "pcb_specs_table", type: "pcb_specs_table", label: "Board Specs Table", visible: true, align: "left" },
  { id: "pcb_cost_summary", type: "pcb_cost_summary", label: "Cost Summary", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "pcb_arrival_charges", type: "pcb_arrival_charges", label: "Arrival Charges", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "notes", type: "notes", label: "Notes", visible: true, align: "left", fontSize: 8, color: "#888888" },
  { id: "footer", type: "footer", label: "Footer Text", visible: true, align: "center", fontSize: 8, color: "#aaaaaa", content: "This is a quote invoice. Final charges may vary." },
];

const PREORDER_BLOCKS: TemplateBlock[] = [
  { id: "logo", type: "logo", label: "Company Logo", visible: true, align: "left" },
  { id: "company_name", type: "company_name", label: "Company Name", visible: true, align: "left", fontSize: 22, bold: true, color: "#111111" },
  { id: "company_address", type: "company_address", label: "Company Address", visible: true, align: "left", fontSize: 9, color: "#666666" },
  { id: "company_contact", type: "company_contact", label: "Phone / Email", visible: true, align: "left", fontSize: 9, color: "#666666" },
  { id: "divider1", type: "divider", label: "Divider", visible: true, align: "left" },
  { id: "invoice_title", type: "invoice_title", label: "Invoice Title", visible: true, align: "right", fontSize: 18, bold: true, color: "#111111" },
  { id: "invoice_meta", type: "invoice_meta", label: "Invoice Details", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "divider2", type: "divider", label: "Divider", visible: true, align: "left" },
  { id: "ship_to", type: "ship_to", label: "Customer Info", visible: true, align: "left", fontSize: 9, color: "#555555" },
  { id: "preorder_items_table", type: "preorder_items_table", label: "Pre-Order Items Table", visible: true, align: "left" },
  { id: "preorder_cost_summary", type: "preorder_cost_summary", label: "Cost Summary", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "preorder_arrival_charges", type: "preorder_arrival_charges", label: "Arrival Charges", visible: true, align: "right", fontSize: 9, color: "#555555" },
  { id: "notes", type: "notes", label: "Notes", visible: true, align: "left", fontSize: 8, color: "#888888" },
  { id: "footer", type: "footer", label: "Footer Text", visible: true, align: "center", fontSize: 8, color: "#aaaaaa", content: "Thank you for your pre-order!" },
];

const DEFAULT_BLOCKS: Record<DocType, TemplateBlock[]> = {
  standard: STANDARD_BLOCKS,
  pcb: PCB_BLOCKS,
  preorder: PREORDER_BLOCKS,
};

const DEFAULT_TEMPLATE: InvoiceTemplate = {
  blocks: STANDARD_BLOCKS,
  primaryColor: "#111111",
  accentColor: "#2563eb",
  fontFamily: "helvetica",
  logoUrl: "",
  paperSize: "a4",
  showBorder: false,
  currencySymbol: "Rs.",
};

// ─── Dummy data ──────────────────────────────────────────────────────────────

const DUMMY_ORDER = {
  id: "abcd1234-ef56-7890",
  created_at: new Date().toISOString(),
  subtotal: 4250,
  discount_amount: 200,
  shipping_fee: 350,
  total: 4400,
  payment_method: "bank_transfer",
  payment_status: "paid",
  coupon_code: "SAVE10",
  shipping_address: { full_name: "Kasun Perera", address_line1: "123 Galle Road", city: "Colombo", postal_code: "00300", phone: "0771234567" },
  order_items: [
    { quantity: 2, unit_price: 1200, total_price: 2400, products: { name: "ATmega328P Microcontroller" } },
    { quantity: 5, unit_price: 150, total_price: 750, products: { name: "10K Resistor Pack (50pcs)" } },
    { quantity: 3, unit_price: 200, total_price: 600, products: { name: "100nF Ceramic Capacitor" } },
    { quantity: 1, unit_price: 500, total_price: 500, products: { name: "LM7805 Voltage Regulator" } },
  ],
};

const DUMMY_PCB = {
  id: "pcb-1234-abcd",
  created_at: new Date().toISOString(),
  quantity: 10,
  layer_count: 2,
  surface_finish: "HASL",
  board_thickness: "1.6mm",
  pcb_color: "Green",
  gerber_file_name: "my_board_v2.zip",
  unit_cost_total: 4500,
  shipping_fee: 800,
  tax_amount: 200,
  grand_total: 5500,
  arrival_shipping_fee: 600,
  arrival_tax_amount: 300,
  status: "manufacturing",
  payment_status: "paid",
  admin_notes: "",
  customer: { full_name: "Kasun Perera", phone: "0771234567" },
};

const DUMMY_PREORDER = {
  id: "pre-1234-abcd",
  created_at: new Date().toISOString(),
  unit_cost_total: 6000,
  shipping_fee: 1200,
  tax_amount: 400,
  grand_total: 7600,
  arrival_shipping_fee: 900,
  arrival_tax_amount: 500,
  status: "sourcing",
  payment_status: "paid",
  admin_notes: "",
  customer: { full_name: "Kasun Perera", phone: "0771234567" },
  items: [
    { product_name: "ESP32-WROOM-32E", quantity: 20, unit_price: 250 },
    { product_name: "MPU-6050 IMU Sensor", quantity: 10, unit_price: 180 },
    { product_name: "SSD1306 OLED 0.96\"", quantity: 5, unit_price: 320 },
  ],
};

// ─── Block Icon map ────────────────────────────────────────────────────────

const BLOCK_ICONS: Partial<Record<BlockType, React.ReactNode>> = {
  logo: <Image className="w-4 h-4" />,
  company_name: <Building2 className="w-4 h-4" />,
  company_address: <MapPin className="w-4 h-4" />,
  company_contact: <Phone className="w-4 h-4" />,
  divider: <Move className="w-4 h-4" />,
  invoice_title: <FileText className="w-4 h-4" />,
  invoice_meta: <Hash className="w-4 h-4" />,
  ship_to: <AlignLeft className="w-4 h-4" />,
  items_table: <CreditCard className="w-4 h-4" />,
  totals: <Hash className="w-4 h-4" />,
  notes: <AlignLeft className="w-4 h-4" />,
  footer: <Type className="w-4 h-4" />,
  custom_text: <Type className="w-4 h-4" />,
  pcb_specs_table: <Cpu className="w-4 h-4" />,
  pcb_cost_summary: <Hash className="w-4 h-4" />,
  pcb_arrival_charges: <Package className="w-4 h-4" />,
  preorder_items_table: <Package className="w-4 h-4" />,
  preorder_cost_summary: <Hash className="w-4 h-4" />,
  preorder_arrival_charges: <Package className="w-4 h-4" />,
};

// ─── Helper ───────────────────────────────────────────────────────────────

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
};

// ─── Component ────────────────────────────────────────────────────────────────

const InvoiceTemplateBuilder = () => {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<DocType>("standard");
  const [templates, setTemplates] = useState<Record<DocType, InvoiceTemplate>>({
    standard: { ...DEFAULT_TEMPLATE, blocks: STANDARD_BLOCKS },
    pcb: { ...DEFAULT_TEMPLATE, blocks: PCB_BLOCKS },
    preorder: { ...DEFAULT_TEMPLATE, blocks: PREORDER_BLOCKS },
  });
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const template = templates[docType];
  const setTemplate = (updater: (t: InvoiceTemplate) => InvoiceTemplate) => {
    setTemplates(prev => ({ ...prev, [docType]: updater(prev[docType]) }));
  };

  const { data: companySettings } = useQuery({
    queryKey: ["admin-company"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("*").eq("key", "company").maybeSingle();
      return (data as any)?.value as any || {};
    },
  });

  // Load all three saved templates
  const { data: savedStandard } = useQuery({
    queryKey: ["invoice-template", "standard"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("*").eq("key", "invoice_template").maybeSingle();
      return (data as any)?.value as any || null;
    },
  });
  const { data: savedPcb } = useQuery({
    queryKey: ["invoice-template", "pcb"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("*").eq("key", "pcb_invoice_template").maybeSingle();
      return (data as any)?.value as any || null;
    },
  });
  const { data: savedPreorder } = useQuery({
    queryKey: ["invoice-template", "preorder"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings" as any).select("*").eq("key", "preorder_invoice_template").maybeSingle();
      return (data as any)?.value as any || null;
    },
  });

  useEffect(() => {
    if (savedStandard) setTemplates(p => ({ ...p, standard: { ...DEFAULT_TEMPLATE, ...savedStandard, blocks: savedStandard.blocks || STANDARD_BLOCKS } }));
  }, [savedStandard]);
  useEffect(() => {
    if (savedPcb) setTemplates(p => ({ ...p, pcb: { ...DEFAULT_TEMPLATE, ...savedPcb, blocks: savedPcb.blocks || PCB_BLOCKS } }));
  }, [savedPcb]);
  useEffect(() => {
    if (savedPreorder) setTemplates(p => ({ ...p, preorder: { ...DEFAULT_TEMPLATE, ...savedPreorder, blocks: savedPreorder.blocks || PREORDER_BLOCKS } }));
  }, [savedPreorder]);

  const saveTemplate = async () => {
    setSaving(true);
    const key = SETTINGS_KEYS[docType];
    try {
      const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", key).maybeSingle();
      if (existing) {
        await supabase.from("site_settings" as any).update({ value: template as any }).eq("key", key);
      } else {
        await supabase.from("site_settings" as any).insert({ key, value: template as any });
      }
      queryClient.invalidateQueries({ queryKey: ["invoice-template", docType] });
      toast({ title: "✅ Template saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `logos/invoice-logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(fileName, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); setUploading(false); return; }
    const { data } = supabase.storage.from("images").getPublicUrl(fileName);
    setTemplate(t => ({ ...t, logoUrl: data.publicUrl }));
    setUploading(false);
    toast({ title: "Logo uploaded" });
  };

  // Drag and drop
  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (e: React.DragEvent, overIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === overIndex) return;
    const blocks = [...template.blocks];
    const [moved] = blocks.splice(dragIndex, 1);
    blocks.splice(overIndex, 0, moved);
    setTemplate(t => ({ ...t, blocks }));
    setDragIndex(overIndex);
  };
  const onDragEnd = () => setDragIndex(null);

  const updateBlock = (id: string, updates: Partial<TemplateBlock>) => {
    setTemplate(t => ({ ...t, blocks: t.blocks.map(b => b.id === id ? { ...b, ...updates } : b) }));
  };

  const addCustomBlock = () => {
    const newBlock: TemplateBlock = {
      id: `custom_${Date.now()}`,
      type: "custom_text",
      label: "Custom Text",
      visible: true,
      align: "left",
      fontSize: 9,
      color: "#333333",
      content: "Enter your text here...",
    };
    setTemplate(t => ({ ...t, blocks: [...t.blocks, newBlock] }));
  };

  const deleteBlock = (id: string) => {
    setTemplate(t => ({ ...t, blocks: t.blocks.filter(b => b.id !== id) }));
    if (selectedBlock === id) setSelectedBlock(null);
  };

  // ─── PDF Preview generators ──────────────────────────────────────────────

  const generatePreviewPDF = async () => {
    setGenerating(true);
    try {
      if (docType === "standard") await generateStandardPreview();
      else if (docType === "pcb") await generatePCBPreview();
      else await generatePreorderPreview();
      toast({ title: "📄 Preview downloaded" });
    } finally {
      setGenerating(false);
    }
  };

  const buildDocHeader = async (doc: jsPDF, company: any) => {
    const storeName = company?.store_name || "Your Store";
    let headerY = 25;
    if (template.logoUrl) {
      try {
        const { dataUrl, w, h } = await loadImageData(template.logoUrl);
        const [pdfW, pdfH] = logoPdfSize(w, h);
        doc.addImage(dataUrl, "PNG", 20, 12, pdfW, pdfH);
        headerY = 12 + pdfH + 4;
      } catch {
        doc.setFontSize(22); doc.setFont(template.fontFamily, "bold");
        doc.text(storeName, 20, 25);
      }
    } else {
      doc.setFontSize(22); doc.setFont(template.fontFamily, "bold");
      doc.text(storeName, 20, 25);
    }
    doc.setFontSize(8); doc.setFont(template.fontFamily, "normal"); doc.setTextColor(120, 120, 120);
    let compY = headerY + 5;
    if (company?.address) { doc.text(company.address, 20, compY); compY += 4; }
    if (company?.phone) { doc.text(`Tel: ${company.phone}`, 20, compY); compY += 4; }
    if (company?.email) { doc.text(company.email, 20, compY); compY += 4; }
    return compY;
  };

  const applyTemplateColors = (doc: jsPDF) => {
    const primRgb = hexToRgb(template.primaryColor);
    const accRgb = hexToRgb(template.accentColor);
    return { primRgb, accRgb };
  };

  const generateStandardPreview = async () => {
    const company = companySettings || {};
    const order = DUMMY_ORDER;
    const doc = new jsPDF({ format: template.paperSize });
    const { primRgb, accRgb } = applyTemplateColors(doc);
    const visibleBlocks = template.blocks.filter(b => b.visible);
    let yPos = 20;

    for (const block of visibleBlocks) {
      const align = block.align || "left";
      const xPos = align === "center" ? 105 : align === "right" ? 190 : 20;
      const halign = align as "left" | "center" | "right";
      const fs = block.fontSize || 10;
      const bold = block.bold ? "bold" : "normal";
      const rgb = hexToRgb(block.color || "#000000");
      doc.setFontSize(fs); doc.setFont(template.fontFamily, bold); doc.setTextColor(rgb.r, rgb.g, rgb.b);

      switch (block.type) {
        case "logo":
          if (template.logoUrl) {
            try {
              const { dataUrl, w, h } = await loadImageData(template.logoUrl);
              const [pdfW, pdfH] = logoPdfSize(w, h);
              doc.addImage(dataUrl, "PNG", 20, yPos - 5, pdfW, pdfH); yPos += pdfH + 2;
            } catch {}
          }
          break;
        case "company_contact":
          if (company.phone || company.email) { doc.text([company.phone, company.email].filter(Boolean).join("  |  "), xPos, yPos, { align: halign }); yPos += fs * 0.45; }
          break;
        case "divider":
          doc.setDrawColor(accRgb.r, accRgb.g, accRgb.b); doc.setLineWidth(0.3);
          doc.line(20, yPos, 190, yPos); yPos += 5; break;
        case "invoice_title": doc.text("INVOICE", xPos, yPos, { align: halign }); yPos += fs * 0.5; break;
        case "invoice_meta":
          doc.setFont(template.fontFamily, "normal");
          doc.text(`Invoice #: INV-ABCD1234`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Date: ${new Date().toLocaleDateString()}`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Payment: Bank Transfer`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Status: PAID`, xPos, yPos, { align: halign }); yPos += 5;
          break;
        case "ship_to":
          doc.setFont(template.fontFamily, "bold"); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
          doc.text("Ship To:", 20, yPos); yPos += 5;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text("Kasun Perera", 20, yPos); yPos += 5;
          doc.text("123 Galle Road, Colombo", 20, yPos); yPos += 5;
          doc.text("Phone: 0771234567", 20, yPos); yPos += 8;
          break;
        case "items_table":
          autoTable(doc, {
            startY: yPos,
            head: [["#", "Product", "Qty", "Unit Price", "Total"]],
            body: order.order_items.map((item, i) => [String(i + 1), item.products?.name, String(item.quantity), `${template.currencySymbol} ${item.unit_price.toLocaleString()}`, `${template.currencySymbol} ${item.total_price.toLocaleString()}`]),
            theme: "grid",
            headStyles: { fillColor: [primRgb.r, primRgb.g, primRgb.b], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 80 }, 2: { cellWidth: 15 }, 3: { cellWidth: 35, halign: "right" }, 4: { cellWidth: 35, halign: "right" } },
            margin: { left: 20, right: 20 },
          });
          yPos = (doc as any).lastAutoTable?.finalY + 5 || yPos + 50;
          break;
        case "totals": {
          const xL = 130, xV = 185;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
          doc.text("Subtotal:", xL, yPos); doc.text(`${template.currencySymbol} 4,250`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Discount:", xL, yPos); doc.setTextColor(0, 150, 0); doc.text(`-${template.currencySymbol} 200`, xV, yPos, { align: "right" }); doc.setTextColor(80, 80, 80); yPos += 6;
          doc.text("Shipping:", xL, yPos); doc.text(`${template.currencySymbol} 350`, xV, yPos, { align: "right" }); yPos += 8;
          doc.setDrawColor(200, 200, 200); doc.line(xL, yPos - 3, xV, yPos - 3);
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Total:", xL, yPos + 2); doc.text(`${template.currencySymbol} 4,400`, xV, yPos + 2, { align: "right" });
          yPos += 12;
          break;
        }
        case "notes": doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.text("Notes: Thank you for your order.", 20, yPos); yPos += 6; break;
        case "footer": doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.text(block.content || "Thank you!", 105, 285, { align: "center" }); break;
        case "custom_text": doc.text(block.content || "", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
      }
    }
    doc.save(`Standard-Invoice-Preview.pdf`);
  };

  const generatePCBPreview = async () => {
    const company = companySettings || {};
    const order = DUMMY_PCB;
    const doc = new jsPDF({ format: template.paperSize });
    const { primRgb, accRgb } = applyTemplateColors(doc);
    const visibleBlocks = template.blocks.filter(b => b.visible);
    let yPos = 20;

    for (const block of visibleBlocks) {
      const align = block.align || "left";
      const xPos = align === "center" ? 105 : align === "right" ? 190 : 20;
      const halign = align as "left" | "center" | "right";
      const fs = block.fontSize || 10;
      const bold = block.bold ? "bold" : "normal";
      const rgb = hexToRgb(block.color || "#000000");
      doc.setFontSize(fs); doc.setFont(template.fontFamily, bold); doc.setTextColor(rgb.r, rgb.g, rgb.b);

      switch (block.type) {
        case "logo":
          if (template.logoUrl) {
            try {
              const imgData = await loadImageData(template.logoUrl);
              doc.addImage(imgData, "PNG", 20, yPos - 5, 30, 15); yPos += 15;
            } catch {}
          }
          break;
        case "company_name": doc.text(company.store_name || "Your Store Name", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
        case "company_address": doc.text(company.address || "Colombo, Sri Lanka", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
        case "company_contact":
          if (company.phone || company.email) { doc.text([company.phone, company.email].filter(Boolean).join("  |  "), xPos, yPos, { align: halign }); yPos += fs * 0.45; }
          break;
        case "divider":
          doc.setDrawColor(accRgb.r, accRgb.g, accRgb.b); doc.setLineWidth(0.3);
          doc.line(20, yPos, 190, yPos); yPos += 5; break;
        case "invoice_title": doc.text("PCB ORDER INVOICE", xPos, yPos, { align: halign }); yPos += fs * 0.5; break;
        case "invoice_meta":
          doc.setFont(template.fontFamily, "normal");
          doc.text(`Invoice #: PCB-${order.id.slice(0, 8).toUpperCase()}`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Date: ${new Date().toLocaleDateString()}`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Status: ${order.status.toUpperCase()}`, xPos, yPos, { align: halign }); yPos += 5;
          break;
        case "ship_to":
          doc.setFont(template.fontFamily, "bold"); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
          doc.text("Customer:", 20, yPos); yPos += 5;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text(order.customer.full_name, 20, yPos); yPos += 5;
          doc.text(`Phone: ${order.customer.phone}`, 20, yPos); yPos += 8;
          break;
        case "pcb_specs_table":
          autoTable(doc, {
            startY: yPos,
            head: [["Board Specification", "Value"]],
            body: [
              ["Quantity", `${order.quantity} pcs`],
              ["Layer Count", `${order.layer_count} Layers`],
              ["Surface Finish", order.surface_finish],
              ["Board Thickness", order.board_thickness],
              ["Solder Mask Color", order.pcb_color],
              ["Gerber File(s)", order.gerber_file_name],
            ],
            theme: "grid",
            headStyles: { fillColor: [primRgb.r, primRgb.g, primRgb.b], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 70, fontStyle: "bold" }, 1: { cellWidth: 100 } },
            margin: { left: 20, right: 20 },
          });
          yPos = (doc as any).lastAutoTable?.finalY + 5 || yPos + 50;
          break;
        case "pcb_cost_summary": {
          const xL = 120, xV = 185;
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Quote Summary", 20, yPos); yPos += 8;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
          doc.text("Board Manufacturing Cost:", xL, yPos); doc.text(`${template.currencySymbol} 4,500`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Shipping Fee:", xL, yPos); doc.text(`${template.currencySymbol} 800`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Tax / Customs:", xL, yPos); doc.text(`${template.currencySymbol} 200`, xV, yPos, { align: "right" }); yPos += 8;
          doc.setDrawColor(200, 200, 200); doc.line(xL, yPos - 3, xV, yPos - 3);
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Grand Total:", xL, yPos + 2); doc.text(`${template.currencySymbol} 5,500`, xV, yPos + 2, { align: "right" });
          yPos += 12;
          break;
        }
        case "pcb_arrival_charges": {
          const xL = 120, xV = 185;
          doc.setFontSize(10); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Arrival Charges", 20, yPos); yPos += 7;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
          doc.text("Arrival Shipping:", xL, yPos); doc.text(`${template.currencySymbol} 600`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Arrival Tax / Customs:", xL, yPos); doc.text(`${template.currencySymbol} 300`, xV, yPos, { align: "right" }); yPos += 8;
          doc.setDrawColor(200, 200, 200); doc.line(xL, yPos - 3, xV, yPos - 3);
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Arrival Total:", xL, yPos + 2); doc.text(`${template.currencySymbol} 900`, xV, yPos + 2, { align: "right" });
          yPos += 12;
          break;
        }
        case "notes": doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.text("Note: Final charges may vary based on exact requirements.", 20, yPos); yPos += 6; break;
        case "footer": doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.text(block.content || "Thank you!", 105, 285, { align: "center" }); break;
        case "custom_text": doc.text(block.content || "", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
      }
    }
    doc.save(`PCB-Invoice-Preview.pdf`);
  };

  const generatePreorderPreview = async () => {
    const company = companySettings || {};
    const order = DUMMY_PREORDER;
    const doc = new jsPDF({ format: template.paperSize });
    const { primRgb, accRgb } = applyTemplateColors(doc);
    const visibleBlocks = template.blocks.filter(b => b.visible);
    let yPos = 20;

    for (const block of visibleBlocks) {
      const align = block.align || "left";
      const xPos = align === "center" ? 105 : align === "right" ? 190 : 20;
      const halign = align as "left" | "center" | "right";
      const fs = block.fontSize || 10;
      const bold = block.bold ? "bold" : "normal";
      const rgb = hexToRgb(block.color || "#000000");
      doc.setFontSize(fs); doc.setFont(template.fontFamily, bold); doc.setTextColor(rgb.r, rgb.g, rgb.b);

      switch (block.type) {
        case "logo":
          if (template.logoUrl) {
            try {
              const imgData = await loadImageData(template.logoUrl);
              doc.addImage(imgData, "PNG", 20, yPos - 5, 30, 15); yPos += 15;
            } catch {}
          }
          break;
        case "company_name": doc.text(company.store_name || "Your Store Name", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
        case "company_address": doc.text(company.address || "Colombo, Sri Lanka", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
        case "company_contact":
          if (company.phone || company.email) { doc.text([company.phone, company.email].filter(Boolean).join("  |  "), xPos, yPos, { align: halign }); yPos += fs * 0.45; }
          break;
        case "divider":
          doc.setDrawColor(accRgb.r, accRgb.g, accRgb.b); doc.setLineWidth(0.3);
          doc.line(20, yPos, 190, yPos); yPos += 5; break;
        case "invoice_title": doc.text("PRE-ORDER INVOICE", xPos, yPos, { align: halign }); yPos += fs * 0.5; break;
        case "invoice_meta":
          doc.setFont(template.fontFamily, "normal");
          doc.text(`Invoice #: PRE-${order.id.slice(0, 8).toUpperCase()}`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Date: ${new Date().toLocaleDateString()}`, xPos, yPos, { align: halign }); yPos += 5;
          doc.text(`Status: ${order.status.toUpperCase()}`, xPos, yPos, { align: halign }); yPos += 5;
          break;
        case "ship_to":
          doc.setFont(template.fontFamily, "bold"); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
          doc.text("Customer:", 20, yPos); yPos += 5;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text(order.customer.full_name, 20, yPos); yPos += 5;
          doc.text(`Phone: ${order.customer.phone}`, 20, yPos); yPos += 8;
          break;
        case "preorder_items_table":
          autoTable(doc, {
            startY: yPos,
            head: [["#", "Product", "Qty", "Unit Price", "Total"]],
            body: order.items.map((item, i) => [String(i + 1), item.product_name, String(item.quantity), `${template.currencySymbol} ${(item.unit_price || 0).toLocaleString()}`, `${template.currencySymbol} ${((item.unit_price || 0) * item.quantity).toLocaleString()}`]),
            theme: "grid",
            headStyles: { fillColor: [primRgb.r, primRgb.g, primRgb.b], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 80 }, 2: { cellWidth: 15 }, 3: { cellWidth: 35, halign: "right" }, 4: { cellWidth: 35, halign: "right" } },
            margin: { left: 20, right: 20 },
          });
          yPos = (doc as any).lastAutoTable?.finalY + 5 || yPos + 50;
          break;
        case "preorder_cost_summary": {
          const xL = 120, xV = 185;
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Quote Summary", 20, yPos); yPos += 8;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
          doc.text("Product Cost:", xL, yPos); doc.text(`${template.currencySymbol} 6,000`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Shipping Fee:", xL, yPos); doc.text(`${template.currencySymbol} 1,200`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Tax / Customs:", xL, yPos); doc.text(`${template.currencySymbol} 400`, xV, yPos, { align: "right" }); yPos += 8;
          doc.setDrawColor(200, 200, 200); doc.line(xL, yPos - 3, xV, yPos - 3);
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Grand Total:", xL, yPos + 2); doc.text(`${template.currencySymbol} 7,600`, xV, yPos + 2, { align: "right" });
          yPos += 12;
          break;
        }
        case "preorder_arrival_charges": {
          const xL = 120, xV = 185;
          doc.setFontSize(10); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Arrival Charges", 20, yPos); yPos += 7;
          doc.setFont(template.fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
          doc.text("Arrival Shipping:", xL, yPos); doc.text(`${template.currencySymbol} 900`, xV, yPos, { align: "right" }); yPos += 6;
          doc.text("Arrival Tax / Customs:", xL, yPos); doc.text(`${template.currencySymbol} 500`, xV, yPos, { align: "right" }); yPos += 8;
          doc.setDrawColor(200, 200, 200); doc.line(xL, yPos - 3, xV, yPos - 3);
          doc.setFontSize(11); doc.setFont(template.fontFamily, "bold"); doc.setTextColor(0, 0, 0);
          doc.text("Arrival Total:", xL, yPos + 2); doc.text(`${template.currencySymbol} 1,400`, xV, yPos + 2, { align: "right" });
          yPos += 12;
          break;
        }
        case "notes": doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.text("Note: This is a quote invoice. Final charges may vary.", 20, yPos); yPos += 6; break;
        case "footer": doc.setFont(template.fontFamily, "normal"); doc.setFontSize(fs); doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.text(block.content || "Thank you!", 105, 285, { align: "center" }); break;
        case "custom_text": doc.text(block.content || "", xPos, yPos, { align: halign }); yPos += fs * 0.45; break;
      }
    }
    doc.save(`PreOrder-Invoice-Preview.pdf`);
  };

  const selectedBlockData = template.blocks.find(b => b.id === selectedBlock);

  const DOC_TYPE_LABELS: Record<DocType, { label: string; icon: React.ReactNode; color: string }> = {
    standard: { label: "Standard Orders", icon: <FileText className="w-3.5 h-3.5" />, color: "text-blue-600" },
    pcb: { label: "PCB Orders", icon: <Cpu className="w-3.5 h-3.5" />, color: "text-green-600" },
    preorder: { label: "Pre-Orders", icon: <Package className="w-3.5 h-3.5" />, color: "text-orange-600" },
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-8rem)] min-h-0">

      {/* ── Doc Type Tabs ──── */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit flex-shrink-0">
        {(["standard", "pcb", "preorder"] as DocType[]).map(dt => {
          const info = DOC_TYPE_LABELS[dt];
          return (
            <button
              key={dt}
              onClick={() => { setDocType(dt); setSelectedBlock(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                docType === dt
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={docType === dt ? info.color : ""}>{info.icon}</span>
              {info.label}
            </button>
          );
        })}
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── LEFT: Block List ─────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Template Blocks</h3>
            <Button size="sm" variant="outline" onClick={addCustomBlock} className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Add Text
            </Button>
          </div>

          <p className="text-xs text-muted-foreground -mt-1">Drag to reorder · Click to edit</p>

          <div className="space-y-1.5">
            <AnimatePresence>
              {template.blocks.map((block, index) => (
                <motion.div
                  key={block.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  onClick={() => setSelectedBlock(block.id === selectedBlock ? null : block.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                    selectedBlock === block.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  } ${!block.visible ? "opacity-50" : ""}`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 cursor-grab" />
                  <span className="text-muted-foreground flex-shrink-0">{BLOCK_ICONS[block.type] || <Type className="w-4 h-4" />}</span>
                  <span className="text-xs font-medium text-foreground flex-1 truncate">{block.label}</span>
                  <Switch
                    checked={block.visible}
                    onCheckedChange={(v) => { updateBlock(block.id, { visible: v }); }}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75"
                  />
                  {block.type === "custom_text" && (
                    <button onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Global Settings */}
          <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Global Settings</h4>

            <div>
              <Label className="text-xs">Primary Color (Table Header)</Label>
              <div className="flex gap-2 mt-1">
                <input type="color" value={template.primaryColor} onChange={(e) => setTemplate(t => ({ ...t, primaryColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border border-border" />
                <Input value={template.primaryColor} onChange={(e) => setTemplate(t => ({ ...t, primaryColor: e.target.value }))} className="h-8 text-xs font-mono" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Accent Color (Dividers)</Label>
              <div className="flex gap-2 mt-1">
                <input type="color" value={template.accentColor} onChange={(e) => setTemplate(t => ({ ...t, accentColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border border-border" />
                <Input value={template.accentColor} onChange={(e) => setTemplate(t => ({ ...t, accentColor: e.target.value }))} className="h-8 text-xs font-mono" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Currency Symbol</Label>
              <Input value={template.currencySymbol} onChange={(e) => setTemplate(t => ({ ...t, currencySymbol: e.target.value }))} className="h-8 text-xs mt-1" placeholder="Rs." />
            </div>

            <div>
              <Label className="text-xs">Font</Label>
              <Select value={template.fontFamily} onValueChange={(v) => setTemplate(t => ({ ...t, fontFamily: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="helvetica">Helvetica</SelectItem>
                  <SelectItem value="times">Times New Roman</SelectItem>
                  <SelectItem value="courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Paper Size</Label>
              <Select value={template.paperSize} onValueChange={(v: "a4" | "letter") => setTemplate(t => ({ ...t, paperSize: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Logo upload */}
            <div>
              <Label className="text-xs">Logo Image</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
              <div className="mt-1 space-y-1.5">
                {template.logoUrl && <img src={template.logoUrl} alt="Logo" className="h-10 object-contain rounded border border-border" />}
                <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {template.logoUrl ? "Change Logo" : "Upload Logo"}
                </Button>
                {template.logoUrl && (
                  <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-destructive" onClick={() => setTemplate(t => ({ ...t, logoUrl: "" }))}>
                    Remove Logo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CENTER: Visual Preview ─────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Preview — {DOC_TYPE_LABELS[docType].label}</h3>
              <p className="text-xs text-muted-foreground">Use "Download Preview" to see exact PDF output</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generatePreviewPDF} disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                Download Preview PDF
              </Button>
              <Button size="sm" onClick={saveTemplate} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Template
              </Button>
            </div>
          </div>

          {/* Paper preview */}
          <div className="flex-1 overflow-y-auto">
            <div
              className="bg-white shadow-xl mx-auto rounded-sm"
              style={{ width: "595px", minHeight: "842px", padding: "40px", fontFamily: template.fontFamily === "helvetica" ? "Arial, sans-serif" : template.fontFamily === "times" ? "Georgia, serif" : "Courier, monospace" }}
            >
              {template.blocks.filter(b => b.visible).map((block) => (
                <PreviewBlock
                  key={block.id}
                  block={block}
                  template={template}
                  company={companySettings || {}}
                  docType={docType}
                  isSelected={selectedBlock === block.id}
                  onClick={() => setSelectedBlock(block.id === selectedBlock ? null : block.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Block Properties ───────────────────────────── */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedBlockData ? (
              <motion.div key={selectedBlockData.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <h3 className="font-semibold text-sm text-foreground">{selectedBlockData.label}</h3>

                <div>
                  <Label className="text-xs">Alignment</Label>
                  <div className="flex gap-1 mt-1">
                    {(["left", "center", "right"] as const).map(a => (
                      <button key={a} onClick={() => updateBlock(selectedBlockData.id, { align: a })}
                        className={`flex-1 h-8 rounded border text-xs transition-colors ${selectedBlockData.align === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
                      >
                        {a === "left" ? <AlignLeft className="w-3.5 h-3.5 mx-auto" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5 mx-auto" /> : <AlignRight className="w-3.5 h-3.5 mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBlockData.fontSize !== undefined && (
                  <div>
                    <Label className="text-xs">Font Size: {selectedBlockData.fontSize}pt</Label>
                    <input type="range" min={7} max={28} value={selectedBlockData.fontSize}
                      onChange={(e) => updateBlock(selectedBlockData.id, { fontSize: Number(e.target.value) })}
                      className="w-full mt-1 accent-primary" />
                  </div>
                )}

                {selectedBlockData.color !== undefined && (
                  <div>
                    <Label className="text-xs">Text Color</Label>
                    <div className="flex gap-2 mt-1">
                      <input type="color" value={selectedBlockData.color}
                        onChange={(e) => updateBlock(selectedBlockData.id, { color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-border" />
                      <Input value={selectedBlockData.color}
                        onChange={(e) => updateBlock(selectedBlockData.id, { color: e.target.value })}
                        className="h-8 text-xs font-mono" />
                    </div>
                  </div>
                )}

                {selectedBlockData.bold !== undefined && (
                  <div className="flex items-center gap-2">
                    <Switch checked={selectedBlockData.bold} onCheckedChange={(v) => updateBlock(selectedBlockData.id, { bold: v })} />
                    <Label className="text-xs">Bold</Label>
                  </div>
                )}

                {selectedBlockData.type === "custom_text" && (
                  <div>
                    <Label className="text-xs">Content</Label>
                    <Textarea value={selectedBlockData.content || ""} rows={3}
                      onChange={(e) => updateBlock(selectedBlockData.id, { content: e.target.value })}
                      className="text-xs mt-1" placeholder="Enter text..." />
                  </div>
                )}

                {selectedBlockData.type === "footer" && (
                  <div>
                    <Label className="text-xs">Footer Text</Label>
                    <Textarea value={selectedBlockData.content || ""} rows={2}
                      onChange={(e) => updateBlock(selectedBlockData.id, { content: e.target.value })}
                      className="text-xs mt-1" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch checked={selectedBlockData.visible} onCheckedChange={(v) => updateBlock(selectedBlockData.id, { visible: v })} />
                  <Label className="text-xs">Visible</Label>
                </div>

                <div>
                  <Label className="text-xs">Block Label (internal)</Label>
                  <Input value={selectedBlockData.label} onChange={(e) => updateBlock(selectedBlockData.id, { label: e.target.value })} className="h-8 text-xs mt-1" />
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Click a block to edit its properties</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset button */}
          <div className="mt-6 pt-4 border-t border-border">
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 text-muted-foreground" onClick={() => {
              setTemplate(() => ({ ...DEFAULT_TEMPLATE, blocks: DEFAULT_BLOCKS[docType] }));
              setSelectedBlock(null);
              toast({ title: "Template reset to default" });
            }}>
              <RefreshCw className="w-3 h-3" />
              Reset to Default
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Image loader helper ──────────────────────────────────────────────────────

async function loadImageData(url: string): Promise<{ dataUrl: string; w: number; h: number }> {
  const isSvg = url.toLowerCase().includes(".svg") || url.startsWith("data:image/svg");

  // Fetch as blob to avoid canvas CORS taint issues with cross-origin images
  const res = await fetch(url);
  let objectUrl: string;

  if (isSvg) {
    const svgText = await res.text();
    const sized = svgText.replace(/<svg([^>]*)>/i, (_m, attrs) => {
      const extra = `${!/width\s*=/i.test(attrs) ? ' width="400"' : ""}${!/height\s*=/i.test(attrs) ? ' height="160"' : ""}`;
      return `<svg${attrs}${extra}>`;
    });
    objectUrl = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  } else {
    objectUrl = URL.createObjectURL(await res.blob());
  }

  return new Promise<{ dataUrl: string; w: number; h: number }>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const W = img.width || 400;
      const H = img.height || 160;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.getContext("2d")?.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(objectUrl);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: W, h: H });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image render failed"));
    };
    img.src = objectUrl;
  });
}

function logoPdfSize(w: number, h: number, maxW = 60): [number, number] {
  const pdfW = Math.min(maxW, 60);
  return [pdfW, pdfW * (h / w)];
}

// ─── Preview Block Component ──────────────────────────────────────────────────

const DUMMY_COMPANY = { store_name: "Your Store", address: "123 Main Street, Colombo 03", phone: "+94 77 123 4567", email: "hello@yourstore.com" };

const PreviewBlock = ({ block, template, company, docType, isSelected, onClick }: {
  block: TemplateBlock; template: InvoiceTemplate; company: any; docType: DocType; isSelected: boolean; onClick: () => void;
}) => {
  const comp = { ...DUMMY_COMPANY, ...company };
  const align = block.align === "center" ? "center" : block.align === "right" ? "right" : "left";
  const style: React.CSSProperties = {
    textAlign: align,
    fontSize: `${(block.fontSize || 10) * 1.2}px`,
    fontWeight: block.bold ? "bold" : "normal",
    color: block.color || "#000000",
  };
  const wrapperClass = `cursor-pointer rounded transition-all px-1 py-0.5 ${isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/30"}`;

  const getInvoiceTitle = () => {
    if (docType === "pcb") return "PCB ORDER INVOICE";
    if (docType === "preorder") return "PRE-ORDER INVOICE";
    return "INVOICE";
  };

  const renderContent = () => {
    switch (block.type) {
      case "logo":
        return template.logoUrl ? (
          <img src={template.logoUrl} alt="Logo" className="h-10 object-contain" style={{ display: align === "right" ? "block" : "inline-block", marginLeft: align === "right" ? "auto" : "0" }} />
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border-2 border-dashed border-muted-foreground/30 text-muted-foreground text-xs">
            <Image className="w-4 h-4" /> Logo placeholder
          </div>
        );
      case "company_name": return <div style={style}>{comp.store_name}</div>;
      case "company_address": return <div style={style}>{comp.address}</div>;
      case "company_contact": return <div style={style}>{[comp.phone, comp.email].filter(Boolean).join(" | ")}</div>;
      case "divider": return <hr style={{ borderColor: template.accentColor, borderTopWidth: "1px", margin: "4px 0" }} />;
      case "invoice_title": return <div style={style}>{getInvoiceTitle()}</div>;
      case "invoice_meta":
        return (
          <div style={{ ...style, lineHeight: 1.8 }}>
            <div>Invoice #: {docType === "pcb" ? "PCB-ABCD1234" : docType === "preorder" ? "PRE-ABCD1234" : "INV-ABCD1234"}</div>
            <div>Date: {new Date().toLocaleDateString()}</div>
            <div>Status: {docType === "standard" ? "PAID" : "MANUFACTURING"}</div>
          </div>
        );
      case "ship_to":
        return (
          <div style={style}>
            <div className="font-bold text-black mb-1" style={{ fontSize: `${(block.fontSize || 9) * 1.4}px` }}>Customer:</div>
            <div>Kasun Perera</div>
            <div>Phone: 0771234567</div>
            {docType === "standard" && <div>123 Galle Road, Colombo</div>}
          </div>
        );
      case "items_table":
        return (
          <table className="w-full text-xs border-collapse mt-2 mb-2">
            <thead>
              <tr style={{ backgroundColor: template.primaryColor, color: "#fff" }}>
                <th className="p-1.5 text-center w-6">#</th>
                <th className="p-1.5 text-left">Product</th>
                <th className="p-1.5 text-center w-10">Qty</th>
                <th className="p-1.5 text-right w-20">Unit Price</th>
                <th className="p-1.5 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {DUMMY_ORDER.order_items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td className="p-1.5 text-center">{i + 1}</td>
                  <td className="p-1.5">{item.products?.name}</td>
                  <td className="p-1.5 text-center">{item.quantity}</td>
                  <td className="p-1.5 text-right">{template.currencySymbol} {item.unit_price.toLocaleString()}</td>
                  <td className="p-1.5 text-right">{template.currencySymbol} {item.total_price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "totals":
        return (
          <div style={{ ...style, lineHeight: 2 }} className="ml-auto w-52">
            <div className="flex justify-between"><span>Subtotal:</span><span>{template.currencySymbol} 4,250</span></div>
            <div className="flex justify-between text-green-600"><span>Discount:</span><span>-{template.currencySymbol} 200</span></div>
            <div className="flex justify-between"><span>Shipping:</span><span>{template.currencySymbol} 350</span></div>
            <hr className="my-1" style={{ borderColor: "#ddd" }} />
            <div className="flex justify-between font-bold text-black text-sm"><span>Total:</span><span>{template.currencySymbol} 4,400</span></div>
          </div>
        );
      case "pcb_specs_table":
        return (
          <table className="w-full text-xs border-collapse mt-2 mb-2">
            <thead><tr style={{ backgroundColor: template.primaryColor, color: "#fff" }}><th className="p-1.5 text-left">Board Specification</th><th className="p-1.5 text-left">Value</th></tr></thead>
            <tbody>
              {[["Quantity", "10 pcs"], ["Layer Count", "2 Layers"], ["Surface Finish", "HASL"], ["Board Thickness", "1.6mm"], ["Solder Mask Color", "Green"]].map(([k, v], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td className="p-1.5 font-semibold">{k}</td><td className="p-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "pcb_cost_summary":
      case "preorder_cost_summary":
        return (
          <div style={{ lineHeight: 2 }} className="ml-auto w-52">
            <div className="font-bold text-black mb-1 text-sm">Quote Summary</div>
            <div className="flex justify-between text-xs" style={{ color: "#555" }}><span>Manufacturing Cost:</span><span>{template.currencySymbol} 4,500</span></div>
            <div className="flex justify-between text-xs" style={{ color: "#555" }}><span>Shipping Fee:</span><span>{template.currencySymbol} 800</span></div>
            <div className="flex justify-between text-xs" style={{ color: "#555" }}><span>Tax / Customs:</span><span>{template.currencySymbol} 200</span></div>
            <hr className="my-1" style={{ borderColor: "#ddd" }} />
            <div className="flex justify-between font-bold text-black text-sm"><span>Grand Total:</span><span>{template.currencySymbol} 5,500</span></div>
          </div>
        );
      case "pcb_arrival_charges":
      case "preorder_arrival_charges":
        return (
          <div style={{ lineHeight: 2 }} className="ml-auto w-52 mt-2">
            <div className="font-bold text-black mb-1">Arrival Charges</div>
            <div className="flex justify-between text-xs" style={{ color: "#555" }}><span>Arrival Shipping:</span><span>{template.currencySymbol} 600</span></div>
            <div className="flex justify-between text-xs" style={{ color: "#555" }}><span>Arrival Tax:</span><span>{template.currencySymbol} 300</span></div>
            <hr className="my-1" style={{ borderColor: "#ddd" }} />
            <div className="flex justify-between font-bold text-black text-sm"><span>Arrival Total:</span><span>{template.currencySymbol} 900</span></div>
          </div>
        );
      case "preorder_items_table":
        return (
          <table className="w-full text-xs border-collapse mt-2 mb-2">
            <thead><tr style={{ backgroundColor: template.primaryColor, color: "#fff" }}>
              <th className="p-1.5 text-center w-6">#</th><th className="p-1.5 text-left">Product</th>
              <th className="p-1.5 text-center w-10">Qty</th><th className="p-1.5 text-right w-20">Unit Price</th><th className="p-1.5 text-right w-20">Total</th>
            </tr></thead>
            <tbody>
              {DUMMY_PREORDER.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td className="p-1.5 text-center">{i + 1}</td>
                  <td className="p-1.5">{item.product_name}</td>
                  <td className="p-1.5 text-center">{item.quantity}</td>
                  <td className="p-1.5 text-right">{template.currencySymbol} {(item.unit_price || 0).toLocaleString()}</td>
                  <td className="p-1.5 text-right">{template.currencySymbol} {((item.unit_price || 0) * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "notes":
        return <div style={style} className="italic">Notes: Thank you for your order. Please contact us for any queries.</div>;
      case "footer":
        return <div style={{ ...style, color: block.color || "#aaaaaa" }}>{block.content || "Thank you for your purchase!"}</div>;
      case "custom_text":
        return <div style={style}>{block.content || "Custom text block"}</div>;
      default:
        return null;
    }
  };

  return (
    <div className={wrapperClass} onClick={onClick}>
      {renderContent()}
    </div>
  );
};

export default InvoiceTemplateBuilder;
export type { InvoiceTemplate };
