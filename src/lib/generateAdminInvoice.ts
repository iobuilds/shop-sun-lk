import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export const generateAdminInvoice = async (order: InvoiceOrder, company?: CompanyInfo) => {
  const doc = new jsPDF();
  const addr = order.shipping_address || {};
  const storeName = company?.store_name || "TechLK";

  // Header - try logo first, fallback to text
  let headerY = 25;
  if (company?.logo_url) {
    try {
      const img = await loadImage(company.logo_url);
      doc.addImage(img, "PNG", 20, 12, 40, 16);
      headerY = 32;
    } catch {
      // Logo failed, use text
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(storeName, 20, 25);
    }
  } else {
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(storeName, 20, 25);
  }

  // Company details under logo/name
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  let compY = headerY + 5;
  if (company?.address) { doc.text(company.address, 20, compY); compY += 4; }
  if (company?.phone) { doc.text(`Tel: ${company.phone}`, 20, compY); compY += 4; }
  if (company?.email) { doc.text(company.email, 20, compY); compY += 4; }

  // Invoice title
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 150, 25);

  // Invoice meta
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice #: INV-${order.id.slice(0, 8).toUpperCase()}`, 150, 33);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 150, 39);
  const payLabel = order.payment_method === "stripe" ? "Card (Stripe)" : order.payment_method === "free" ? "Wallet/Coupon" : "Bank Transfer";
  doc.text(`Payment: ${payLabel}`, 150, 45);
  doc.text(`Status: ${order.payment_status.toUpperCase()}`, 150, 51);

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 58, 190, 58);

  // Ship to
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Ship To:", 20, 67);
  doc.setFont("helvetica", "normal");
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
    `Rs. ${item.unit_price.toLocaleString()}`,
    `Rs. ${item.total_price.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: Math.max(y + 5, 95),
    head: [["#", "Product", "Qty", "Unit Price", "Total"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
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
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", xLabel, summaryY);
  doc.text(`Rs. ${order.subtotal.toLocaleString()}`, xValue, summaryY, { align: "right" });
  summaryY += 6;

  if (order.discount_amount > 0) {
    const couponLabel = order.coupon_code ? `Discount (${order.coupon_code}):` : "Discount:";
    doc.text(couponLabel, xLabel, summaryY);
    doc.setTextColor(0, 150, 0);
    doc.text(`-Rs. ${order.discount_amount.toLocaleString()}`, xValue, summaryY, { align: "right" });
    doc.setTextColor(80, 80, 80);
    summaryY += 6;
  }

  doc.text("Shipping:", xLabel, summaryY);
  doc.text(order.shipping_fee > 0 ? `Rs. ${order.shipping_fee.toLocaleString()}` : "Free", xValue, summaryY, { align: "right" });
  summaryY += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(xLabel, summaryY - 3, xValue, summaryY - 3);

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Total:", xLabel, summaryY + 2);
  doc.text(`Rs. ${order.total.toLocaleString()}`, xValue, summaryY + 2, { align: "right" });

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  const footerText = company?.website ? `Thank you for shopping with ${storeName}! | ${company.website}` : `Thank you for shopping with ${storeName}!`;
  doc.text(footerText, 105, 280, { align: "center" });

  doc.save(`Invoice-${order.id.slice(0, 8).toUpperCase()}.pdf`);
};

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
