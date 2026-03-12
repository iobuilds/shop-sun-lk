import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Terminal, Download, Copy, ChevronRight, ChevronDown } from "lucide-react";
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
  req_id?: string | null;
  source?: string;
  details?: any;
  execution_ms?: number;
  function_id?: string;
}

const METHOD_COLOR: Record<string, string> = {
  GET:     "text-green-500",
  POST:    "text-blue-500",
  PUT:     "text-yellow-500",
  PATCH:   "text-orange-400",
  DELETE:  "text-destructive",
  OPTIONS: "text-muted-foreground",
  SQL:     "text-violet-500",
  LOG:     "text-sky-500",
};

const STATUS_COLOR: Record<string, string> = {
  "200": "bg-green-500/10 text-green-600 border-green-500/20",
  "201": "bg-green-500/10 text-green-600 border-green-500/20",
  "101": "bg-sky-500/10 text-sky-600 border-sky-500/20",
  "304": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "400": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "401": "bg-destructive/10 text-destructive border-destructive/20",
  "403": "bg-destructive/10 text-destructive border-destructive/20",
  "404": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "500": "bg-destructive/10 text-destructive border-destructive/20",
  "502": "bg-destructive/10 text-destructive border-destructive/20",
  LOG:   "bg-sky-500/10 text-sky-500 border-sky-500/20",
};

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusKey = log.status || "LOG";
  const statusColor = STATUS_COLOR[statusKey] || "bg-muted text-muted-foreground border-border";
  const methodColor = METHOD_COLOR[log.method || "LOG"] || "text-muted-foreground";
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  const copyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
  };

  return (
    <>
      <tr
        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 w-5">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-50 group-hover:opacity-100" />
          }
        </td>
        {/* Timestamp */}
        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-muted-foreground">
          {format(new Date(log.timestamp), "d MMM HH:mm:ss")}
        </td>
        {/* Level/Source badge */}
        <td className="px-3 py-2 whitespace-nowrap">
          <Badge variant="outline" className="text-xs font-mono font-bold bg-sky-500/10 text-sky-500 border-sky-500/20">
            LOG
          </Badge>
        </td>
        {/* Method */}
        <td className={`px-3 py-2 whitespace-nowrap text-xs font-mono font-bold ${methodColor}`}>
          {log.method || "—"}
        </td>
        {/* Status */}
        <td className="px-3 py-2 whitespace-nowrap">
          <Badge variant="outline" className={`text-xs font-mono font-bold ${statusColor}`}>
            {log.status || "—"}
          </Badge>
        </td>
        {/* IP */}
        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-muted-foreground">
          {log.ip || "—"}
        </td>
        {/* Req ID */}
        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-muted-foreground max-w-[120px] truncate">
          {log.req_id ? log.req_id.slice(0, 16) : (log.id ? log.id.slice(0, 16) : "—")}
        </td>
        {/* Message / URL */}
        <td className="px-3 py-2 text-xs font-mono text-foreground min-w-0">
          <span className="line-clamp-1 text-muted-foreground">{log.path || log.event_message}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={8} className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Raw log data</span>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={copyJson}>
                <Copy className="w-3 h-3" />
                Copy JSON
              </Button>
            </div>
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all bg-background rounded-md p-4 border border-border">
              {JSON.stringify({
                event_message: log.event_message,
                id: log.id,
                log_level: log.status ? parseInt(log.status) : 200,
                method: log.method,
                path: log.path,
                status: log.status,
                ip: log.ip,
                timestamp: new Date(log.timestamp).getTime() * 1000,
                ...(log.details || {}),
                ...(log.execution_ms !== undefined ? { execution_time_ms: log.execution_ms } : {}),
                ...(log.function_id ? { function_id: log.function_id } : {}),
              }, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

const LOG_TYPES = [
  { value: "api", label: "API logs" },
  { value: "edge", label: "Edge logs" },
  { value: "postgres", label: "Postgres logs" },
  { value: "auth", label: "Auth logs" },
];

const SystemLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasManagementToken, setHasManagementToken] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hours, setHours] = useState("1");
  const [logType, setLogType] = useState("api");
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
      if (data?.has_management_token !== undefined) {
        setHasManagementToken(data.has_management_token);
      }
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logType, hours]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchLogs, 10000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, logType, hours, search]);

  const filteredLogs = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.event_message?.toLowerCase().includes(s) ||
      l.path?.toLowerCase().includes(s) ||
      l.ip?.toLowerCase().includes(s) ||
      l.method?.toLowerCase().includes(s) ||
      l.req_id?.toLowerCase().includes(s)
    );
  });

  const downloadLogs = () => {
    const content = filteredLogs.map((l) =>
      `[${l.timestamp}] ${l.method || ""} ${l.status || ""} ${l.ip || ""} ${l.id?.slice(0, 16) || ""} | ${l.path || l.event_message}`
    ).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs-${Date.now()}.txt`;
    a.click();
  };

  const copyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(filteredLogs, null, 2));
  };

  const currentLogType = LOG_TYPES.find(t => t.value === logType);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Debug errors and track activity in your app.</p>
        </div>
      </div>

      {/* Filters row - matches Supabase style */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
          />
        </div>

        <Select value={logType} onValueChange={(v) => setLogType(v)}>
          <SelectTrigger className="w-40">
            <SelectValue>{currentLogType?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LOG_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={hours} onValueChange={(v) => setHours(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last hour</SelectItem>
            <SelectItem value="3">Last 3 hours</SelectItem>
            <SelectItem value="6">Last 6 hours</SelectItem>
            <SelectItem value="24">Last 24 hours</SelectItem>
            <SelectItem value="168">Last 7 days</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="icon"
          onClick={() => setAutoRefresh((v) => !v)}
          title={autoRefresh ? "Stop auto-refresh" : "Enable auto-refresh"}
        >
          <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={downloadLogs} disabled={filteredLogs.length === 0} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
        <Button variant="outline" size="sm" onClick={copyAll} disabled={filteredLogs.length === 0} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" />
          Copy
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-3 py-2 w-5"></th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-xs">Time</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-xs">Level</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-xs">Method</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-xs">Status</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-xs">IP</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-xs">ID</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Event</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Fetching logs...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Terminal className="w-8 h-8 mx-auto mb-3 opacity-25" />
                    <p className="text-sm font-medium">No log entries found</p>
                    <p className="text-xs mt-1 opacity-70">Try extending the time range or changing the log type</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {filteredLogs.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">
              {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""} found
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;
