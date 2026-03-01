import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "site_settings", "categories", "products", "banners", "promo_banners",
  "combo_packs", "combo_pack_items", "daily_deals", "pages", "coupons",
  "sms_templates", "profiles", "user_roles",
  "orders", "order_items", "order_status_history",
  "reviews", "wishlists", "contact_messages", "sms_logs",
  "product_external_links", "product_similar_items", "otp_verifications",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify caller is admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "backup") {
    try {
      const backup: Record<string, any[]> = {};
      for (const table of TABLES) {
        const { data, error } = await adminClient.from(table).select("*");
        if (error) {
          console.error(`Error fetching ${table}:`, error.message);
          backup[table] = [];
        } else {
          backup[table] = data || [];
        }
      }

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Uint8Array(new TextEncoder().encode(jsonStr));
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const { error: uploadError } = await adminClient.storage
        .from("db-backups")
        .upload(fileName, blob, { contentType: "application/json", upsert: false });

      if (uploadError) {
        return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await adminClient.from("db_backup_logs").insert({
        action: "backup",
        file_name: fileName,
        file_size: blob.length,
        created_by: user.id,
        created_by_email: user.email,
      });

      return new Response(JSON.stringify({ success: true, file_name: fileName, size: blob.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  if (action === "restore") {
    try {
      const { file_name, data: uploadedData } = body;
      let backupData: Record<string, any[]>;

      if (uploadedData) {
        backupData = uploadedData;
      } else if (file_name) {
        const { data: fileData, error: dlError } = await adminClient.storage
          .from("db-backups")
          .download(file_name);
        if (dlError || !fileData) {
          return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const text = await fileData.text();
        backupData = JSON.parse(text);
      } else {
        return new Response(JSON.stringify({ error: "No file_name or data provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

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

      await adminClient.from("db_backup_logs").insert({
        action: "restore",
        file_name: file_name || "uploaded-file",
        created_by: user.id,
        created_by_email: user.email,
      });

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
    const { data, error } = await adminClient.storage.from("db-backups").createSignedUrl(file_name, 300);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ url: data.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
