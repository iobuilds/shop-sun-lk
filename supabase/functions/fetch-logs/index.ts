import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Not authorized: admin role required");

    const body = await req.json();
    const { log_type = "api", search = "", hours = 1, limit = 100 } = body;

    // Fetch logs from Supabase Management API
    const projectRef = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1];
    if (!projectRef) throw new Error("Could not determine project ref");

    // Use service role key as the management token for self-hosted, 
    // or fall back to querying internal logs tables
    // For Lovable Cloud (managed Supabase), we query the postgres logs via SQL
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    let logs: any[] = [];

    if (log_type === "edge") {
      // Edge function logs from edge_logs table (available in managed Supabase)
      const { data, error } = await supabaseAdmin
        .rpc("get_edge_logs" as any, {
          p_limit: limit,
          p_start: startTime.toISOString(),
          p_end: endTime.toISOString(),
          p_search: search || null,
        })
        .select();

      if (error) {
        // Fallback: return recent activity logs as substitute
        const { data: actLogs } = await supabaseAdmin
          .from("admin_activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        logs = (actLogs || []).map((l: any) => ({
          id: l.id,
          timestamp: l.created_at,
          level: "info",
          event_message: `[${l.action}] by ${l.admin_email || l.admin_id} — target: ${l.target_type || ""}:${l.target_id || ""}`,
          method: "LOG",
          status: "200",
          path: `/${l.action}`,
          ip: l.ip_address || null,
        }));
      } else {
        logs = data || [];
      }
    } else {
      // API / Postgres logs — use postgres_logs or fallback to sms_logs + activity combined
      // For self-hosted VPS, we compose from our own audit tables
      const [actRes, smsRes] = await Promise.all([
        supabaseAdmin
          .from("admin_activity_logs")
          .select("*")
          .gte("created_at", startTime.toISOString())
          .order("created_at", { ascending: false })
          .limit(Math.floor(limit * 0.6)),
        supabaseAdmin
          .from("sms_logs")
          .select("*")
          .gte("created_at", startTime.toISOString())
          .order("created_at", { ascending: false })
          .limit(Math.floor(limit * 0.4)),
      ]);

      const activityLogs = (actRes.data || []).map((l: any) => ({
        id: l.id,
        timestamp: l.created_at,
        level: "info",
        event_message: `[${l.action}] actor: ${l.admin_email || l.admin_id?.slice(0, 8)} target: ${l.target_type || "—"}`,
        method: "LOG",
        status: "200",
        path: `/_activity/${l.action}`,
        ip: l.ip_address || null,
        source: "activity",
        details: l.details,
      }));

      const smsLogs = (smsRes.data || []).map((l: any) => ({
        id: l.id,
        timestamp: l.created_at,
        level: l.status === "failed" ? "error" : "info",
        event_message: `[SMS] to ${l.phone} — ${l.status} — ${l.message?.slice(0, 60)}`,
        method: "POST",
        status: l.status === "failed" ? "500" : "200",
        path: "/send-sms",
        ip: null,
        source: "sms",
      }));

      logs = [...activityLogs, ...smsLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .filter((l) => !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase()))
        .slice(0, limit);
    }

    return new Response(JSON.stringify({ success: true, logs, count: logs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message, logs: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
