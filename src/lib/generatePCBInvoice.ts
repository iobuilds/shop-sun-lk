import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

interface PCBOrder {
  id: string;
  created_at: string;
  quantity: number;
  layer_count: number;
  surface_finish: string;
  board_thickness: string;
  pcb_color: string;
  unit_cost_total: number | null;
  shipping_fee: number | null;
  tax_amount: number | null;
  grand_total: number | null;
  arrival_shipping_fee?: number | null;
  arrival_tax_amount?: number | null;
  customer_note?: string | null;
  admin_notes?: string | null;
  status: string;
  payment_status: string;
  gerber_file_name?: string | null;
}

interface CompanyInfo {
  store_name?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface CustomerInfo {
  full_name?: string | null;
  phone?: string | null;
}

interface SavedTemplate {
  blocks?: any[];
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  paperSize?: "a4" | "letter";
  currencySymbol?: string;
}

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
}

async function loadPCBTemplate(): Promise<SavedTemplate> {
  try {
    const { data } = await supabase.from("site_settings" as any).select("value").eq("key", "pcb_invoice_template").maybeSingle();
    return (data as any)?.value || {};
  } catch {
    return {};
  }
}

export const generatePCBInvoice = async (
  order: PCBOrder,
  company?: CompanyInfo,
  customer?: CustomerInfo
) => {
  const tpl = await loadPCBTemplate();

  const primaryColor = tpl.primaryColor || "#282828";
  const accentColor = tpl.accentColor || "#dddddd";
  const fontFamily = tpl.fontFamily || "helvetica";
  const paperSize = tpl.paperSize || "a4";
  const currencySymbol = tpl.currencySymbol || "Rs.";
  const logoUrl = tpl.logoUrl || company?.logo_url || "";

  const primRgb = hexToRgb(primaryColor);
  const accRgb = hexToRgb(accentColor);

  const doc = new jsPDF({ format: paperSize });
  const storeName = company?.store_name || "NanoCircuit.lk";
  const shortId = order.id.slice(0, 8).toUpperCase();

  // Header logo/name
  let headerY = 25;
  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl);
      doc.addImage(img, "PNG", 20, 12, 40, 16);
      headerY = 32;
    } catch {
      doc.setFontSize(22);
      doc.setFont(fontFamily, "bold");
      doc.text(storeName, 20, 25);
    }
  } else {
    doc.setFontSize(22);
    doc.setFont(fontFamily, "bold");
    doc.text(storeName, 20, 25);
  }

  doc.setFontSize(8);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(120, 120, 120);
  let compY = headerY + 5;
  if (company?.address) { doc.text(company.address, 20, compY); compY += 4; }
  if (company?.phone) { doc.text(`Tel: ${company.phone}`, 20, compY); compY += 4; }
  if (company?.email) { doc.text(company.email, 20, compY); compY += 4; }

  // Invoice title block (right side)
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, "bold");
  doc.text("PCB ORDER INVOICE", 150, 22, { align: "right" });

  doc.setFontSize(9);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice #: PCB-${shortId}`, 190, 30, { align: "right" });
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 190, 37, { align: "right" });
  doc.text(`Status: ${order.status.toUpperCase()}`, 190, 44, { align: "right" });

  // Divider
  doc.setDrawColor(accRgb.r, accRgb.g, accRgb.b);
  doc.line(20, 58, 190, 58);

  // Customer info
  let y = 67;
  if (customer?.full_name || customer?.phone) {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont(fontFamily, "bold");
    doc.text("Customer:", 20, y); y += 6;
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    if (customer.full_name) { doc.text(customer.full_name, 20, y); y += 5; }
    if (customer.phone) { doc.text(`Phone: ${customer.phone}`, 20, y); y += 5; }
    y += 3;
  }

  // Board specs table
  const specsData: [string, string][] = [
    ["Quantity", `${order.quantity} pcs`],
    ["Board Thickness", order.board_thickness],
    ["Solder Mask Color", order.pcb_color],
  ];

  if (order.gerber_file_name) {
    specsData.push(["Gerber File(s)", order.gerber_file_name]);
  }

  autoTable(doc, {
    startY: Math.max(y, 75),
    head: [["Board Specification", "Value"]],
    body: specsData,
    theme: "grid",
    headStyles: { fillColor: [primRgb.r, primRgb.g, primRgb.b], textColor: 255, fontSize: 9, font: fontFamily },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60], font: fontFamily },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 100 },
    },
    margin: { left: 20, right: 20 },
  });

  // Quote / Cost Summary
  const tableEndY = (doc as any).lastAutoTable?.finalY || 150;
  let summaryY = tableEndY + 12;

  const xLabel = 120;
  const xValue = 185;

  // Parse revision data from admin_notes
  const noteLines = (order.admin_notes || "").split("\n");
  const revExtraLine = noteLines.find(l => l.startsWith("[revision_extra]:"));
  const revNoteLine = noteLines.find(l => l.startsWith("[revision_note]:"));
  const revisionExtra = revExtraLine ? parseFloat(revExtraLine.replace("[revision_extra]:", "")) || 0 : 0;
  const revisionNote = revNoteLine ? revNoteLine.replace("[revision_note]:", "").trim() : "";

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, "bold");
  doc.text("Quote Summary", 20, summaryY);
  summaryY += 8;

  doc.setFontSize(9);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(80, 80, 80);

  const boardCostTotal = Number(order.unit_cost_total || 0);
  const shippingFee = Number(order.shipping_fee || 0);
  const taxAmount = Number(order.tax_amount || 0);
  const grandTotal = Number(order.grand_total || 0);

  // Show initial cost vs revision extra if applicable
  if (revisionExtra > 0) {
    const initialCost = boardCostTotal - revisionExtra;
    doc.text("Initial Board Cost:", xLabel, summaryY);
    doc.text(`${currencySymbol} ${initialCost.toLocaleString()}`, xValue, summaryY, { align: "right" });
    summaryY += 6;
    doc.setTextColor(180, 100, 0);
    doc.text("Revision Additional Charge:", xLabel, summaryY);
    doc.text(`+ ${currencySymbol} ${revisionExtra.toLocaleString()}`, xValue, summaryY, { align: "right" });
    summaryY += 6;
    doc.setTextColor(80, 80, 80);
    if (revisionNote) {
      doc.setFontSize(8);
      doc.setFont(fontFamily, "italic");
      const rLines = doc.splitTextToSize(`Revision note: ${revisionNote}`, 165);
      doc.text(rLines, 20, summaryY);
      summaryY += rLines.length * 4 + 3;
      doc.setFontSize(9);
      doc.setFont(fontFamily, "normal");
    }
    doc.text("Board Cost (with revision):", xLabel, summaryY);
    doc.text(`${currencySymbol} ${boardCostTotal.toLocaleString()}`, xValue, summaryY, { align: "right" });
    summaryY += 6;
  } else {
    doc.text("Board Manufacturing Cost:", xLabel, summaryY);
    doc.text(`${currencySymbol} ${boardCostTotal.toLocaleString()}`, xValue, summaryY, { align: "right" });
    summaryY += 6;
  }

  doc.text("Shipping Fee:", xLabel, summaryY);
  doc.text(order.shipping_fee === -1 ? "TBA (After Arrival)" : `${currencySymbol} ${shippingFee.toLocaleString()}`, xValue, summaryY, { align: "right" });
  summaryY += 6;

  doc.text("Tax / Customs:", xLabel, summaryY);
  doc.text(order.tax_amount === -1 ? "TBA (After Arrival)" : `${currencySymbol} ${taxAmount.toLocaleString()}`, xValue, summaryY, { align: "right" });
  summaryY += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(xLabel, summaryY - 3, xValue, summaryY - 3);

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, "bold");
  doc.text("Grand Total:", xLabel, summaryY + 2);
  doc.text(`${currencySymbol} ${grandTotal.toLocaleString()}`, xValue, summaryY + 2, { align: "right" });
  summaryY += 12;

  // Arrival charges section (if any)
  const arrShipping = Number(order.arrival_shipping_fee || 0);
  const arrTax = Number(order.arrival_tax_amount || 0);
  if (arrShipping > 0 || arrTax > 0) {
    doc.setFontSize(10);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Arrival Charges", 20, summaryY);
    summaryY += 7;

    doc.setFontSize(9);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Arrival Shipping:", xLabel, summaryY);
    doc.text(`${currencySymbol} ${arrShipping.toLocaleString()}`, xValue, summaryY, { align: "right" });
    summaryY += 6;

    doc.text("Arrival Tax / Customs:", xLabel, summaryY);
    doc.text(`${currencySymbol} ${arrTax.toLocaleString()}`, xValue, summaryY, { align: "right" });
    summaryY += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(xLabel, summaryY - 3, xValue, summaryY - 3);

    doc.setFontSize(11);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Arrival Total:", xLabel, summaryY + 2);
    doc.text(`${currencySymbol} ${(arrShipping + arrTax).toLocaleString()}`, xValue, summaryY + 2, { align: "right" });
    summaryY += 12;
  }

  // Admin/customer notes
  if (order.admin_notes) {
    const SKIP_PREFIXES = ["stripe_session:", "[revision_images]:", "[revision_extra]:", "[revision_note]:", "[revision_slip]:"];
    const cleanNotes = order.admin_notes
      .split("\n")
      .filter((l: string) => !SKIP_PREFIXES.some(p => l.startsWith(p)))
      .join("\n")
      .trim();
    if (cleanNotes) {
      doc.setFontSize(9);
      doc.setFont(fontFamily, "italic");
      doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(`Note: ${cleanNotes}`, 165);
      doc.text(lines, 20, summaryY);
      summaryY += lines.length * 5 + 4;
    }
  }

  // Footer
  const footerY = paperSize === "letter" ? 265 : 278;
  doc.setFontSize(8);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("This is a quote invoice. Final charges may vary based on exact order requirements.", 105, footerY - 8, { align: "center" });

  // Get footer text from template blocks if available
  const footerBlock = tpl.blocks?.find((b: any) => b.type === "footer" && b.visible !== false);
  const footerText = footerBlock?.content
    ? footerBlock.content
    : (company?.website ? `Thank you for choosing ${storeName}! | ${company.website}` : `Thank you for choosing ${storeName}!`);
  doc.text(footerText, 105, footerY, { align: "center" });

  doc.save(`PCB-Invoice-${shortId}.pdf`);
};
