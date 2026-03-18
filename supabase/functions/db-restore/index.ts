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

const UPSERT_TABLES: Record<string, string> = {
  site_settings: "key",
  sms_templates: "template_key",
  email_templates: "template_key",
};

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

// Download a storage file in 5 MB chunks using HTTP Range requests.
// This bypasses Kong's proxy buffer limit (~10 MB on self-hosted VPS) which
// silently truncates large responses and causes "Corrupted zip" errors.
// NOTE: We do NOT use Content-Range totalSize to cap requests — the metadata
// size can differ from the actual ZIP content length on multipart uploads,
// causing truncation. Instead we rely purely on partial-chunk / 416 detection.
async function downloadStorageFileAsBuffer(adminClient: any, bucket: string, fileName: string): Promise<ArrayBuffer> {
  const { data: signedData, error: signErr } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(fileName, 600); // 10 min expiry
  if (signErr || !signedData?.signedUrl) {
    throw new Error(`Could not create signed URL: ${signErr?.message}`);
  }

  const url = signedData.signedUrl;
  const CHUNK = 5 * 1024 * 1024; // 5 MB per request — well below Kong's 10 MB buffer cap
  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (true) {
    const rangeEnd = offset + CHUNK - 1;
    const resp = await fetch(url, {
      headers: { Range: `bytes=${offset}-${rangeEnd}` },
    });

    // 416 = Range Not Satisfiable → we've read past the end, stop
    if (resp.status === 416) {
      await resp.text(); // drain body
      break;
    }

    if (resp.status !== 206 && resp.status !== 200) {
      await resp.text(); // drain body
      throw new Error(`Download failed: HTTP ${resp.status}`);
    }

    const chunk = new Uint8Array(await resp.arrayBuffer());
    if (chunk.byteLength > 0) {
      chunks.push(chunk);
      offset += chunk.byteLength;
    }

    // If server returned 200 (no range support), we got the full file in one shot
    if (resp.status === 200) break;
    // Partial chunk means we've hit the end of file
    if (chunk.byteLength < CHUNK) break;
    // Empty chunk guard
    if (chunk.byteLength === 0) break;
  }

  if (chunks.length === 0) throw new Error("Downloaded 0 bytes from storage");

  // Concatenate all chunks into one ArrayBuffer
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  log("info", "Chunked download complete", { chunks: chunks.length, totalBytes: total });
  const result = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { result.set(c, pos); pos += c.byteLength; }
  return result.buffer;
}

async function getPgClient() {
  const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const client = new Client(dbUrl);
  await client.connect();
  return client;
}

async function restoreTableData(adminClient: any, backupData: Record<string, any[]>): Promise<{ tables_cleared: number; rows_restored: number; errors: { table: string; error: string }[] }> {
  const errors: { table: string; error: string }[] = [];
  let tables_cleared = 0;
  let rows_restored = 0;

  // Disable FK checks so profiles/user_roles can be restored without auth.users on a fresh VPS
  let pgClient: any = null;
  try {
    pgClient = await getPgClient();
    await pgClient.queryArray(`SET session_replication_role = 'replica'`);
    log("info", "FK checks disabled via session_replication_role=replica");
  } catch (e) {
    log("error", "Could not disable FK checks via pg", { error: (e as Error).message });
    pgClient = null;
  }

  // Delete in reverse order to respect FK dependencies
  const deleteOrder = [...TABLES].reverse();
  for (const table of deleteOrder) {
    if (backupData[table] !== undefined && !UPSERT_TABLES[table]) {
      const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        log("error", `Delete ${table}`, { error: error.message });
        errors.push({ table, error: "delete: " + error.message });
      } else {
        tables_cleared++;
        log("info", `Cleared table: ${table}`);
      }
    }
  }

  // Insert/upsert rows
  for (const table of TABLES) {
    const rows = backupData[table];
    if (rows && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        if (UPSERT_TABLES[table]) {
          const { error } = await adminClient.from(table).upsert(batch, { onConflict: UPSERT_TABLES[table] });
          if (error) {
            log("error", `Upsert ${table} batch ${i}`, { error: error.message });
            errors.push({ table, error: `upsert batch ${i}: ` + error.message });
          } else {
            rows_restored += batch.length;
          }
        } else {
          const { error } = await adminClient.from(table).insert(batch);
          if (error) {
            log("error", `Insert ${table} batch ${i}`, { error: error.message });
            errors.push({ table, error: `insert batch ${i}: ` + error.message });
          } else {
            rows_restored += batch.length;
          }
        }
      }
      log("info", `Restored ${table}: ${rows.length} rows`);
    }
  }

  // Re-enable FK checks
  if (pgClient) {
    try {
      await pgClient.queryArray(`SET session_replication_role = 'origin'`);
      await pgClient.end();
      log("info", "FK checks re-enabled");
    } catch (e) {
      log("error", "Could not re-enable FK checks", { error: (e as Error).message });
    }
  }

  return { tables_cleared, rows_restored, errors };
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
  log("info", `db-restore called`, { action });

  // ── All actions require admin authentication ──
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

  // ── JSON restore (from storage file or uploaded data) ──
  if (action === "restore") {
    try {
      log("info", "Starting JSON restore", { user: user.email });
      const { file_name, data: uploadedData } = body;
      let backupData: Record<string, any[]>;

      if (uploadedData) {
        backupData = uploadedData;
        log("info", "Using uploaded data for restore");
      } else if (file_name) {
        log("info", "Downloading backup file", { file_name });
        try {
          const buf = await downloadStorageFileAsBuffer(adminClient, "db-backups", file_name);
          backupData = JSON.parse(new TextDecoder().decode(buf));
        } catch (dlErr: any) {
          log("error", "Could not download file", { error: dlErr.message });
          return new Response(JSON.stringify({ error: "Could not download file: " + dlErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        log("info", "Backup file downloaded and parsed", { tables: Object.keys(backupData).length });
      } else {
        return new Response(JSON.stringify({ error: "No file_name or data provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await restoreTableData(adminClient, backupData);
      log("info", "JSON restore complete", result);

      await adminClient.from("db_backup_logs").insert({
        action: "restore",
        file_name: file_name || "uploaded-file",
        created_by: user.id,
        created_by_email: user.email,
        note: `Restored ${result.rows_restored} rows across ${result.tables_cleared} tables. Errors: ${result.errors.length}`,
      });

      return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "JSON restore failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Full ZIP restore — Phase 1: DB tables ──
  if (action === "full_restore") {
    try {
      const { file_name } = body;
      if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      log("info", "Starting full ZIP restore (Phase 1: DB)", { file_name, user: user.email });

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await downloadStorageFileAsBuffer(adminClient, "db-backups", file_name);
      } catch (dlError: any) {
        log("error", "Could not download backup file", { error: dlError.message });
        return new Response(JSON.stringify({ error: "Could not download backup file: " + dlError.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      log("info", "Backup ZIP downloaded", { bytes: arrayBuffer.byteLength });
      const zip = await JSZip.loadAsync(arrayBuffer);

      let dbResult = { tables_cleared: 0, rows_restored: 0, errors: [] as { table: string; error: string }[] };
      const tablesFile = zip.file("database/tables.json");
      if (tablesFile) {
        const tablesJson = await tablesFile.async("string");
        const backupData: Record<string, any[]> = JSON.parse(tablesJson);
        log("info", "Parsed tables.json", { tables: Object.keys(backupData).length });
        dbResult = await restoreTableData(adminClient, backupData);
        log("info", "DB restore complete", dbResult);
      } else {
        log("error", "No database/tables.json found in ZIP");
      }

      // Count storage files
      const storageFilePaths: Record<string, string[]> = {};
      for (const bucket of STORAGE_BUCKETS) {
        const prefix = `storage/${bucket}/`;
        storageFilePaths[bucket] = Object.keys(zip.files)
          .filter(f => f.startsWith(prefix) && !zip.files[f].dir)
          .map(f => f.substring(prefix.length));
      }
      const totalStorageFiles = Object.values(storageFilePaths).flat().length;
      log("info", "Storage files in ZIP", { totalStorageFiles });

      await adminClient.from("db_backup_logs").insert({
        action: "full_restore_db",
        file_name,
        created_by: user.id,
        created_by_email: user.email,
        note: `DB Phase 1: ${dbResult.rows_restored} rows restored, ${dbResult.errors.length} errors. ${totalStorageFiles} storage files pending.`,
      });

      return new Response(JSON.stringify({
        success: true,
        storage_files: storageFilePaths,
        total_storage_files: totalStorageFiles,
        db_result: dbResult,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "Full ZIP restore Phase 1 failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Full ZIP restore — Phase 2: Storage files in batches ──
  if (action === "restore_storage_batch") {
    try {
      const { file_name, offset = 0, batch_size = 20, clear_first = false } = body;
      if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      log("info", "Restoring storage batch", { file_name, offset, batch_size, clear_first });

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await downloadStorageFileAsBuffer(adminClient, "db-backups", file_name);
      } catch (dlError: any) {
        log("error", "Could not download backup for storage batch", { error: dlError.message });
        return new Response(JSON.stringify({ error: "Could not download backup file: " + dlError.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const zip = await JSZip.loadAsync(arrayBuffer);

      let restoredFiles = 0;
      let errorCount = 0;
      const results: { path: string; status: string }[] = [];

      for (const bucket of STORAGE_BUCKETS) {
        const prefix = `storage/${bucket}/`;
        const allBucketFiles = Object.keys(zip.files).filter(f => f.startsWith(prefix) && !zip.files[f].dir);

        if (offset === 0 && clear_first) {
          log("info", `Clearing bucket: ${bucket}`);
          const allExisting = await getAllStorageFiles(adminClient, bucket);
          for (let i = 0; i < allExisting.length; i += 100) {
            await adminClient.storage.from(bucket).remove(allExisting.slice(i, i + 100));
          }
          log("info", `Cleared ${allExisting.length} files from ${bucket}`);
        }

        const batchFiles = allBucketFiles.slice(offset, offset + batch_size);
        log("info", `Uploading ${batchFiles.length} files from ${bucket} (offset=${offset})`);

        for (const zipPath of batchFiles) {
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
            const { error: upErr } = await adminClient.storage.from(bucket).upload(storagePath, content, {
              contentType: contentTypes[ext] || "application/octet-stream", upsert: true,
            });
            if (upErr) {
              errorCount++;
              log("error", `Upload failed: ${storagePath}`, { error: upErr.message });
              results.push({ path: storagePath, status: "error: " + upErr.message });
            } else {
              restoredFiles++;
              results.push({ path: storagePath, status: "ok" });
            }
          } catch (err) {
            errorCount++;
            log("error", `Exception uploading: ${storagePath}`, { error: (err as Error).message });
            results.push({ path: storagePath, status: "error: " + (err as Error).message });
          }
        }
      }

      log("info", "Storage batch complete", { restoredFiles, errorCount, offset });
      return new Response(JSON.stringify({ success: true, restored: restoredFiles, errors: errorCount, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "Storage batch restore failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Log restore complete ──
  if (action === "log_restore_complete") {
    const { file_name, restored_files } = body;
    log("info", "Full restore complete", { file_name, restored_files });
    await adminClient.from("db_backup_logs").insert({
      action: "full_restore",
      file_name: file_name || "unknown",
      created_by: user.id,
      created_by_email: user.email,
      note: `Full restore complete. ${restored_files ?? 0} storage files restored.`,
    });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Get signed upload URL ──
  if (action === "get_upload_url") {
    try {
      const { file_name } = body;
      if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      log("info", "Creating signed upload URL", { file_name });
      const { data, error } = await adminClient.storage.from("db-backups").createSignedUploadUrl(file_name);
      if (error || !data) {
        log("error", "Could not create signed upload URL", { error: error?.message });
        return new Response(JSON.stringify({ error: "Could not create signed upload URL: " + error?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const normalizedPublicBase = publicSupabaseUrl.replace(/\/$/, "");
      const uploadToken = (data as any).token as string;
      const uploadUrl = `${normalizedPublicBase}/storage/v1/object/upload/sign/db-backups/${encodeURIComponent(file_name)}?token=${uploadToken}`;

      return new Response(JSON.stringify({ url: uploadUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      log("error", "get_upload_url failed", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── Download a backup file (server-side streaming) ──
  if (action === "download_url") {
    const { file_name } = body;
    if (!file_name) return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    log("info", "Streaming file download", { file_name });
    const { data: fileBlob, error: dlError } = await adminClient.storage.from("db-backups").download(file_name);
    if (dlError || !fileBlob) {
      log("error", "Could not download file for streaming", { error: dlError?.message });
      return new Response(JSON.stringify({ error: dlError?.message || "Could not download file" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isZip = file_name.endsWith(".zip");
    const contentType = isZip ? "application/zip" : "application/json";
    const arrayBuffer = await fileBlob.arrayBuffer();
    log("info", "Streaming file to client", { file_name, bytes: arrayBuffer.byteLength });

    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${file_name}"`,
        "Content-Length": String(arrayBuffer.byteLength),
      },
    });
  }

  // ── Get restore logs ──
  if (action === "get_logs") {
    try {
      const { hours = 24 } = body;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data: backupLogs } = await adminClient
        .from("db_backup_logs")
        .select("*")
        .gte("created_at", since)
        .in("action", ["restore", "full_restore", "full_restore_db"])
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

  log("error", "Invalid action", { action });
  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
