import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceOrder {
  id: string;
  created_at: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  coupon_code?: string | null;
  referral_code?: string | null;
  referral_discount?: number;
  shipping_address?: any;
  order_items: {
    quantity: number;
    unit_price: number;
    total_price: number;
    products: { name: string } | null;
  }[];
}

interface CompanyInfo {
  store_name?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
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

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
}

async function loadStandardTemplate(): Promise<SavedTemplate> {
  try {
    const { data } = await (supabase as any).from("site_settings").select("value").eq("key", "invoice_template").maybeSingle();
    return (data as any)?.value || {};
  } catch {
    return {};
  }
}

export const generateAdminInvoice = async (order: InvoiceOrder, company?: CompanyInfo) => {
  const tpl = await loadStandardTemplate();

  const primaryColor = tpl.primaryColor || "#323232";
  const accentColor = tpl.accentColor || "#dddddd";
  const fontFamily = tpl.fontFamily || "helvetica";
  const paperSize = tpl.paperSize || "a4";
  const currencySymbol = tpl.currencySymbol || "Rs.";
  const logoUrl = tpl.logoUrl || company?.logo_url || "";

  const primRgb = hexToRgb(primaryColor);
  const accRgb = hexToRgb(accentColor);

  const doc = new jsPDF({ format: paperSize });
  const addr = order.shipping_address || {};
  const storeName = company?.store_name || "NanoCircuit.lk";

  // Header - try logo first, fallback to text
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

  // Company details
  doc.setFontSize(8);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(120, 120, 120);
  let compY = headerY + 5;
  if (company?.address) { doc.text(company.address, 20, compY); compY += 4; }
  if (company?.phone) { doc.text(`Tel: ${company.phone}`, 20, compY); compY += 4; }
  if (company?.email) { doc.text(company.email, 20, compY); compY += 4; }

  // Invoice title
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, "bold");
  doc.text("INVOICE", 150, 25);

  // Invoice meta
  doc.setFontSize(9);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice #: INV-${order.id.slice(0, 8).toUpperCase()}`, 150, 33);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 150, 39);
  const payLabel = order.payment_method === "stripe" ? "Card (Stripe)" : order.payment_method === "free" ? "Wallet/Coupon" : "Bank Transfer";
  doc.text(`Payment: ${payLabel}`, 150, 45);
  doc.text(`Status: ${order.payment_status.toUpperCase()}`, 150, 51);

  // Divider
  doc.setDrawColor(accRgb.r, accRgb.g, accRgb.b);
  doc.line(20, 58, 190, 58);

  // Ship to
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, "bold");
  doc.text("Ship To:", 20, 67);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let y = 73;
  if (addr.full_name) { doc.text(addr.full_name, 20, y); y += 5; }
  if (addr.address_line1) { doc.text(addr.address_line1, 20, y); y += 5; }
  if (addr.address_line2) { doc.text(addr.address_line2, 20, y); y += 5; }
  if (addr.city || addr.postal_code) { doc.text(`${addr.city || ""} ${addr.postal_code || ""}`.trim(), 20, y); y += 5; }
  if (addr.phone) { doc.text(`Phone: ${addr.phone}`, 20, y); y += 5; }

  // Items table
  const tableData = order.order_items.map((item, i) => [
    String(i + 1),
    item.products?.name || "Product",
    String(item.quantity),
    `${currencySymbol} ${item.unit_price.toLocaleString()}`,
    `${currencySymbol} ${item.total_price.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: Math.max(y + 5, 95),
    head: [["#", "Product", "Qty", "Unit Price", "Total"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [primRgb.r, primRgb.g, primRgb.b], textColor: 255, fontSize: 9, font: fontFamily },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60], font: fontFamily },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 20, right: 20 },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  let summaryY = finalY + 10;
  const xLabel = 130;
  const xValue = 185;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont(fontFamily, "normal");
  doc.text("Subtotal:", xLabel, summaryY);
  doc.text(`${currencySymbol} ${order.subtotal.toLocaleString()}`, xValue, summaryY, { align: "right" });
  summaryY += 6;

  if (order.discount_amount > 0) {
    const couponLabel = order.coupon_code ? `Discount (${order.coupon_code}):` : "Discount:";
    doc.text(couponLabel, xLabel, summaryY);
    doc.setTextColor(0, 150, 0);
    doc.text(`-${currencySymbol} ${order.discount_amount.toLocaleString()}`, xValue, summaryY, { align: "right" });
    doc.setTextColor(80, 80, 80);
    summaryY += 6;
  }

  if (order.referral_code && (order.referral_discount ?? 0) > 0) {
    doc.text(`Referral (${order.referral_code}):`, xLabel, summaryY);
    doc.setTextColor(0, 150, 0);
    doc.text(`-${currencySymbol} ${(order.referral_discount ?? 0).toLocaleString()}`, xValue, summaryY, { align: "right" });
    doc.setTextColor(80, 80, 80);
    summaryY += 6;
  } else if (order.referral_code) {
    doc.text(`Referral Code: ${order.referral_code}`, xLabel, summaryY);
    doc.setTextColor(120, 120, 120);
    doc.text("Reference only", xValue, summaryY, { align: "right" });
    doc.setTextColor(80, 80, 80);
    summaryY += 6;
  }

  doc.text("Shipping:", xLabel, summaryY);
  doc.text(order.shipping_fee > 0 ? `${currencySymbol} ${order.shipping_fee.toLocaleString()}` : "Free", xValue, summaryY, { align: "right" });
  summaryY += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(xLabel, summaryY - 3, xValue, summaryY - 3);

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, "bold");
  doc.text("Total:", xLabel, summaryY + 2);
  doc.text(`${currencySymbol} ${order.total.toLocaleString()}`, xValue, summaryY + 2, { align: "right" });

  // Footer - get from template blocks if available
  const footerY = paperSize === "letter" ? 265 : 280;
  const footerBlock = tpl.blocks?.find((b: any) => b.type === "footer" && b.visible !== false);
  const footerText = footerBlock?.content
    ? footerBlock.content
    : (company?.website ? `Thank you for shopping with ${storeName}! | ${company.website}` : `Thank you for shopping with ${storeName}!`);
  doc.setFontSize(8);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(footerText, 105, footerY, { align: "center" });

  doc.save(`Invoice-${order.id.slice(0, 8).toUpperCase()}.pdf`);
};

async function loadImage(url: string): Promise<string> {
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

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.width || 400;
      const H = img.height || 160;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.getContext("2d")?.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image render failed"));
    };
    img.src = objectUrl;
  });
}
