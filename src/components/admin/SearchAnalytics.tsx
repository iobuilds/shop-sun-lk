import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Search, Download, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SearchLog {
  query: string;
  count: number;
  last_searched: string;
  avg_results: number;
}

const SearchAnalytics = () => {
  const [range, setRange] = useState("7");

  const { data: topSearches, isLoading, refetch } = useQuery({
    queryKey: ["search-analytics", range],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(range));

      const { data, error } = await supabase
        .from("search_logs" as any)
        .select("query, result_count, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Aggregate on client side
      const map = new Map<string, { count: number; last_searched: string; total_results: number }>();
      for (const row of (data as any[]) || []) {
        const q = row.query.trim().toLowerCase();
        if (!q) continue;
        const existing = map.get(q);
        if (existing) {
          existing.count++;
          existing.total_results += row.result_count || 0;
          if (row.created_at > existing.last_searched) existing.last_searched = row.created_at;
        } else {
          map.set(q, { count: 1, last_searched: row.created_at, total_results: row.result_count || 0 });
        }
      }

      return Array.from(map.entries())
        .map(([query, v]) => ({
          query,
          count: v.count,
          last_searched: v.last_searched,
          avg_results: v.count > 0 ? Math.round(v.total_results / v.count) : 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const { data: recentSearches } = useQuery({
    queryKey: ["search-recent", range],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(range));
      const { data, error } = await supabase
        .from("search_logs" as any)
        .select("query, result_count, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const totalSearches = topSearches?.reduce((s, r) => s + r.count, 0) || 0;
  const zeroResultSearches = topSearches?.filter((r) => r.avg_results === 0).length || 0;

  const exportCSV = () => {
    if (!topSearches) return;
    const rows = [["Query", "Count", "Avg Results", "Last Searched"]];
    topSearches.forEach((r) => rows.push([r.query, String(r.count), String(r.avg_results), new Date(r.last_searched).toLocaleString()]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-analytics-${range}d.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-secondary" /> Search Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Track what users are searching for</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!topSearches?.length} className="h-8 text-xs gap-1">
            <Download className="w-3 h-3" /> Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Searches", value: totalSearches.toLocaleString(), icon: Search, color: "text-secondary" },
          { label: "Unique Queries", value: (topSearches?.length || 0).toLocaleString(), icon: TrendingUp, color: "text-primary" },
          { label: "Zero-Result Queries", value: zeroResultSearches.toLocaleString(), icon: Search, color: "text-destructive" },
          { label: "Top Query", value: topSearches?.[0]?.query || "—", icon: TrendingUp, color: "text-accent" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground truncate">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Searches Table */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Top Searches</h3>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : !topSearches?.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No search data yet.</div>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Query</TableHead>
                    <TableHead className="text-xs text-right">Searches</TableHead>
                    <TableHead className="text-xs text-right">Avg Results</TableHead>
                    <TableHead className="text-xs text-right">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSearches.slice(0, 50).map((row, i) => (
                    <TableRow key={row.query}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{row.query}</span>
                          {row.avg_results === 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">No results</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-secondary">{row.count}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{row.avg_results}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(row.last_searched).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Recent Searches */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recent Searches</h3>
          </div>
          <div className="overflow-auto max-h-[420px]">
            {!recentSearches?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No data yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentSearches.map((row: any, i: number) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{row.query}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{row.result_count ?? 0} res</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchAnalytics;
