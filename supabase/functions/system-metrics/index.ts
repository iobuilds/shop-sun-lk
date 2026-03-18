import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function formatBytes(bytes: number | null) {
  if (bytes == null || Number.isNaN(bytes)) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}

function safeNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function readTextSafe(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return null;
  }
}

async function getPgClient() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL is not set");
  const client = new Client(dbUrl);
  await client.connect();
  return client;
}

async function getCpuSnapshot() {
  const stat = await readTextSafe("/proc/stat");
  if (!stat) return null;

  const firstLine = stat.split("\n")[0];
  const parts = firstLine.trim().split(/\s+/);
  if (parts.length < 8 || parts[0] !== "cpu") return null;

  const nums = parts.slice(1).map((v) => Number(v));
  const idle = (nums[3] || 0) + (nums[4] || 0);
  const total = nums.reduce((a, b) => a + b, 0);

  return { idle, total };
}

async function getCpuUsagePercent() {
  const a = await getCpuSnapshot();
  if (!a) return null;

  await new Promise((r) => setTimeout(r, 250));

  const b = await getCpuSnapshot();
  if (!b) return null;

  const totalDiff = b.total - a.total;
  const idleDiff = b.idle - a.idle;

  if (totalDiff <= 0) return null;

  return Number((((1 - idleDiff / totalDiff) * 100)).toFixed(2));
}

async function getMemInfo() {
  const meminfo = await readTextSafe("/proc/meminfo");
  if (!meminfo) return null;

  const map: Record<string, number> = {};
  for (const line of meminfo.split("\n")) {
    const m = line.match(/^([^:]+):\s+(\d+)\s+kB$/);
    if (m) map[m[1]] = Number(m[2]) * 1024;
  }

  const total = map["MemTotal"] ?? null;
  const available = map["MemAvailable"] ?? null;
  const free = map["MemFree"] ?? null;
  const used = total != null && available != null ? total - available : null;
  const usagePercent =
    total != null && used != null ? Number(((used / total) * 100).toFixed(2)) : null;

  return {
    total_bytes: total,
    used_bytes: used,
    free_bytes: free,
    available_bytes: available,
    usage_percent: usagePercent,
    total_human: formatBytes(total),
    used_human: formatBytes(used),
    free_human: formatBytes(free),
    available_human: formatBytes(available),
  };
}

async function getDiskUsage(path = "/") {
  try {
    const s = await Deno.statfs(path);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    const used = total - free;
    const usagePercent = total > 0 ? Number(((used / total) * 100).toFixed(2)) : null;

    return {
      path,
      total_bytes: total,
      used_bytes: used,
      free_bytes: free,
      usage_percent: usagePercent,
      total_human: formatBytes(total),
      used_human: formatBytes(used),
      free_human: formatBytes(free),
    };
  } catch {
    return null;
  }
}

async function getLoadAverage() {
  const loadavg = await readTextSafe("/proc/loadavg");
  if (!loadavg) return null;

  const parts = loadavg.trim().split(/\s+/);
  return {
    load_1m: Number(parts[0] ?? 0),
    load_5m: Number(parts[1] ?? 0),
    load_15m: Number(parts[2] ?? 0),
  };
}

async function getUptime() {
  const uptime = await readTextSafe("/proc/uptime");
  if (!uptime) return null;

  const seconds = Number(uptime.trim().split(/\s+/)[0] ?? 0);
  return {
    uptime_seconds: Math.floor(seconds),
    uptime_hours: Number((seconds / 3600).toFixed(2)),
  };
}

async function getCpuCoreCount() {
  const cpuinfo = await readTextSafe("/proc/cpuinfo");
  if (!cpuinfo) return null;

  const count = cpuinfo
    .split("\n")
    .filter((line) => line.startsWith("processor"))
    .length;

  return count || null;
}

async function getContainerCgroupInfo() {
  const memCurrent =
    (await readTextSafe("/sys/fs/cgroup/memory.current")) ||
    (await readTextSafe("/sys/fs/cgroup/memory/memory.usage_in_bytes"));

  const memMax =
    (await readTextSafe("/sys/fs/cgroup/memory.max")) ||
    (await readTextSafe("/sys/fs/cgroup/memory/memory.limit_in_bytes"));

  const cpuMax = await readTextSafe("/sys/fs/cgroup/cpu.max");
  const cpuQuota = await readTextSafe("/sys/fs/cgroup/cpu/cpu.cfs_quota_us");
  const cpuPeriod = await readTextSafe("/sys/fs/cgroup/cpu/cpu.cfs_period_us");

  let memory_current_bytes: number | null = null;
  let memory_limit_bytes: number | null = null;
  let memory_usage_percent: number | null = null;

  if (memCurrent) {
    const v = memCurrent.trim();
    if (/^\d+$/.test(v)) memory_current_bytes = Number(v);
  }

  if (memMax) {
    const v = memMax.trim();
    if (v !== "max" && /^\d+$/.test(v)) memory_limit_bytes = Number(v);
  }

  if (
    memory_current_bytes != null &&
    memory_limit_bytes != null &&
    memory_limit_bytes > 0
  ) {
    memory_usage_percent = Number(
      ((memory_current_bytes / memory_limit_bytes) * 100).toFixed(2),
    );
  }

  let cpu_limit_cores: number | null = null;

  if (cpuMax) {
    const [quota, period] = cpuMax.trim().split(" ");
    if (quota && period && quota !== "max") {
      const q = Number(quota);
      const p = Number(period);
      if (q > 0 && p > 0) cpu_limit_cores = Number((q / p).toFixed(2));
    }
  } else if (cpuQuota && cpuPeriod) {
    const q = Number(cpuQuota.trim());
    const p = Number(cpuPeriod.trim());
    if (q > 0 && p > 0) cpu_limit_cores = Number((q / p).toFixed(2));
  }

  return {
    memory_current_bytes,
    memory_limit_bytes,
    memory_usage_percent,
    memory_current_human: formatBytes(memory_current_bytes),
    memory_limit_human: formatBytes(memory_limit_bytes),
    cpu_limit_cores,
  };
}

async function getBucketUsageFromDb() {
  let client: Client | null = null;
  try {
    client = await getPgClient();

    const result = await client.queryObject<{
      bucket_id: string;
      file_count: bigint | number | string;
      total_bytes: bigint | number | string;
    }>(`
      select
        o.bucket_id,
        count(*) as file_count,
        coalesce(sum(
          case
            when o.metadata ? 'size' then (o.metadata->>'size')::bigint
            else 0
          end
        ), 0) as total_bytes
      from storage.objects o
      group by o.bucket_id
      order by o.bucket_id;
    `);

    const buckets = result.rows.map((row) => {
      const fileCount = safeNumber(row.file_count) ?? 0;
      const totalBytes = safeNumber(row.total_bytes) ?? 0;
      return {
        bucket_id: row.bucket_id,
        file_count: fileCount,
        total_bytes: totalBytes,
        total_human: formatBytes(totalBytes),
      };
    });

    const totalFiles = buckets.reduce((s, b) => s + b.file_count, 0);
    const totalBytes = buckets.reduce((s, b) => s + b.total_bytes, 0);

    return {
      buckets,
      summary: {
        total_buckets: buckets.length,
        total_files: totalFiles,
        total_bytes: totalBytes,
        total_human: formatBytes(totalBytes),
      },
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      buckets: [],
      summary: {
        total_buckets: 0,
        total_files: 0,
        total_bytes: 0,
        total_human: formatBytes(0),
      },
    };
  } finally {
    try {
      await client?.end();
    } catch {
      // ignore
    }
  }
}

async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, status: 401, error: "Unauthorized" };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const adminClient = createClient(supabaseUrl, serviceKey);

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const userId = claimsData.claims.sub as string;

  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return { ok: false, status: 403, error: "Admin access required" };
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    const [
      cpuUsagePercent,
      memInfo,
      diskRoot,
      diskTmp,
      loadAverage,
      uptime,
      cpuCores,
      cgroup,
      bucketUsage,
    ] = await Promise.all([
      getCpuUsagePercent(),
      getMemInfo(),
      getDiskUsage("/"),
      getDiskUsage("/tmp"),
      getLoadAverage(),
      getUptime(),
      getCpuCoreCount(),
      getContainerCgroupInfo(),
      getBucketUsageFromDb(),
    ]);

    return jsonResponse({
      success: true,
      timestamp: new Date().toISOString(),
      scope_note:
        "CPU/RAM/disk values mostly reflect the container/runtime view. Bucket usage comes from storage.objects metadata in Postgres.",
      cpu: {
        usage_percent: cpuUsagePercent,
        cores_detected: cpuCores,
        load_average: loadAverage,
        cgroup_limit_cores: cgroup?.cpu_limit_cores ?? null,
      },
      memory: {
        host_view: memInfo,
        cgroup_view: {
          current_bytes: cgroup?.memory_current_bytes ?? null,
          limit_bytes: cgroup?.memory_limit_bytes ?? null,
          usage_percent: cgroup?.memory_usage_percent ?? null,
          current_human: cgroup?.memory_current_human ?? null,
          limit_human: cgroup?.memory_limit_human ?? null,
        },
      },
      disk: {
        root: diskRoot,
        tmp: diskTmp,
      },
      storage_buckets: bucketUsage,
      uptime,
    });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
