import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  // Settings & catalog
  "site_settings", "categories", "products", "banners", "promo_banners",
  "combo_packs", "combo_pack_items", "daily_deals", "pages", "coupons",
  "sms_templates",
  // Users & roles
  "profiles", "user_roles", "moderator_permissions",
  // Orders & fulfillment
  "orders", "order_items", "order_status_history",
  // Pre-orders & PCB
  "preorder_requests", "preorder_items", "pcb_order_requests",
  // Stock & inventory
  "stock_receipts",
  // Customer & engagement
  "reviews", "wishlists", "contact_messages", "sms_logs",
  "product_external_links", "product_similar_items",
  // Auth & notifications
  "otp_verifications", "user_notifications",
  // Coupons & wallets
  "coupon_assignments", "coupon_usage", "wallets", "wallet_transactions",
  // Messaging & logs
  "conversations", "conversation_messages", "db_backup_logs",
];

const STORAGE_BUCKETS = ["images"];

async function getAllStorageFiles(adminClient: any, bucket: string, path = ""): Promise<string[]> {
  const files: string[] = [];
  const { data, error } = await adminClient.storage.from(bucket).list(path, { limit: 1000 });
  if (error || !data) return files;
  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.id) {
      // It's a file
      files.push(fullPath);
    } else {
      // It's a folder, recurse
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
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      // 1. Export all table data
      const backup = await exportAllTableData(adminClient);
      zip.file("database/tables.json", JSON.stringify(backup, null, 2));

      // 2. Export all storage files from each bucket
      let totalFiles = 0;
      for (const bucket of STORAGE_BUCKETS) {
        const filePaths = await getAllStorageFiles(adminClient, bucket);
        for (const filePath of filePaths) {
          try {
            const { data: fileData, error: dlError } = await adminClient.storage.from(bucket).download(filePath);
            if (dlError || !fileData) {
              console.error(`Failed to download ${bucket}/${filePath}:`, dlError?.message);
              continue;
            }
            const arrayBuffer = await fileData.arrayBuffer();
            zip.file(`storage/${bucket}/${filePath}`, new Uint8Array(arrayBuffer));
            totalFiles++;
          } catch (err) {
            console.error(`Error downloading ${bucket}/${filePath}:`, (err as Error).message);
          }
        }
      }

      // 3. Generate ZIP
      const zipData = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const fileName = `full-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

      // 4. Upload ZIP to db-backups
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

  // ── Full ZIP restore (DB + all storage files) ──
  if (action === "full_restore") {
    try {
      const { file_name } = body;
      if (!file_name) {
        return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Download the ZIP
      const { data: fileData, error: dlError } = await adminClient.storage.from("db-backups").download(file_name);
      if (dlError || !fileData) {
        return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 1. Restore database tables
      const tablesFile = zip.file("database/tables.json");
      if (tablesFile) {
        const tablesJson = await tablesFile.async("string");
        const backupData: Record<string, any[]> = JSON.parse(tablesJson);

        // Delete in reverse order (child tables first)
        const deleteOrder = [...TABLES].reverse();
        for (const table of deleteOrder) {
          if (backupData[table] !== undefined) {
            const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
            if (error) console.error(`Delete ${table}:`, error.message);
          }
        }

        // Insert in order (parent tables first)
        for (const table of TABLES) {
          const rows = backupData[table];
          if (rows && rows.length > 0) {
            for (let i = 0; i < rows.length; i += 100) {
              const batch = rows.slice(i, i + 100);
              const { error } = await adminClient.from(table).insert(batch);
              if (error) console.error(`Insert ${table} batch ${i}:`, error.message);
            }
          }
        }
      }

      // 2. Restore storage files
      let restoredFiles = 0;
      for (const bucket of STORAGE_BUCKETS) {
        const prefix = `storage/${bucket}/`;
        const bucketFiles = Object.keys(zip.files).filter(f => f.startsWith(prefix) && !zip.files[f].dir);

        // Clear existing files in bucket (in batches)
        const { data: existingFiles } = await adminClient.storage.from(bucket).list("", { limit: 1000 });
        if (existingFiles && existingFiles.length > 0) {
          // We need to recursively list and delete all files
          const allExisting = await getAllStorageFiles(adminClient, bucket);
          if (allExisting.length > 0) {
            // Delete in batches of 100
            for (let i = 0; i < allExisting.length; i += 100) {
              const batch = allExisting.slice(i, i + 100);
              await adminClient.storage.from(bucket).remove(batch);
            }
          }
        }

        // Upload files from ZIP
        for (const zipPath of bucketFiles) {
          const storagePath = zipPath.substring(prefix.length);
          const fileObj = zip.file(zipPath);
          if (!fileObj) continue;

          try {
            const content = await fileObj.async("uint8array");
            // Determine content type from extension
            const ext = storagePath.split(".").pop()?.toLowerCase() || "";
            const contentTypes: Record<string, string> = {
              jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
              webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon",
              pdf: "application/pdf", json: "application/json",
              mp4: "video/mp4", webm: "video/webm",
            };
            const contentType = contentTypes[ext] || "application/octet-stream";

            const { error: upErr } = await adminClient.storage.from(bucket).upload(storagePath, content, { contentType, upsert: true });
            if (upErr) {
              console.error(`Upload ${bucket}/${storagePath}:`, upErr.message);
            } else {
              restoredFiles++;
            }
          } catch (err) {
            console.error(`Error restoring ${bucket}/${storagePath}:`, (err as Error).message);
          }
        }
      }

      await adminClient.from("db_backup_logs").insert({ action: "full_restore", file_name: file_name, created_by: user.id, created_by_email: user.email });

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
        if (dlError || !fileData) {
          return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const text = await fileData.text();
        backupData = JSON.parse(text);
      } else {
        return new Response(JSON.stringify({ error: "No file_name or data provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const deleteOrder = [...TABLES].reverse();
      for (const table of deleteOrder) {
        if (backupData[table] !== undefined) {
          const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) console.error(`Delete ${table}:`, error.message);
        }
      }

      for (const table of TABLES) {
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
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  if (action === "list") {
    const { data: files, error } = await adminClient.storage.from("db-backups").list("", { sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: logs } = await adminClient.from("db_backup_logs").select("*").order("created_at", { ascending: false });
    return new Response(JSON.stringify({ files: files || [], logs: logs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "delete") {
    const { file_name } = body;
    if (!file_name) {
      return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { error } = await adminClient.storage.from("db-backups").remove([file_name]);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "download_url") {
    const { file_name } = body;
    if (!file_name) {
      return new Response(JSON.stringify({ error: "file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data, error } = await adminClient.storage.from("db-backups").createSignedUrl(file_name, 600);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ url: data.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
