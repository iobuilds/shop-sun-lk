import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Activity, User, Shield, Trash2, Mail, Key, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";

const ACTION_META: Record<string, { label: string; color: string; icon: any }> = {
  // Admin actions
  user_suspended:       { label: "User Suspended",       color: "bg-destructive/10 text-destructive border-destructive/20", icon: UserX },
  user_unsuspended:     { label: "User Unsuspended",      color: "bg-green-500/10 text-green-600 border-green-500/20",       icon: UserCheck },
  user_deleted:         { label: "User Deleted",          color: "bg-destructive/10 text-destructive border-destructive/20", icon: Trash2 },
  user_profile_updated: { label: "Profile Updated",       color: "bg-blue-500/10 text-blue-600 border-blue-500/20",         icon: User },
  user_email_updated:   { label: "Email Changed",         color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",   icon: Mail },
  user_role_changed:    { label: "Role Changed",          color: "bg-purple-500/10 text-purple-600 border-purple-500/20",   icon: Shield },
  order_status_changed: { label: "Order Status Changed",  color: "bg-blue-500/10 text-blue-600 border-blue-500/20",         icon: Activity },
  product_created:      { label: "Product Created",       color: "bg-green-500/10 text-green-600 border-green-500/20",      icon: Activity },
  product_updated:      { label: "Product Updated",       color: "bg-blue-500/10 text-blue-600 border-blue-500/20",         icon: Activity },
  product_deleted:      { label: "Product Deleted",       color: "bg-destructive/10 text-destructive border-destructive/20", icon: Trash2 },
  coupon_created:       { label: "Coupon Created",        color: "bg-green-500/10 text-green-600 border-green-500/20",      icon: Key },
  coupon_deleted:       { label: "Coupon Deleted",        color: "bg-destructive/10 text-destructive border-destructive/20", icon: Trash2 },
  banner_created:       { label: "Banner Created",        color: "bg-green-500/10 text-green-600 border-green-500/20",      icon: Activity },
  banner_deleted:       { label: "Banner Deleted",        color: "bg-destructive/10 text-destructive border-destructive/20", icon: Trash2 },
  db_backup:            { label: "DB Backup",             color: "bg-teal-500/10 text-teal-600 border-teal-500/20",         icon: Activity },
  db_cleanup:           { label: "DB Cleanup",            color: "bg-orange-500/10 text-orange-600 border-orange-500/20",   icon: Activity },
  // User / site actions
  user_registered:      { label: "New Registration",      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: UserCheck },
  user_login:           { label: "User Login",            color: "bg-sky-500/10 text-sky-600 border-sky-500/20",            icon: User },
  order_placed:         { label: "Order Placed",          color: "bg-green-500/10 text-green-600 border-green-500/20",      icon: ShoppingCart },
  pcb_order_submitted:  { label: "PCB Order Submitted",   color: "bg-purple-500/10 text-purple-600 border-purple-500/20",  icon: Cpu },
  preorder_submitted:   { label: "Pre-order Submitted",   color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",  icon: Package },
  contact_message_sent: { label: "Contact Message",       color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",  icon: MessageSquare },
};

const getActionMeta = (action: string) =>
  ACTION_META[action] || { label: action.replace(/_/g, " "), color: "bg-muted text-muted-foreground border-border", icon: Activity };

function DetailsCell({ details }: { details: any }) {
  if (!details || Object.keys(details).length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="text-xs space-y-0.5 font-mono">
      {Object.entries(details).map(([k, v]) => (
        <div key={k} className="flex gap-1 flex-wrap">
          <span className="text-muted-foreground">{k}:</span>
          <span className="text-foreground">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

const ActivityLogs = () => {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-activity-logs", page, actionFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("admin_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") q = q.eq("action", actionFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = logs?.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.admin_email?.toLowerCase().includes(s) ||
      log.action?.toLowerCase().includes(s) ||
      log.target_id?.toLowerCase().includes(s) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(s)
    );
  }) || [];

  const uniqueActions = Array.from(new Set(Object.keys(ACTION_META)));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Site Activity Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">All admin actions are tracked here in real-time</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by admin, action, target..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{ACTION_META[a]?.label || a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Admin</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Target</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Details</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No activity logs found
                  </td>
                </tr>
              ) : (
                filtered.map((log, i) => {
                  const meta = getActionMeta(log.action);
                  const Icon = meta.icon;
                  return (
                    <tr key={log.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs font-mono">
                        {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium truncate max-w-36">{log.admin_email || log.admin_id?.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="outline" className={`text-xs gap-1 ${meta.color}`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.target_id ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">{log.target_type}: </span>
                            <span className="font-mono">{log.target_id.slice(0, 8)}…</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <DetailsCell details={log.details} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {log.ip_address || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} entries shown</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(logs?.length || 0) < PAGE_SIZE}>Next →</Button>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
