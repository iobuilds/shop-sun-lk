import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Cpu, MemoryStick, HardDrive, Database, Clock, Server, AlertTriangle } from "lucide-react";

interface Bucket {
  bucket_id: string;
  file_count: number;
  total_bytes: number;
  total_human: string;
}

interface MetricsData {
  success: boolean;
  timestamp: string;
  scope_note: string;
  cpu: {
    usage_percent: number | null;
    cores_detected: number | null;
    load_average: { load_1m: number; load_5m: number; load_15m: number } | null;
    cgroup_limit_cores: number | null;
  };
  memory: {
    host_view: {
      total_bytes: number;
      used_bytes: number;
      usage_percent: number;
      total_human: string;
      used_human: string;
      free_human: string;
      available_human: string;
    } | null;
    cgroup_view: {
      current_bytes: number | null;
      limit_bytes: number | null;
      usage_percent: number | null;
      current_human: string | null;
      limit_human: string | null;
    };
  };
  disk: {
    root: {
      path: string;
      usage_percent: number;
      total_human: string;
      used_human: string;
      free_human: string;
    } | null;
    tmp: {
      path: string;
      usage_percent: number;
      total_human: string;
      used_human: string;
      free_human: string;
    } | null;
  };
  storage_buckets: {
    error?: string;
    buckets: Bucket[];
    summary: {
      total_buckets: number;
      total_files: number;
      total_bytes: number;
      total_human: string;
    };
  };
  uptime: {
    uptime_seconds: number;
    uptime_hours: number;
  } | null;
}

function ProgressBar({ value, color = "primary" }: { value: number | null; color?: string }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const barColor =
    pct >= 90 ? "bg-destructive" :
    pct >= 70 ? "bg-yellow-500" :
    "bg-primary";
  return (
    <div className="w-full bg-muted rounded-full h-2 mt-1">
      <div className={`${barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricCard({
  title, icon: Icon, children, badge
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
          {badge && <span className="ml-auto">{badge}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function usageBadge(pct: number | null) {
  if (pct == null) return null;
  const variant = pct >= 90 ? "destructive" : pct >= 70 ? "outline" : "secondary";
  return <Badge variant={variant} className="text-xs">{pct.toFixed(1)}%</Badge>;
}

export default function SystemMetrics() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery<MetricsData>({
    queryKey: ["system-metrics", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("system-metrics");
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Unknown error");
      return data as MetricsData;
    },
    staleTime: 30000,
    retry: 1,
  });

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" /> System Metrics
          </h2>
          {data?.timestamp && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last updated: {new Date(data.timestamp).toLocaleString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading system metrics…
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 flex items-start gap-3 text-destructive">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to load metrics</p>
              <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Scope note */}
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
            ℹ️ {data.scope_note}
          </p>

          {/* Grid of metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* CPU */}
            <MetricCard title="CPU" icon={Cpu} badge={usageBadge(data.cpu.usage_percent)}>
              <ProgressBar value={data.cpu.usage_percent} />
              <StatRow label="Usage" value={data.cpu.usage_percent != null ? `${data.cpu.usage_percent}%` : null} />
              <StatRow label="Cores detected" value={data.cpu.cores_detected} />
              <StatRow label="cGroup limit" value={data.cpu.cgroup_limit_cores != null ? `${data.cpu.cgroup_limit_cores} cores` : null} />
              {data.cpu.load_average && (
                <>
                  <div className="border-t border-border pt-2 mt-1">
                    <p className="text-xs text-muted-foreground mb-1">Load Average</p>
                    <div className="flex gap-4">
                      <div className="text-center"><p className="font-medium">{data.cpu.load_average.load_1m}</p><p className="text-xs text-muted-foreground">1m</p></div>
                      <div className="text-center"><p className="font-medium">{data.cpu.load_average.load_5m}</p><p className="text-xs text-muted-foreground">5m</p></div>
                      <div className="text-center"><p className="font-medium">{data.cpu.load_average.load_15m}</p><p className="text-xs text-muted-foreground">15m</p></div>
                    </div>
                  </div>
                </>
              )}
            </MetricCard>

            {/* RAM — host */}
            <MetricCard
              title="Memory (Host)"
              icon={MemoryStick}
              badge={usageBadge(data.memory.host_view?.usage_percent ?? null)}
            >
              <ProgressBar value={data.memory.host_view?.usage_percent ?? null} />
              <StatRow label="Used" value={data.memory.host_view?.used_human} />
              <StatRow label="Total" value={data.memory.host_view?.total_human} />
              <StatRow label="Free" value={data.memory.host_view?.free_human} />
              <StatRow label="Available" value={data.memory.host_view?.available_human} />
            </MetricCard>

            {/* RAM — container */}
            <MetricCard
              title="Memory (Container)"
              icon={MemoryStick}
              badge={usageBadge(data.memory.cgroup_view?.usage_percent ?? null)}
            >
              <ProgressBar value={data.memory.cgroup_view?.usage_percent ?? null} />
              <StatRow label="Used" value={data.memory.cgroup_view?.current_human} />
              <StatRow label="Limit" value={data.memory.cgroup_view?.limit_human} />
              <StatRow label="Usage %" value={data.memory.cgroup_view?.usage_percent != null ? `${data.memory.cgroup_view.usage_percent}%` : null} />
            </MetricCard>

            {/* Disk */}
            <MetricCard
              title="Disk (Root)"
              icon={HardDrive}
              badge={usageBadge(data.disk.root?.usage_percent ?? null)}
            >
              <ProgressBar value={data.disk.root?.usage_percent ?? null} />
              <StatRow label="Used" value={data.disk.root?.used_human} />
              <StatRow label="Free" value={data.disk.root?.free_human} />
              <StatRow label="Total" value={data.disk.root?.total_human} />
              <StatRow label="Usage %" value={data.disk.root?.usage_percent != null ? `${data.disk.root.usage_percent}%` : null} />
            </MetricCard>

            {/* Uptime */}
            <MetricCard title="Uptime" icon={Clock}>
              <div className="py-2 text-center">
                <p className="text-3xl font-bold text-primary">{data.uptime?.uptime_hours.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">hours</p>
              </div>
              <StatRow label="Uptime (s)" value={data.uptime?.uptime_seconds?.toLocaleString()} />
            </MetricCard>

            {/* Storage buckets summary */}
            <MetricCard title="Storage Buckets" icon={Database}>
              {data.storage_buckets.error ? (
                <p className="text-xs text-destructive">{data.storage_buckets.error}</p>
              ) : (
                <>
                  <StatRow label="Total buckets" value={data.storage_buckets.summary.total_buckets} />
                  <StatRow label="Total files" value={data.storage_buckets.summary.total_files?.toLocaleString()} />
                  <StatRow label="Total size" value={data.storage_buckets.summary.total_human} />
                  {data.storage_buckets.buckets.length > 0 && (
                    <div className="border-t border-border pt-2 mt-1 space-y-1.5">
                      <p className="text-xs text-muted-foreground">Per Bucket</p>
                      {data.storage_buckets.buckets.map(b => (
                        <div key={b.bucket_id} className="flex justify-between items-center">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{b.bucket_id}</span>
                          <span className="text-xs text-muted-foreground">{b.file_count} files · {b.total_human}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </MetricCard>
          </div>
        </>
      )}
    </div>
  );
}
