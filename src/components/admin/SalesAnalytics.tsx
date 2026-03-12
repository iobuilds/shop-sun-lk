import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface SalesAnalyticsProps {
  orders: any[];
  products: any[];
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

const SalesAnalytics = ({ orders, products }: SalesAnalyticsProps) => {
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("daily");

  const analytics = useMemo(() => {
    if (!orders) return null;

    const paidOrders = orders.filter(o => o.payment_status === "paid");
    const now = new Date();

    // Helper to get date key
    const getKey = (date: Date, p: string) => {
      if (p === "daily") return date.toISOString().slice(0, 10);
      if (p === "monthly") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return String(date.getFullYear());
    };

    // Group sales by period
    const salesMap = new Map<string, { revenue: number; cost: number; orders: number; items: number; discounts: number }>();
    paidOrders.forEach(o => {
      const d = new Date(o.created_at!);
      const key = getKey(d, period);
      const existing = salesMap.get(key) || { revenue: 0, cost: 0, orders: 0, items: 0, discounts: 0 };
      existing.revenue += Number(o.total);
      existing.orders += 1;
      existing.discounts += Number(o.discount_amount) || 0;
      (o.order_items as any[])?.forEach((item: any) => {
        existing.items += item.quantity;
        const prod = products?.find(p => p.id === item.product_id);
        const costPrice = (prod as any)?.cost_price ? Number((prod as any).cost_price) : 0;
        existing.cost += costPrice * item.quantity;
      });
      salesMap.set(key, existing);
    });

    const salesData = Array.from(salesMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({
        period: key,
        ...data,
        profit: data.revenue - data.cost,
        margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue * 100) : 0,
        avgOrderValue: data.orders > 0 ? data.revenue / data.orders : 0,
      }));

    // Today's stats
    const todayKey = getKey(now, "daily");
    const todayData = salesMap.get(todayKey) || { revenue: 0, cost: 0, orders: 0, items: 0, discounts: 0 };

    // This month
    const monthKey = getKey(now, "monthly");
    const monthRevenue = Array.from(salesMap.entries())
      .filter(([k]) => period === "daily" ? k.startsWith(monthKey) : k === monthKey)
      .reduce((sum, [, d]) => sum + d.revenue, 0);

    // This year
    const yearKey = String(now.getFullYear());
    const yearRevenue = Array.from(salesMap.entries())
      .filter(([k]) => k.startsWith(yearKey))
      .reduce((sum, [, d]) => sum + d.revenue, 0);

    // All time
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalCost = salesData.reduce((sum, d) => sum + d.cost, 0);
    const totalProfit = totalRevenue - totalCost;

    return { salesData, todayRevenue: todayData.revenue, todayOrders: todayData.orders, monthRevenue, yearRevenue, totalRevenue, totalProfit, totalCost };
  }, [orders, products, period]);

  if (!analytics) return (
    <div className="text-center py-16 text-muted-foreground">
      <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>Loading sales data...</p>
    </div>
  );

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

  const handleDownloadSalesCSV = () => {
    if (!analytics) return;
    const rows = analytics.salesData.map(row => ({
      Period: formatLabel(row.period),
      Orders: row.orders,
      Items: row.items,
      Revenue_Rs: row.revenue,
      Cost_Rs: row.cost,
      Discounts_Rs: row.discounts,
      Profit_Rs: row.profit,
      Margin_Pct: row.margin.toFixed(1),
      Avg_Order_Rs: Math.round(row.avgOrderValue),
    }));
    downloadCSV(rows, `sales-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDownloadOrdersCSV = () => {
    if (!orders) return;
    const rows = orders.map((o: any) => ({
      Order_ID: o.id,
      Date: o.created_at ? new Date(o.created_at).toLocaleString() : "",
      Status: o.status,
      Payment_Status: o.payment_status,
      Payment_Method: o.payment_method,
      Subtotal_Rs: o.subtotal,
      Shipping_Rs: o.shipping_fee,
      Discount_Rs: o.discount_amount,
      Total_Rs: o.total,
      Coupon: o.coupon_code || "",
      Tracking: o.tracking_number || "",
    }));
    downloadCSV(rows, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold font-display text-foreground">Sales Analytics</h2>
        <div className="flex items-center gap-2">
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
          <Button size="sm" variant="outline" onClick={handleDownloadSalesCSV} disabled={!analytics?.salesData.length}>
            <Download className="w-4 h-4 mr-1" /> Sales CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadOrdersCSV} disabled={!orders?.length}>
            <Download className="w-4 h-4 mr-1" /> Orders CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Today</p>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">Rs. {analytics.todayRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{analytics.todayOrders} orders</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-secondary" />
            <p className="text-sm text-muted-foreground">This Month</p>
          </div>
          <p className="text-2xl font-bold font-display text-secondary">Rs. {analytics.monthRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-foreground" />
            <p className="text-sm text-muted-foreground">This Year</p>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">Rs. {analytics.yearRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            {analytics.totalProfit >= 0 ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
            <p className="text-sm text-muted-foreground">Total Profit</p>
          </div>
          <p className={`text-2xl font-bold font-display ${analytics.totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            Rs. {analytics.totalProfit.toLocaleString()}
          </p>
          {analytics.totalRevenue > 0 && <p className="text-xs text-muted-foreground">{((analytics.totalProfit / analytics.totalRevenue) * 100).toFixed(1)}% margin</p>}
        </div>
      </div>

      {/* Sales Table */}
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
              {analytics.salesData.slice(0, 50).map((row) => (
                <tr key={row.period} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{formatLabel(row.period)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.items}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">Rs. {row.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">Rs. {row.cost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.discounts > 0 ? `Rs. ${row.discounts.toLocaleString()}` : "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    Rs. {row.profit.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${row.margin >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {row.margin.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">Rs. {Math.round(row.avgOrderValue).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {analytics.salesData.length > 0 && (
              <tfoot>
                <tr className="bg-muted/50 font-bold">
                  <td className="px-4 py-3 text-foreground">Total</td>
                  <td className="px-4 py-3 text-right text-foreground">{analytics.salesData.reduce((s, r) => s + r.orders, 0)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{analytics.salesData.reduce((s, r) => s + r.items, 0)}</td>
                  <td className="px-4 py-3 text-right text-foreground">Rs. {analytics.totalRevenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-foreground">Rs. {analytics.totalCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-foreground">Rs. {analytics.salesData.reduce((s, r) => s + r.discounts, 0).toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right ${analytics.totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    Rs. {analytics.totalProfit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {analytics.totalRevenue > 0 ? ((analytics.totalProfit / analytics.totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {analytics.salesData.reduce((s, r) => s + r.orders, 0) > 0
                      ? `Rs. ${Math.round(analytics.totalRevenue / analytics.salesData.reduce((s, r) => s + r.orders, 0)).toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {analytics.salesData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No paid orders yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SalesAnalytics;