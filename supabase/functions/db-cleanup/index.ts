import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables to clean - excludes profiles, user_roles, moderator_permissions, db_backup_logs, sms_templates, site_settings
const CLEANUP_TABLES = [
  // Child tables first (reverse dependency order)
  "combo_pack_items",
  "order_items",
  "order_status_history",
  "preorder_items",
  "product_external_links",
  "product_similar_items",
  "coupon_assignments",
  "coupon_usage",
  "wallet_transactions",
  "conversation_messages",
  "wishlists",
  "reviews",
  "sms_logs",
  "otp_verifications",
  "user_notifications",
  "stock_receipts",
  "daily_deals",
  "contact_messages",
  "search_logs",
  "sms_scheduled_campaigns",
  "component_variants",  // must come before component_families
  "image_designs",
  // Parent tables
  "preorder_requests",
  "pcb_order_requests",
  "orders",
  "combo_packs",
  "wallets",
  "conversations",
  "products",
  "categories",
  "component_families",
  "banners",
  "promo_banners",
  "pages",
  "coupons",
  "referral_codes",
  "referral_code_usage",
  // site_settings and sms_templates are intentionally preserved
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const results: { table: string; status: string; error?: string }[] = [];

    for (const table of CLEANUP_TABLES) {
      const { error } = await adminClient
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      results.push({
        table,
        status: error ? "failed" : "cleared",
        error: error?.message,
      });

      if (error) {
        console.error(`Failed to clear ${table}:`, error.message);
      }
    }

    const succeeded = results.filter((r) => r.status === "cleared").length;
    const failed = results.filter((r) => r.status === "failed").length;

    // Log the cleanup
    await adminClient.from("db_backup_logs").insert({
      action: "cleanup",
      file_name: `full-cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      created_by_email: "system (cleanup)",
      note: `Cleared ${succeeded} tables, ${failed} failed`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Database cleanup complete. Cleared ${succeeded} tables, ${failed} failed.`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
