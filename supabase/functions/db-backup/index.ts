import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "site_settings", "categories", "products", "banners", "promo_banners",
  "combo_packs", "combo_pack_items", "daily_deals", "pages", "coupons",
  "sms_templates",
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
];

// Tables that should use upsert (conflict on unique key) instead of insert during restore
const UPSERT_TABLES: Record<string, string> = {
  site_settings: "key",
  sms_templates: "template_key",
};

const STORAGE_BUCKETS = ["images"];

async function getAllStorageFiles(adminClient: any, bucket: string, path = ""): Promise<string[]> {
  const files: string[] = [];
  const { data, error } = await adminClient.storage.from(bucket).list(path, { limit: 1000 });
  if (error || !data) return files;
  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.id) {
      files.push(fullPath);
    } else {
      const subFiles = await getAllStorageFiles(adminClient, bucket, fullPath);
      files.push(...subFiles);
    }
  }
  return files;
}

async function exportAllTableData(adminClient: any): Promise<Record<string, any[]>> {
  const backup: Record<string, any[]> = {};
  for (const table of TABLES) {
    const { data, error } = await adminClient.from(table).select("*");
    if (error) { console.error(`Error fetching ${table}:`, error.message); backup[table] = []; }
    else { backup[table] = data || []; }
  }
  return backup;
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
  // PUBLIC_SUPABASE_URL = the externally-reachable base URL of this Supabase instance
  // e.g. https://your-vps-domain.com  (no trailing slash)
  // Falls back to supabaseUrl so cloud-hosted deployments work without setting it
  const publicSupabaseUrl = (Deno.env.get("PUBLIC_SUPABASE_URL") || supabaseUrl).replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const body = await req.json();
  const { action } = body;

  // ── Scheduled backup from pg_cron ──
  if (action === "scheduled_backup") {
    try {
      const backup = await exportAllTableData(adminClient);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `scheduled-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, blob, { contentType: "application/json", upsert: false });
      if (uploadError) {
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await adminClient.from("db_backup_logs").insert({ action: "backup", file_name: fileName, file_size: blob.length, created_by_email: "system (scheduled)" });

      // Clean up old scheduled backups - keep only the last 10
      const { data: allFiles } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
      const scheduledFiles = (allFiles || []).filter((f: any) => f.name.startsWith("scheduled-backup-"));
      if (scheduledFiles.length > 10) {
        const toDelete = scheduledFiles.slice(10).map((f: any) => f.name);
        await adminClient.storage.from("db-backups").remove(toDelete);
      }

      // Auto-cleanup: unschedule the pg_cron job if job_name provided
      const { job_name } = body;
      if (job_name) {
        try {
          const pgClient = await getPgClient();
          await pgClient.queryArray(`SELECT cron.unschedule($1)`, [job_name]);
          await pgClient.end();
        } catch (e) {
          console.error("Failed to unschedule job:", (e as Error).message);
        }
      }

      return new Response(JSON.stringify({ success: true, file_name: fileName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // All other actions require admin authentication
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
      if (!scheduled_at) {
        return new Response(JSON.stringify({ error: "scheduled_at required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

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

      const fnUrl = `${publicSupabaseUrl.replace(/\/$/, "")}/functions/v1/db-backup`;
      const jobBody = JSON.stringify({ action: "scheduled_backup", job_name: jobName });
      const headersStr = `{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}`;

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

      return new Response(JSON.stringify({ success: true, job_name: jobName, cron_expr: cronExpr, scheduled_at: d.toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
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
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Cancel a scheduled job ──
  if (action === "cancel_scheduled") {
    const { job_name } = body;
    if (!job_name) {
      return new Response(JSON.stringify({ error: "job_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    try {
      const pgClient = await getPgClient();
      await pgClient.queryArray(`SELECT cron.unschedule($1)`, [job_name]);
      await pgClient.end();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Regular JSON backup ──
  if (action === "backup") {
    try {
      const backup = await exportAllTableData(adminClient);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, blob, { contentType: "application/json", upsert: false });
      if (uploadError) {
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await adminClient.from("db_backup_logs").insert({ action: "backup", file_name: fileName, file_size: blob.length, created_by: user.id, created_by_email: user.email });
      return new Response(JSON.stringify({ success: true, file_name: fileName, size: blob.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Full ZIP backup (DB + all storage files) ──
  if (action === "full_backup") {
    try {
      const zip = new JSZip();
      const backup = await exportAllTableData(adminClient);
      zip.file("database/tables.json", JSON.stringify(backup, null, 2));

      let totalFiles = 0;
      for (const bucket of STORAGE_BUCKETS) {
        const filePaths = await getAllStorageFiles(adminClient, bucket);
        for (const filePath of filePaths) {
          try {
            const { data: fileData, error: dlError } = await adminClient.storage.from(bucket).download(filePath);
            if (dlError || !fileData) { console.error(`Failed to download ${bucket}/${filePath}:`, dlError?.message); continue; }
            const arrayBuffer = await fileData.arrayBuffer();
            zip.file(`storage/${bucket}/${filePath}`, new Uint8Array(arrayBuffer));
            totalFiles++;
          } catch (err) {
            console.error(`Error downloading ${bucket}/${filePath}:`, (err as Error).message);
          }
        }
      }

      const zipData = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const fileName = `full-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, zipData, { contentType: "application/zip", upsert: false });
      if (uploadError) {
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await adminClient.from("db_backup_logs").insert({ action: "full_backup", file_name: fileName, file_size: zipData.length, created_by: user.id, created_by_email: user.email });
      return new Response(JSON.stringify({ success: true, file_name: fileName, size: zipData.length, total_files: totalFiles }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Full ZIP restore ──
  if (action === "full_restore") {
    try {
      const { file_name } = body;
      if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: fileData, error: dlError } = await adminClient.storage.from("db-backups").download(file_name);
      if (dlError || !fileData) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const arrayBuffer = await fileData.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const tablesFile = zip.file("database/tables.json");
      if (tablesFile) {
        const tablesJson = await tablesFile.async("string");
        const backupData: Record<string, any[]> = JSON.parse(tablesJson);
        const deleteOrder = [...TABLES].reverse();
        for (const table of deleteOrder) {
          if (backupData[table] !== undefined && !UPSERT_TABLES[table]) {
            const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
            if (error) console.error(`Delete ${table}:`, error.message);
          }
        }
        for (const table of TABLES) {
          const rows = backupData[table];
          if (rows && rows.length > 0) {
            for (let i = 0; i < rows.length; i += 100) {
              const batch = rows.slice(i, i + 100);
              if (UPSERT_TABLES[table]) {
                const { error } = await adminClient.from(table).upsert(batch, { onConflict: UPSERT_TABLES[table] });
                if (error) console.error(`Upsert ${table} batch ${i}:`, error.message);
              } else {
                const { error } = await adminClient.from(table).insert(batch);
                if (error) console.error(`Insert ${table} batch ${i}:`, error.message);
              }
            }
          }
        }
      }

      let restoredFiles = 0;
      for (const bucket of STORAGE_BUCKETS) {
        const prefix = `storage/${bucket}/`;
        const bucketFiles = Object.keys(zip.files).filter(f => f.startsWith(prefix) && !zip.files[f].dir);
        const { data: existingFiles } = await adminClient.storage.from(bucket).list("", { limit: 1000 });
        if (existingFiles && existingFiles.length > 0) {
          const allExisting = await getAllStorageFiles(adminClient, bucket);
          if (allExisting.length > 0) {
            for (let i = 0; i < allExisting.length; i += 100) {
              await adminClient.storage.from(bucket).remove(allExisting.slice(i, i + 100));
            }
          }
        }
        for (const zipPath of bucketFiles) {
          const storagePath = zipPath.substring(prefix.length);
          const fileObj = zip.file(zipPath);
          if (!fileObj) continue;
          try {
            const content = await fileObj.async("uint8array");
            const ext = storagePath.split(".").pop()?.toLowerCase() || "";
            const contentTypes: Record<string, string> = {
              jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
              webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", json: "application/json",
            };
            const { error: upErr } = await adminClient.storage.from(bucket).upload(storagePath, content, { contentType: contentTypes[ext] || "application/octet-stream", upsert: true });
            if (upErr) console.error(`Upload ${bucket}/${storagePath}:`, upErr.message);
            else restoredFiles++;
          } catch (err) {
            console.error(`Error restoring ${bucket}/${storagePath}:`, (err as Error).message);
          }
        }
      }

      await adminClient.from("db_backup_logs").insert({ action: "full_restore", file_name, created_by: user.id, created_by_email: user.email });
      return new Response(JSON.stringify({ success: true, restored_files: restoredFiles }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Regular JSON restore ──
  if (action === "restore") {
    try {
      const { file_name, data: uploadedData } = body;
      let backupData: Record<string, any[]>;

      if (uploadedData) {
        backupData = uploadedData;
      } else if (file_name) {
        const { data: fileData, error: dlError } = await adminClient.storage.from("db-backups").download(file_name);
        if (dlError || !fileData) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const text = await fileData.text();
        backupData = JSON.parse(text);
      } else {
        return new Response(JSON.stringify({ error: "No file_name or data provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const deleteOrder = [...TABLES].reverse();
      for (const table of deleteOrder) {
        if (backupData[table] !== undefined && !UPSERT_TABLES[table]) {
          const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) console.error(`Delete ${table}:`, error.message);
        }
      }
      for (const table of TABLES) {
        const rows = backupData[table];
        if (rows && rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            if (UPSERT_TABLES[table]) {
              const { error } = await adminClient.from(table).upsert(rows.slice(i, i + 100), { onConflict: UPSERT_TABLES[table] });
              if (error) console.error(`Upsert ${table} batch ${i}:`, error.message);
            } else {
              const { error } = await adminClient.from(table).insert(rows.slice(i, i + 100));
              if (error) console.error(`Insert ${table} batch ${i}:`, error.message);
            }
          }
        }
      }

      await adminClient.from("db_backup_logs").insert({ action: "restore", file_name: file_name || "uploaded-file", created_by: user.id, created_by_email: user.email });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Get a signed upload URL so the browser can PUT the ZIP directly (no base64 / size limit) ──
  if (action === "get_upload_url") {
    try {
      const { file_name } = body;
      if (!file_name) {
        return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data, error } = await adminClient.storage.from("db-backups").createSignedUploadUrl(file_name);
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Could not create signed upload URL: " + error?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Build the upload URL from scratch using the token.
      // We NEVER use data.signedUrl directly because on Lovable Cloud it returns a
      // relative path like "db/storage/v1/..." which is invalid for browser fetch.
      const normalizedPublicBase = publicSupabaseUrl.replace(/\/$/, "");
      const uploadToken = (data as any).token as string;
      const uploadUrl = `${normalizedPublicBase}/storage/v1/object/upload/sign/db-backups/${encodeURIComponent(file_name)}?token=${uploadToken}`;

      return new Response(JSON.stringify({ url: uploadUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Upload ZIP from browser (multipart) and store in db-backups ──
  if (action === "upload_zip") {
    try {
      const { file_name, file_data } = body; // file_data is base64
      if (!file_name || !file_data) {
        return new Response(JSON.stringify({ error: "file_name and file_data required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const binaryStr = atob(file_data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const { error: upErr } = await adminClient.storage.from("db-backups").upload(file_name, bytes, { contentType: "application/zip", upsert: false });
      if (upErr) throw new Error("Storage upload failed: " + upErr.message);
      return new Response(JSON.stringify({ success: true, file_name }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Get recent logs (backup activity + any console errors recorded) ──
  if (action === "get_logs") {
    try {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: backupLogs } = await adminClient
        .from("db_backup_logs")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);

      const logs = (backupLogs || []).map((l: any) => ({
        event_message: `[${(l.action || "").toUpperCase()}] ${l.file_name}${l.note ? " — " + l.note : ""}${l.file_size ? ` (${(l.file_size / 1024).toFixed(1)} KB)` : ""}`,
        level: "info",
        timestamp: new Date(l.created_at).getTime(),
      }));

      return new Response(JSON.stringify({ logs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  if (action === "list") {
    const { data: files, error } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: logs } = await adminClient.from("db_backup_logs").select("*").order("created_at", { ascending: false });
    return new Response(JSON.stringify({ files: files || [], logs: logs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "delete") {
    const { file_name } = body;
    if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { error } = await adminClient.storage.from("db-backups").remove([file_name]);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "download_url") {
    const { file_name } = body;
    if (!file_name) {
      return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await adminClient.storage.from("db-backups").createSignedUrl(file_name, 600);
    if (error || !data) {
      return new Response(JSON.stringify({ error: error?.message || "Could not create signed URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Replace internal host (kong:8000, localhost, etc.) with the public URL
    const publicUrl = data.signedUrl.replace(/^https?:\/\/[^/]+(?::\d+)?/, publicSupabaseUrl);

    return new Response(JSON.stringify({ url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});