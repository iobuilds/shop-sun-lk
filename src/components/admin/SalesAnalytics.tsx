import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Download, Layers, ShoppingCart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SalesAnalyticsProps {
  orders: any[];
  products: any[];
  preorderRequests?: any[];
  pcbOrders?: any[];
}

const downloadCSV = (data: any[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const getKey = (date: Date, p: string) => {
  if (p === "daily") return date.toISOString().slice(0, 10);
  if (p === "monthly") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return String(date.getFullYear());
};

const SalesAnalytics = ({ orders, products, preorderRequests = [], pcbOrders = [] }: SalesAnalyticsProps) => {
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("daily");

  const formatLabel = (key: string) => {
    if (period === "daily") {
      const d = new Date(key);
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    if (period === "monthly") {
      const [y, m] = key.split("-");
      const d = new Date(Number(y), Number(m) - 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return key;
  };

  // ── Product Orders Analytics ──
  const orderAnalytics = useMemo(() => {
    const paidOrders = orders.filter(o => o.payment_status === "paid");
    const now = new Date();
    const salesMap = new Map<string, { revenue: number; cost: number; orders: number; items: number; discounts: number }>();
    paidOrders.forEach(o => {
      const key = getKey(new Date(o.created_at!), period);
      const e = salesMap.get(key) || { revenue: 0, cost: 0, orders: 0, items: 0, discounts: 0 };
      e.revenue += Number(o.total);
      e.orders += 1;
      e.discounts += Number(o.discount_amount) || 0;
      (o.order_items as any[])?.forEach((item: any) => {
        e.items += item.quantity;
        const prod = products?.find(p => p.id === item.product_id);
        e.cost += ((prod as any)?.cost_price ? Number((prod as any).cost_price) : 0) * item.quantity;
      });
      salesMap.set(key, e);
    });
    const salesData = Array.from(salesMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([key, d]) => ({
      period: key, ...d,
      profit: d.revenue - d.cost,
      margin: d.revenue > 0 ? (d.revenue - d.cost) / d.revenue * 100 : 0,
      avgOrderValue: d.orders > 0 ? d.revenue / d.orders : 0,
    }));
    const todayKey = getKey(now, "daily");
    const todayData = salesMap.get(todayKey) || { revenue: 0, cost: 0, orders: 0, items: 0, discounts: 0 };
    const monthKey = getKey(now, "monthly");
    const monthRevenue = Array.from(salesMap.entries()).filter(([k]) => period === "daily" ? k.startsWith(monthKey) : k === monthKey).reduce((s, [, d]) => s + d.revenue, 0);
    const yearKey = String(now.getFullYear());
    const yearRevenue = Array.from(salesMap.entries()).filter(([k]) => k.startsWith(yearKey)).reduce((s, [, d]) => s + d.revenue, 0);
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalCost = salesData.reduce((s, d) => s + d.cost, 0);
    return { salesData, todayRevenue: todayData.revenue, todayOrders: todayData.orders, monthRevenue, yearRevenue, totalRevenue, totalProfit: totalRevenue - totalCost, totalCost };
  }, [orders, products, period]);

  // ── Pre-Order Analytics ──
  const preorderAnalytics = useMemo(() => {
    const paid = preorderRequests.filter(o => o.payment_status === "paid" || o.payment_status === "under_review" || o.arrival_payment_status === "paid");
    const now = new Date();
    const map = new Map<string, { revenue: number; orders: number }>();
    paid.forEach(o => {
      const key = getKey(new Date(o.created_at), period);
      const e = map.get(key) || { revenue: 0, orders: 0 };
      e.revenue += Number(o.grand_total) || 0;
      e.orders += 1;
      map.set(key, e);
    });
    const data = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([key, d]) => ({ period: key, ...d }));
    const monthKey = getKey(now, "monthly");
    const monthRevenue = Array.from(map.entries()).filter(([k]) => period === "daily" ? k.startsWith(monthKey) : k === monthKey).reduce((s, [, d]) => s + d.revenue, 0);
    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    return { data, totalRevenue, monthRevenue, total: paid.length };
  }, [preorderRequests, period]);

  // ── PCB Order Analytics ──
  const pcbAnalytics = useMemo(() => {
    const paid = pcbOrders.filter(o => o.payment_status === "paid" || o.payment_status === "under_review" || o.arrival_payment_status === "paid");
    const now = new Date();
    const map = new Map<string, { revenue: number; orders: number }>();
    paid.forEach(o => {
      const key = getKey(new Date(o.created_at), period);
      const e = map.get(key) || { revenue: 0, orders: 0 };
      e.revenue += Number(o.grand_total) || 0;
      e.orders += 1;
      map.set(key, e);
    });
    const data = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([key, d]) => ({ period: key, ...d }));
    const monthKey = getKey(now, "monthly");
    const monthRevenue = Array.from(map.entries()).filter(([k]) => period === "daily" ? k.startsWith(monthKey) : k === monthKey).reduce((s, [, d]) => s + d.revenue, 0);
    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    return { data, totalRevenue, monthRevenue, total: paid.length };
  }, [pcbOrders, period]);

  // ── Combined totals ──
  const combinedTotal = orderAnalytics.totalRevenue + preorderAnalytics.totalRevenue + pcbAnalytics.totalRevenue;
  const combinedMonth = orderAnalytics.monthRevenue + preorderAnalytics.monthRevenue + pcbAnalytics.monthRevenue;

  // ── CSV Handlers ──
  const handleDownloadOrdersCSV = () => {
    downloadCSV(orderAnalytics.salesData.map(r => ({
      Period: formatLabel(r.period), Orders: r.orders, Items: r.items,
      Revenue_Rs: r.revenue, Cost_Rs: r.cost, Discounts_Rs: r.discounts,
      Profit_Rs: r.profit, Margin_Pct: r.margin.toFixed(1), Avg_Order_Rs: Math.round(r.avgOrderValue),
    })), `product-orders-${period}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDownloadPreordersCSV = () => {
    downloadCSV(preorderRequests.map(o => ({
      ID: o.id, Date: new Date(o.created_at).toLocaleString(), Status: o.status,
      Payment_Status: o.payment_status, Arrival_Payment: o.arrival_payment_status,
      Grand_Total_Rs: o.grand_total || "",
    })), `pre-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDownloadPCBCSV = () => {
    downloadCSV(pcbOrders.map(o => ({
      ID: o.id, Date: new Date(o.created_at).toLocaleString(), Status: o.status,
      Payment_Status: o.payment_status, Arrival_Payment: o.arrival_payment_status,
      Quantity: o.quantity, Layers: o.layer_count, Color: o.pcb_color,
      Grand_Total_Rs: o.grand_total || "",
    })), `pcb-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold font-display text-foreground">Sales Analytics</h2>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Combined Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Today (Orders)</p>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">Rs. {orderAnalytics.todayRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{orderAnalytics.todayOrders} orders</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-secondary" />
            <p className="text-sm text-muted-foreground">This Month (All)</p>
          </div>
          <p className="text-2xl font-bold font-display text-secondary">Rs. {combinedMonth.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Orders + Pre + PCB</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-foreground" />
            <p className="text-sm text-muted-foreground">All-Time Revenue</p>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">Rs. {combinedTotal.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            <span title="Product orders">🛒 {orderAnalytics.totalRevenue.toLocaleString()}</span>
            {" · "}<span title="Pre-orders">📦 {preorderAnalytics.totalRevenue.toLocaleString()}</span>
            {" · "}<span title="PCB orders">🔌 {pcbAnalytics.totalRevenue.toLocaleString()}</span>
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            {orderAnalytics.totalProfit >= 0 ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
            <p className="text-sm text-muted-foreground">Product Profit</p>
          </div>
          <p className={`text-2xl font-bold font-display ${orderAnalytics.totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            Rs. {orderAnalytics.totalProfit.toLocaleString()}
          </p>
          {orderAnalytics.totalRevenue > 0 && <p className="text-xs text-muted-foreground">{((orderAnalytics.totalProfit / orderAnalytics.totalRevenue) * 100).toFixed(1)}% margin</p>}
        </div>
      </div>

      {/* Tabs per order type */}
      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders" className="flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> Product Orders
          </TabsTrigger>
          <TabsTrigger value="preorders" className="flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> Pre-Orders
          </TabsTrigger>
          <TabsTrigger value="pcb" className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> PCB Orders
          </TabsTrigger>
        </TabsList>

        {/* ─── Product Orders Tab ─── */}
        <TabsContent value="orders">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" onClick={handleDownloadOrdersCSV} disabled={!orderAnalytics.salesData.length}>
              <Download className="w-4 h-4 mr-1" /> Download CSV
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Items</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Discounts</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Profit</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Margin</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Order</th>
                  </tr>
                </thead>
                <tbody>
                  {orderAnalytics.salesData.slice(0, 50).map((row) => (
                    <tr key={row.period} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{formatLabel(row.period)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.items}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">Rs. {row.revenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">Rs. {row.cost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.discounts > 0 ? `Rs. ${row.discounts.toLocaleString()}` : "—"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${row.profit >= 0 ? "text-green-600" : "text-destructive"}`}>Rs. {row.profit.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right text-xs ${row.margin >= 0 ? "text-green-600" : "text-destructive"}`}>{row.margin.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">Rs. {Math.round(row.avgOrderValue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                {orderAnalytics.salesData.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 font-bold">
                      <td className="px-4 py-3 text-foreground">Total</td>
                      <td className="px-4 py-3 text-right text-foreground">{orderAnalytics.salesData.reduce((s, r) => s + r.orders, 0)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{orderAnalytics.salesData.reduce((s, r) => s + r.items, 0)}</td>
                      <td className="px-4 py-3 text-right text-foreground">Rs. {orderAnalytics.totalRevenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-foreground">Rs. {orderAnalytics.totalCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-foreground">Rs. {orderAnalytics.salesData.reduce((s, r) => s + r.discounts, 0).toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right ${orderAnalytics.totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>Rs. {orderAnalytics.totalProfit.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{orderAnalytics.totalRevenue > 0 ? ((orderAnalytics.totalProfit / orderAnalytics.totalRevenue) * 100).toFixed(1) : 0}%</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {orderAnalytics.salesData.reduce((s, r) => s + r.orders, 0) > 0
                          ? `Rs. ${Math.round(orderAnalytics.totalRevenue / orderAnalytics.salesData.reduce((s, r) => s + r.orders, 0)).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {orderAnalytics.salesData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No paid product orders yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── Pre-Orders Tab ─── */}
        <TabsContent value="preorders">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{preorderAnalytics.total} paid pre-orders · Rs. {preorderAnalytics.totalRevenue.toLocaleString()} total</p>
            <Button size="sm" variant="outline" onClick={handleDownloadPreordersCSV} disabled={!preorderRequests.length}>
              <Download className="w-4 h-4 mr-1" /> Download CSV
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {preorderAnalytics.data.slice(0, 50).map((row) => (
                    <tr key={row.period} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{formatLabel(row.period)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">Rs. {row.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                {preorderAnalytics.data.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 font-bold">
                      <td className="px-4 py-3 text-foreground">Total</td>
                      <td className="px-4 py-3 text-right text-foreground">{preorderAnalytics.total}</td>
                      <td className="px-4 py-3 text-right text-foreground">Rs. {preorderAnalytics.totalRevenue.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {preorderAnalytics.data.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No paid pre-orders yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── PCB Orders Tab ─── */}
        <TabsContent value="pcb">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{pcbAnalytics.total} paid PCB orders · Rs. {pcbAnalytics.totalRevenue.toLocaleString()} total</p>
            <Button size="sm" variant="outline" onClick={handleDownloadPCBCSV} disabled={!pcbOrders.length}>
              <Download className="w-4 h-4 mr-1" /> Download CSV
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {pcbAnalytics.data.slice(0, 50).map((row) => (
                    <tr key={row.period} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{formatLabel(row.period)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">Rs. {row.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                {pcbAnalytics.data.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 font-bold">
                      <td className="px-4 py-3 text-foreground">Total</td>
                      <td className="px-4 py-3 text-right text-foreground">{pcbAnalytics.total}</td>
                      <td className="px-4 py-3 text-right text-foreground">Rs. {pcbAnalytics.totalRevenue.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {pcbAnalytics.data.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No paid PCB orders yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default SalesAnalytics;
