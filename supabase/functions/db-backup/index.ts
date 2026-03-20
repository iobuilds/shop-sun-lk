import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "site_settings", "categories", "products", "banners", "promo_banners",
  "combo_packs", "combo_pack_items", "daily_deals", "pages", "coupons",
  "sms_templates", "sms_scheduled_campaigns",
  "email_templates",
  "profiles", "user_roles", "moderator_permissions",
  "orders", "order_items", "order_status_history",
  "preorder_requests", "preorder_items", "pcb_order_requests",
  "stock_receipts",
  "reviews", "wishlists", "contact_messages", "sms_logs", "search_logs",
  "product_external_links", "product_similar_items",
  "otp_verifications", "user_notifications",
  "coupon_assignments", "coupon_usage", "wallets", "wallet_transactions",
  "referral_codes", "referral_code_usage",
  "conversations", "conversation_messages", "db_backup_logs",
  "admin_activity_logs",
  "component_families", "component_variants",
  "image_designs",
];

const STORAGE_BUCKETS = ["images"];

function log(level: string, msg: string, detail?: any) {
  const ts = new Date().toISOString();
  const line = detail ? `[${ts}] [${level.toUpperCase()}] ${msg} ${JSON.stringify(detail)}` : `[${ts}] [${level.toUpperCase()}] ${msg}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

async function getAllStorageFiles(adminClient: any, bucket: string, path = ""): Promise<string[]> {
  const files: string[] = [];
  const { data, error } = await adminClient.storage.from(bucket).list(path, { limit: 1000 });
  if (error || !data) return files;
  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.id) files.push(fullPath);
    else {
      const sub = await getAllStorageFiles(adminClient, bucket, fullPath);
      files.push(...sub);
    }
  }
  return files;
}

async function exportAllTableData(adminClient: any): Promise<{ data: Record<string, any[]>; stats: { table: string; rows: number }[] }> {
  const backup: Record<string, any[]> = {};
  const stats: { table: string; rows: number }[] = [];
  for (const table of TABLES) {
    const { data, error } = await adminClient.from(table).select("*");
    if (error) {
      log("error", `Error fetching ${table}`, { error: error.message });
      backup[table] = [];
      stats.push({ table, rows: 0 });
    } else {
      backup[table] = data || [];
      stats.push({ table, rows: (data || []).length });
      log("info", `Exported ${table}`, { rows: (data || []).length });
    }
  }
  return { data: backup, stats };
}

async function getPgClient() {
  const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const client = new Client(dbUrl);
  await client.connect();
  return client;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicSupabaseUrl = (Deno.env.get("PUBLIC_SUPABASE_URL") || supabaseUrl).replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { action } = body;
  log("info", `db-backup called`, { action });

  // ── Scheduled backup from pg_cron (no JWT required) ──
  if (action === "scheduled_backup") {
    try {
      log("info", "Starting scheduled backup");
      const { data: backup, stats } = await exportAllTableData(adminClient);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `scheduled-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, blob, { contentType: "application/json", upsert: false });
      if (uploadError) {
        log("error", "Scheduled backup upload failed", { error: uploadError.message });
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const totalRows = stats.reduce((sum, s) => sum + s.rows, 0);
      log("info", "Scheduled backup uploaded", { fileName, size: blob.length, totalRows });

      await adminClient.from("db_backup_logs").insert({
        action: "backup",
        file_name: fileName,
        file_size: blob.length,
        created_by_email: "system (scheduled)",
        note: `Scheduled: ${totalRows} total rows across ${stats.filter(s => s.rows > 0).length} tables`,
      });

      // Keep only the last 10 scheduled backups
      const { data: allFiles } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
      const scheduledFiles = (allFiles || []).filter((f: any) => f.name.startsWith("scheduled-backup-"));
      if (scheduledFiles.length > 10) {
        const toDelete = scheduledFiles.slice(10).map((f: any) => f.name);
        await adminClient.storage.from("db-backups").remove(toDelete);
        log("info", "Cleaned up old scheduled backups", { deleted: toDelete.length });
      }

      // Auto-unschedule cron job if job_name provided
      const { job_name } = body;
      if (job_name) {
        try {
          const pgClient = await getPgClient();
          await pgClient.queryArray(`SELECT cron.unschedule($1)`, [job_name]);
          await pgClient.end();
          log("info", "Unscheduled cron job", { job_name });
        } catch (e) {
          log("error", "Failed to unschedule job", { error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ success: true, file_name: fileName, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "Scheduled backup failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── All other actions require admin authentication ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined };

  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Schedule a one-time backup ──
  if (action === "schedule_backup") {
    try {
      const { scheduled_at, label } = body;
      if (!scheduled_at) return new Response(JSON.stringify({ error: "scheduled_at required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const d = new Date(scheduled_at);
      if (isNaN(d.getTime()) || d <= new Date()) {
        return new Response(JSON.stringify({ error: "scheduled_at must be a future date" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const minute = d.getUTCMinutes();
      const hour = d.getUTCHours();
      const dayOfMonth = d.getUTCDate();
      const month = d.getUTCMonth() + 1;
      const jobName = `manual-backup-${Date.now()}`;
      const cronExpr = `${minute} ${hour} ${dayOfMonth} ${month} *`;

      const fnUrl = `${publicSupabaseUrl}/functions/v1/db-backup`;
      const jobBody = JSON.stringify({ action: "scheduled_backup", job_name: jobName });
      const headersStr = `{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}`;

      log("info", "Scheduling backup", { jobName, cronExpr, fnUrl });
      const pgClient = await getPgClient();
      await pgClient.queryArray(
        `SELECT cron.schedule($1, $2, $3)`,
        [jobName, cronExpr, `SELECT net.http_post(url := '${fnUrl}', headers := '${headersStr}'::jsonb, body := '${jobBody.replace(/'/g, "''")}'::jsonb)`]
      );
      await pgClient.end();

      await adminClient.from("db_backup_logs").insert({
        action: "backup_scheduled",
        file_name: jobName,
        created_by: user.id,
        created_by_email: user.email,
        note: `${d.toISOString()}${label ? ` | ${label}` : ""}`,
      });

      log("info", "Backup scheduled", { jobName, cronExpr });
      return new Response(JSON.stringify({ success: true, job_name: jobName, cron_expr: cronExpr, scheduled_at: d.toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "schedule_backup failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── List scheduled pg_cron jobs ──
  if (action === "list_scheduled") {
    try {
      const pgClient = await getPgClient();
      const result = await pgClient.queryObject<{ jobid: number; jobname: string; schedule: string; active: boolean }>(
        `SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'manual-backup-%' ORDER BY jobid DESC`
      );
      await pgClient.end();

      const { data: logs } = await adminClient.from("db_backup_logs")
        .select("*")
        .eq("action", "backup_scheduled")
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ jobs: result.rows, logs: logs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "list_scheduled failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Cancel a scheduled job ──
  if (action === "cancel_scheduled") {
    const { job_name } = body;
    if (!job_name) return new Response(JSON.stringify({ error: "job_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const pgClient = await getPgClient();
      await pgClient.queryArray(`SELECT cron.unschedule($1)`, [job_name]);
      await pgClient.end();
      log("info", "Cancelled scheduled job", { job_name });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "cancel_scheduled failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Regular JSON backup ──
  if (action === "backup") {
    try {
      log("info", "Starting manual JSON backup", { user: user.email });
      const { data: backup, stats } = await exportAllTableData(adminClient);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, blob, { contentType: "application/json", upsert: false });
      if (uploadError) {
        log("error", "JSON backup upload failed", { error: uploadError.message });
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const totalRows = stats.reduce((sum, s) => sum + s.rows, 0);
      log("info", "JSON backup complete", { fileName, size: blob.length, totalRows });

      await adminClient.from("db_backup_logs").insert({
        action: "backup",
        file_name: fileName,
        file_size: blob.length,
        created_by: user.id,
        created_by_email: user.email,
        note: `${totalRows} total rows across ${stats.filter(s => s.rows > 0).length} tables`,
      });

      return new Response(JSON.stringify({ success: true, file_name: fileName, size: blob.length, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "JSON backup failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Full ZIP backup (DB + all storage files) ──
  if (action === "full_backup") {
    try {
      log("info", "Starting full ZIP backup", { user: user.email });
      const zip = new JSZip();
      const { data: backup, stats } = await exportAllTableData(adminClient);
      zip.file("database/tables.json", JSON.stringify(backup, null, 2));

      let totalFiles = 0;
      for (const bucket of STORAGE_BUCKETS) {
        const filePaths = await getAllStorageFiles(adminClient, bucket);
        log("info", `Downloading ${filePaths.length} files from ${bucket}`);
        for (const filePath of filePaths) {
          try {
            const { data: fileData, error: dlError } = await adminClient.storage.from(bucket).download(filePath);
            if (dlError || !fileData) {
              log("error", `Failed to download ${bucket}/${filePath}`, { error: dlError?.message });
              continue;
            }
            const arrayBuffer = await fileData.arrayBuffer();
            zip.file(`storage/${bucket}/${filePath}`, new Uint8Array(arrayBuffer));
            totalFiles++;
          } catch (err) {
            log("error", `Error downloading ${bucket}/${filePath}`, { error: (err as Error).message });
          }
        }
      }

      log("info", "Compressing ZIP", { totalFiles });
      const zipData = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const fileName = `full-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, zipData, { contentType: "application/zip", upsert: false });
      if (uploadError) {
        log("error", "ZIP backup upload failed", { error: uploadError.message });
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const totalRows = stats.reduce((sum, s) => sum + s.rows, 0);
      log("info", "Full ZIP backup complete", { fileName, size: zipData.length, totalFiles, totalRows });

      await adminClient.from("db_backup_logs").insert({
        action: "full_backup",
        file_name: fileName,
        file_size: zipData.length,
        created_by: user.id,
        created_by_email: user.email,
        note: `${totalRows} rows + ${totalFiles} storage files`,
      });

      return new Response(JSON.stringify({ success: true, file_name: fileName, size: zipData.length, total_files: totalFiles, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "Full ZIP backup failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── List backups + logs ──
  if (action === "list") {
    const { data: files, error } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      log("error", "list failed", { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: logs } = await adminClient.from("db_backup_logs").select("*").order("created_at", { ascending: false });
    return new Response(JSON.stringify({ files: files || [], logs: logs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Delete a backup file ──
  if (action === "delete") {
    const { file_name } = body;
    if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { error } = await adminClient.storage.from("db-backups").remove([file_name]);
    if (error) {
      log("error", "delete failed", { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    log("info", "Deleted backup file", { file_name });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Get recent backup logs ──
  if (action === "get_logs") {
    try {
      const { hours = 24 } = body;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data: backupLogs } = await adminClient
        .from("db_backup_logs")
        .select("*")
        .gte("created_at", since)
        .in("action", ["backup", "full_backup", "backup_scheduled"])
        .order("created_at", { ascending: false })
        .limit(50);

      const logs = (backupLogs || []).map((l: any) => ({
        event_message: `[${(l.action || "").toUpperCase()}] ${l.file_name}${l.note ? " — " + l.note : ""}${l.file_size ? ` (${(l.file_size / 1024).toFixed(1)} KB)` : ""}`,
        level: "info",
        timestamp: new Date(l.created_at).getTime(),
      }));

      return new Response(JSON.stringify({ logs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "get_logs failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Storage bucket management ──

  // List all buckets
  if (action === "storage_list_buckets") {
    try {
      const { data: buckets, error } = await adminClient.storage.listBuckets();
      if (error) throw error;
      return new Response(JSON.stringify({ buckets: buckets || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Create a bucket
  if (action === "storage_create_bucket") {
    const { bucket_name, is_public = false } = body;
    if (!bucket_name) return new Response(JSON.stringify({ error: "bucket_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const { data, error } = await adminClient.storage.createBucket(bucket_name, { public: is_public });
      if (error) throw error;
      log("info", "Created bucket", { bucket_name, is_public });
      return new Response(JSON.stringify({ success: true, bucket: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // List files in a bucket (with optional path prefix)
  if (action === "storage_list_files") {
    const { bucket_name, path = "" } = body;
    if (!bucket_name) return new Response(JSON.stringify({ error: "bucket_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const { data, error } = await adminClient.storage.from(bucket_name).list(path, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return new Response(JSON.stringify({ files: data || [], path }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Get a signed download URL for a file
  if (action === "storage_download_url") {
    const { bucket_name, file_path } = body;
    if (!bucket_name || !file_path) return new Response(JSON.stringify({ error: "bucket_name and file_path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const { data, error } = await adminClient.storage.from(bucket_name).createSignedUrl(file_path, 300);
      if (error) throw error;
      return new Response(JSON.stringify({ url: data?.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Delete file(s) from a bucket
  if (action === "storage_delete_files") {
    const { bucket_name, file_paths } = body;
    if (!bucket_name || !file_paths?.length) return new Response(JSON.stringify({ error: "bucket_name and file_paths required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const { error } = await adminClient.storage.from(bucket_name).remove(file_paths);
      if (error) throw error;
      log("info", "Deleted files", { bucket_name, count: file_paths.length });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Upload a file to a bucket (base64 encoded body)
  if (action === "storage_upload_file") {
    const { bucket_name, file_path, content_base64, content_type = "application/octet-stream" } = body;
    if (!bucket_name || !file_path || !content_base64) return new Response(JSON.stringify({ error: "bucket_name, file_path, content_base64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const binaryStr = atob(content_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const { error } = await adminClient.storage.from(bucket_name).upload(file_path, bytes, { contentType: content_type, upsert: true });
      if (error) throw error;
      log("info", "Uploaded file", { bucket_name, file_path });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Get public URL for a file in a public bucket
  if (action === "storage_public_url") {
    const { bucket_name, file_path } = body;
    if (!bucket_name || !file_path) return new Response(JSON.stringify({ error: "bucket_name and file_path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    try {
      const { data } = adminClient.storage.from(bucket_name).getPublicUrl(file_path);
      return new Response(JSON.stringify({ url: data?.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  log("error", "Invalid action", { action });
  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
