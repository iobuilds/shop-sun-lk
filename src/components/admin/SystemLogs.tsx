import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Terminal, Download, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  event_message: string;
  method?: string;
  status?: string;
  path?: string;
  ip?: string | null;
  source?: string;
  details?: any;
}

const STATUS_COLOR: Record<string, string> = {
  "200": "bg-green-500/10 text-green-600 border-green-500/20",
  "101": "bg-sky-500/10 text-sky-600 border-sky-500/20",
  "304": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "400": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "401": "bg-destructive/10 text-destructive border-destructive/20",
  "403": "bg-destructive/10 text-destructive border-destructive/20",
  "404": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "500": "bg-destructive/10 text-destructive border-destructive/20",
  LOG:   "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

const METHOD_COLOR: Record<string, string> = {
  GET:     "text-green-500",
  POST:    "text-blue-500",
  PUT:     "text-yellow-500",
  PATCH:   "text-orange-400",
  DELETE:  "text-destructive",
  OPTIONS: "text-muted-foreground",
  LOG:     "text-sky-500",
};

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLOR[log.status || "LOG"] || "bg-muted text-muted-foreground border-border";
  const methodColor = METHOD_COLOR[log.method || "LOG"] || "text-muted-foreground";
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <>
      <tr
        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => hasDetails && setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 whitespace-nowrap">
          {hasDetails ? (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <span className="w-3.5 h-3.5 block" />
          )}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-muted-foreground">
          {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <Badge variant="outline" className={`text-xs font-mono font-bold ${statusColor}`}>
            {log.status || "LOG"}
          </Badge>
        </td>
        <td className={`px-3 py-2 whitespace-nowrap text-xs font-mono font-semibold ${methodColor}`}>
          {log.method || "—"}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground max-w-xs truncate">
          {log.path || "—"}
        </td>
        <td className="px-3 py-2 text-xs text-foreground max-w-sm">
          <span className="line-clamp-1">{log.event_message}</span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-muted-foreground">
          {log.ip || "—"}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={7} className="px-6 py-3">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

const SystemLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hours, setHours] = useState("1");
  const [logType, setLogType] = useState("api");
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-logs", {
        body: { log_type: logType, search, hours: Number(hours), limit: 200 },
      });
      if (error) throw error;
      setLogs(data?.logs || []);
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType, hours]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchLogs, 10000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, logType, hours, search]);

  const filteredLogs = logs.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        l.event_message?.toLowerCase().includes(s) ||
        l.path?.toLowerCase().includes(s) ||
        l.ip?.toLowerCase().includes(s) ||
        l.method?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const downloadLogs = () => {
    const content = filteredLogs.map((l) =>
      `[${l.timestamp}] ${l.method || ""} ${l.status || ""} ${l.path || ""} ${l.ip || ""} | ${l.event_message}`
    ).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs-${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            System Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Live backend activity & event stream</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Live" : "Auto Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadLogs} disabled={filteredLogs.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={logType} onValueChange={(v) => setLogType(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="api">API Logs</SelectItem>
            <SelectItem value="edge">Edge Logs</SelectItem>
          </SelectContent>
        </Select>

        <Select value={hours} onValueChange={(v) => setHours(v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 1 hour</SelectItem>
            <SelectItem value="3">Last 3 hours</SelectItem>
            <SelectItem value="6">Last 6 hours</SelectItem>
            <SelectItem value="24">Last 24 hours</SelectItem>
            <SelectItem value="168">Last 7 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="200">200 OK</SelectItem>
            <SelectItem value="304">304 Redirect</SelectItem>
            <SelectItem value="400">400 Bad Request</SelectItem>
            <SelectItem value="401">401 Unauthorized</SelectItem>
            <SelectItem value="500">500 Error</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events, paths, IPs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="font-mono">{filteredLogs.length} events</span>
        {["200", "500", "400", "401"].map((s) => {
          const count = filteredLogs.filter((l) => l.status === s).length;
          if (!count) return null;
          return (
            <span key={s} className={`font-mono px-1.5 py-0.5 rounded border ${STATUS_COLOR[s] || ""}`}>
              {s}: {count}
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-3 py-2 w-6"></th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap text-xs">Time</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap text-xs">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap text-xs">Method</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap text-xs">Path</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-xs">Event</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap text-xs">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Fetching logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No log entries found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
