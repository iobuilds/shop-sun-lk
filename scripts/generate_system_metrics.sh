




#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/root/nanocircuitDB"
METRICS_DIR="/var/www/nanocircuit-metrics"
OUT_FILE="/var/www/nanocircuit-metrics/system-metrics.json"

mkdir -p "${METRICS_DIR}"

human_bytes() {
  local bytes="${1:-0}"
  awk -v b="$bytes" '
    function human(x) {
      s="B KB MB GB TB PB"
      n=split(s, arr, " ")
      i=1
      while (x>=1024 && i<n) { x/=1024; i++ }
      return sprintf(i==1 ? "%.0f %s" : "%.2f %s", x, arr[i])
    }
    BEGIN { print human(b) }
  '
}

read_meminfo_value() {
  local key="$1"
  awk -v k="$key" '$1 == k ":" { print $2 * 1024 }' /proc/meminfo
}

json_escape() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# CPU
LOAD_1M="$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)"
LOAD_5M="$(awk '{print $2}' /proc/loadavg 2>/dev/null || echo 0)"
LOAD_15M="$(awk '{print $3}' /proc/loadavg 2>/dev/null || echo 0)"
CORES="$(nproc 2>/dev/null || echo null)"

read_cpu_stat() {
  awk '/^cpu / {
    idle = $5 + $6
    total = 0
    for (i = 2; i <= NF; i++) total += $i
    print total, idle
    exit
  }' /proc/stat
}

CPU_USAGE="null"
CPU_SAMPLE_1="$(read_cpu_stat 2>/dev/null || true)"
if [ -n "${CPU_SAMPLE_1:-}" ]; then
  sleep 0.5
  CPU_SAMPLE_2="$(read_cpu_stat 2>/dev/null || true)"
  if [ -n "${CPU_SAMPLE_2:-}" ]; then
    TOTAL1="$(printf '%s\n' "$CPU_SAMPLE_1" | awk '{print $1}')"
    IDLE1="$(printf '%s\n' "$CPU_SAMPLE_1" | awk '{print $2}')"
    TOTAL2="$(printf '%s\n' "$CPU_SAMPLE_2" | awk '{print $1}')"
    IDLE2="$(printf '%s\n' "$CPU_SAMPLE_2" | awk '{print $2}')"

    CPU_USAGE="$(awk -v t1="$TOTAL1" -v i1="$IDLE1" -v t2="$TOTAL2" -v i2="$IDLE2" '
      BEGIN {
        dt = t2 - t1
        di = i2 - i1
        if (dt > 0) printf "%.2f", ((dt - di) / dt) * 100
        else print "null"
      }
    ')"
  fi
fi

# Memory
MEM_TOTAL="$(read_meminfo_value MemTotal)"
MEM_AVAILABLE="$(read_meminfo_value MemAvailable)"
MEM_FREE="$(read_meminfo_value MemFree)"
MEM_USED=$((MEM_TOTAL - MEM_AVAILABLE))

MEM_USAGE_PERCENT="$(awk -v u="$MEM_USED" -v t="$MEM_TOTAL" 'BEGIN { if (t>0) printf "%.2f", (u/t)*100; else print "0.00" }')"

# Disk root
read -r ROOT_TOTAL ROOT_USED ROOT_FREE ROOT_PCT <<<"$(df -B1 / | awk 'NR==2 {gsub(/%/,"",$5); print $2, $3, $4, $5}')"

# /tmp
read -r TMP_TOTAL TMP_USED TMP_FREE TMP_PCT <<<"$(df -B1 /tmp | awk 'NR==2 {gsub(/%/,"",$5); print $2, $3, $4, $5}')"

# Docker root dir
DOCKER_ROOT="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
if [ -d "$DOCKER_ROOT" ]; then
  read -r DOCKER_TOTAL DOCKER_USED DOCKER_FREE DOCKER_PCT <<<"$(df -B1 "$DOCKER_ROOT" | awk 'NR==2 {gsub(/%/,"",$5); print $2, $3, $4, $5}')"
else
  DOCKER_TOTAL=0
  DOCKER_USED=0
  DOCKER_FREE=0
  DOCKER_PCT=0
fi

# App storage
POSTGRES_DATA_DIR="${PROJECT_DIR}/volumes/db/data"
STORAGE_DIR="${PROJECT_DIR}/volumes/storage"

POSTGRES_DATA_BYTES="$(du -sb "$POSTGRES_DATA_DIR" 2>/dev/null | awk '{print $1}' || echo 0)"
STORAGE_FILES_BYTES="$(du -sb "$STORAGE_DIR" 2>/dev/null | awk '{print $1}' || echo 0)"

# Uptime
UPTIME_SECONDS="$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)"
UPTIME_HOURS="$(awk -v s="$UPTIME_SECONDS" 'BEGIN { printf "%.2f", s/3600 }')"

# Storage buckets from Postgres metadata
BUCKET_ROWS="$(
docker compose exec -T db psql -U postgres -d postgres -At <<'SQL' 2>/dev/null || true
SELECT
  bucket_id,
  COUNT(*)::bigint,
  COALESCE(SUM((metadata->>'size')::bigint),0)::bigint,
  pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint),0)::bigint)
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;
SQL
)"

if [ -n "${BUCKET_ROWS:-}" ]; then
  BUCKETS_JSON="$(
    printf '%s\n' "$BUCKET_ROWS" | awk -F'|' '
      BEGIN { printf "["; first=1 }
      {
        gsub(/\\/,"\\\\",$1); gsub(/"/,"\\\"",$1);
        gsub(/\\/,"\\\\",$4); gsub(/"/,"\\\"",$4);
        if (!first) printf ","
        printf "{\"bucket_id\":\"%s\",\"file_count\":%s,\"total_bytes\":%s,\"total_human\":\"%s\"}", $1, $2, $3, $4
        first=0
      }
      END { printf "]" }
    '
  )"
else
  BUCKETS_JSON="[]"
fi

TOTAL_BUCKETS="$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT COUNT(DISTINCT bucket_id) FROM storage.objects;" 2>/dev/null | tr -d ' ' || echo 0)"
TOTAL_FILES="$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM storage.objects;" 2>/dev/null | tr -d ' ' || echo 0)"
TOTAL_BYTES="$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT COALESCE(SUM((metadata->>'size')::bigint),0) FROM storage.objects;" 2>/dev/null | tr -d ' ' || echo 0)"
TOTAL_HUMAN="$(human_bytes "${TOTAL_BYTES:-0}")"

cat > "$OUT_FILE" <<EOF
{
  "success": true,
  "timestamp": "${TIMESTAMP}",
  "scope_note": "These values come from the VPS host and Docker environment, not the edge runtime container.",
  "cpu": {
    "usage_percent": ${CPU_USAGE},
    "cores_detected": ${CORES},
    "load_average": {
      "load_1m": ${LOAD_1M},
      "load_5m": ${LOAD_5M},
      "load_15m": ${LOAD_15M}
    },
    "cgroup_limit_cores": null
  },
  "memory": {
    "host_view": {
      "total_bytes": ${MEM_TOTAL},
      "used_bytes": ${MEM_USED},
      "usage_percent": ${MEM_USAGE_PERCENT},
      "total_human": "$(human_bytes "$MEM_TOTAL")",
      "used_human": "$(human_bytes "$MEM_USED")",
      "free_human": "$(human_bytes "$MEM_FREE")",
      "available_human": "$(human_bytes "$MEM_AVAILABLE")"
    },
    "cgroup_view": {
      "current_bytes": null,
      "limit_bytes": null,
      "usage_percent": null,
      "current_human": null,
      "limit_human": null
    }
  },
  "disk": {
    "root": {
      "path": "/",
      "usage_percent": ${ROOT_PCT},
      "total_bytes": ${ROOT_TOTAL},
      "used_bytes": ${ROOT_USED},
      "free_bytes": ${ROOT_FREE},
      "total_human": "$(human_bytes "$ROOT_TOTAL")",
      "used_human": "$(human_bytes "$ROOT_USED")",
      "free_human": "$(human_bytes "$ROOT_FREE")"
    },
    "tmp": {
      "path": "/tmp",
      "usage_percent": ${TMP_PCT},
      "total_bytes": ${TMP_TOTAL},
      "used_bytes": ${TMP_USED},
      "free_bytes": ${TMP_FREE},
      "total_human": "$(human_bytes "$TMP_TOTAL")",
      "used_human": "$(human_bytes "$TMP_USED")",
      "free_human": "$(human_bytes "$TMP_FREE")"
    }
  },
  "docker": {
    "root_dir": "$(json_escape "$DOCKER_ROOT")",
    "usage_percent": ${DOCKER_PCT},
    "total_bytes": ${DOCKER_TOTAL},
    "used_bytes": ${DOCKER_USED},
    "free_bytes": ${DOCKER_FREE},
    "total_human": "$(human_bytes "$DOCKER_TOTAL")",
    "used_human": "$(human_bytes "$DOCKER_USED")",
    "free_human": "$(human_bytes "$DOCKER_FREE")"
  },
  "app_storage": {
    "postgres_data_bytes": ${POSTGRES_DATA_BYTES},
    "postgres_data_human": "$(human_bytes "$POSTGRES_DATA_BYTES")",
    "storage_files_bytes": ${STORAGE_FILES_BYTES},
    "storage_files_human": "$(human_bytes "$STORAGE_FILES_BYTES")"
  },
  "storage_buckets": {
    "buckets": ${BUCKETS_JSON},
    "summary": {
      "total_buckets": ${TOTAL_BUCKETS:-0},
      "total_files": ${TOTAL_FILES:-0},
      "total_bytes": ${TOTAL_BYTES:-0},
      "total_human": "${TOTAL_HUMAN}"
    }
  },
  "uptime": {
    "uptime_seconds": ${UPTIME_SECONDS},
    "uptime_hours": ${UPTIME_HOURS}
  }
}
EOF

chmod 644 "$OUT_FILE"
echo "Wrote: $OUT_FILE"
