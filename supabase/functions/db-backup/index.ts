import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_TABLES = [
  "site_settings", "categories", "products", "banners", "promo_banners",
  "combo_packs", "combo_pack_items", "daily_deals", "pages", "coupons",
  "sms_templates", "profiles", "user_roles",
  "orders", "order_items", "order_status_history",
  "reviews", "wishlists", "contact_messages", "sms_logs",
  "product_external_links", "product_similar_items", "otp_verifications",
];

const CONFIG_TABLES = [
  "site_settings", "categories", "banners", "promo_banners",
  "combo_packs", "combo_pack_items", "daily_deals", "pages",
  "coupons", "sms_templates",
];

const STORAGE_BUCKETS = ["images", "db-backups"];

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchTables(client: any, tables: string[]) {
  const result: Record<string, any[]> = {};
  for (const table of tables) {
    const { data, error } = await client.from(table).select("*");
    if (error) { console.error(`Error fetching ${table}:`, error.message); result[table] = []; }
    else { result[table] = data || []; }
  }
  return result;
}

function generateSqlDump(backup: Record<string, any[]>): string {
  const lines: string[] = [
    "-- Database SQL Dump",
    `-- Generated at: ${new Date().toISOString()}`,
    "-- Format: INSERT statements for all tables",
    "",
  ];

  for (const [table, rows] of Object.entries(backup)) {
    lines.push(`-- Table: ${table} (${rows.length} rows)`);
    lines.push(`DELETE FROM public.${table} WHERE true;`);
    lines.push("");

    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (typeof v === "number") return String(v);
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
        if (Array.isArray(v)) return `'{${v.map((i: any) => `"${String(i).replace(/"/g, '\\"')}"`).join(",")}}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      lines.push(`INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")});`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const body = await req.json();
  const { action } = body;

  // Scheduled backup from pg_cron - no user auth needed
  if (action === "scheduled_backup") {
    try {
      const backup = await fetchTables(adminClient, ALL_TABLES);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `scheduled-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, blob, { contentType: "application/json", upsert: false });
      if (uploadError) return respond({ error: "Upload failed: " + uploadError.message }, 500);

      await adminClient.from("db_backup_logs").insert({ action: "backup", file_name: fileName, file_size: blob.length, created_by_email: "system (scheduled)" });

      // Clean up old scheduled backups - keep only the last 10
      const { data: allFiles } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
      const scheduledFiles = (allFiles || []).filter(f => f.name.startsWith("scheduled-backup-"));
      if (scheduledFiles.length > 10) {
        const toDelete = scheduledFiles.slice(10).map(f => f.name);
        await adminClient.storage.from("db-backups").remove(toDelete);
      }

      return respond({ success: true, file_name: fileName });
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }
  }

  // All other actions require admin authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return respond({ error: "Unauthorized" }, 401);

  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleData) return respond({ error: "Admin access required" }, 403);

  // --- BACKUP (standard snapshot to storage) ---
  if (action === "backup") {
    try {
      const backup = await fetchTables(adminClient, ALL_TABLES);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const { error: uploadError } = await adminClient.storage.from("db-backups").upload(fileName, blob, { contentType: "application/json", upsert: false });
      if (uploadError) return respond({ error: "Upload failed: " + uploadError.message }, 500);

      await adminClient.from("db_backup_logs").insert({ action: "backup", file_name: fileName, file_size: blob.length, created_by: user.id, created_by_email: user.email });
      return respond({ success: true, file_name: fileName, size: blob.length });
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }
  }

  // --- DOWNLOAD CONFIG TABLES ONLY ---
  if (action === "download_config") {
    try {
      const backup = await fetchTables(adminClient, CONFIG_TABLES);
      return respond({ success: true, data: backup, type: "config" });
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }
  }

  // --- DOWNLOAD FULL BACKUP + STORAGE MANIFEST ---
  if (action === "download_full") {
    try {
      const backup = await fetchTables(adminClient, ALL_TABLES);

      // Get storage file listings with signed URLs
      const storageManifest: Record<string, any[]> = {};
      for (const bucket of STORAGE_BUCKETS) {
        const { data: files } = await adminClient.storage.from(bucket).list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
        if (files && files.length > 0) {
          const fileEntries = [];
          for (const file of files) {
            if (file.name === ".emptyFolderPlaceholder") continue;
            const { data: urlData } = await adminClient.storage.from(bucket).createSignedUrl(file.name, 3600);
            fileEntries.push({
              name: file.name,
              size: file.metadata?.size || null,
              created_at: file.created_at,
              mimetype: file.metadata?.mimetype || null,
              signed_url: urlData?.signedUrl || null,
            });
          }
          storageManifest[bucket] = fileEntries;
        }
      }

      return respond({ success: true, data: backup, storage: storageManifest, type: "full" });
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }
  }

  // --- DOWNLOAD SQL DUMP ---
  if (action === "download_sql") {
    try {
      const backup = await fetchTables(adminClient, ALL_TABLES);
      const sql = generateSqlDump(backup);
      return respond({ success: true, sql, type: "sql" });
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }
  }

  // --- RESTORE ---
  if (action === "restore") {
    try {
      const { file_name, data: uploadedData } = body;
      let backupData: Record<string, any[]>;

      if (uploadedData) {
        backupData = uploadedData;
      } else if (file_name) {
        const { data: fileData, error: dlError } = await adminClient.storage.from("db-backups").download(file_name);
        if (dlError || !fileData) return respond({ error: "File not found" }, 404);
        const text = await fileData.text();
        backupData = JSON.parse(text);
      } else {
        return respond({ error: "No file_name or data provided" }, 400);
      }

      const deleteOrder = [...ALL_TABLES].reverse();
      for (const table of deleteOrder) {
        if (backupData[table] !== undefined) {
          const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) console.error(`Delete ${table}:`, error.message);
        }
      }

      for (const table of ALL_TABLES) {
        const rows = backupData[table];
        if (rows && rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { error } = await adminClient.from(table).insert(batch);
            if (error) console.error(`Insert ${table} batch ${i}:`, error.message);
          }
        }
      }

      await adminClient.from("db_backup_logs").insert({ action: "restore", file_name: file_name || "uploaded-file", created_by: user.id, created_by_email: user.email });
      return respond({ success: true });
    } catch (e) {
      return respond({ error: (e as Error).message }, 500);
    }
  }

  // --- LIST ---
  if (action === "list") {
    const { data: files, error } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
    if (error) return respond({ error: error.message }, 500);
    const { data: logs } = await adminClient.from("db_backup_logs").select("*").order("created_at", { ascending: false });
    return respond({ files: files || [], logs: logs || [] });
  }

  // --- DELETE ---
  if (action === "delete") {
    const { file_name } = body;
    if (!file_name) return respond({ error: "file_name required" }, 400);
    const { error } = await adminClient.storage.from("db-backups").remove([file_name]);
    if (error) return respond({ error: error.message }, 500);
    return respond({ success: true });
  }

  // --- DOWNLOAD URL ---
  if (action === "download_url") {
    const { file_name } = body;
    if (!file_name) return respond({ error: "file_name required" }, 400);
    const { data, error } = await adminClient.storage.from("db-backups").createSignedUrl(file_name, 300);
    if (error) return respond({ error: error.message }, 500);
    return respond({ url: data.signedUrl });
  }

  return respond({ error: "Invalid action" }, 400);
});
