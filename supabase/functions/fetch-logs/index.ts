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

    const projectRef = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1];
    if (!projectRef) throw new Error("Could not determine project ref");

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    let logs: any[] = [];

    // Use the Supabase Management API token (personal access token from supabase.com/dashboard/account/tokens)
    const managementToken = Deno.env.get("MANAGEMENT_API_TOKEN") ?? "";

    // SQL queries for different log types
    const sqlQueries: Record<string, string> = {
      api: `
        SELECT
          id,
          timestamp,
          event_message,
          m.method,
          m.status_code::text as status,
          m.path,
          m.search,
          m.referer,
          m.ip_address
        FROM edge_logs
        CROSS JOIN unnest(metadata) as m
        WHERE timestamp >= ${startTime.getTime() * 1000}
          AND timestamp <= ${endTime.getTime() * 1000}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      postgres: `
        SELECT
          id,
          postgres_logs.timestamp,
          event_message,
          parsed.error_severity,
          parsed.query,
          parsed.detail,
          parsed.hint,
          parsed.duration_ms
        FROM postgres_logs
        CROSS JOIN unnest(metadata) as m
        CROSS JOIN unnest(m.parsed) as parsed
        WHERE timestamp >= ${startTime.getTime() * 1000}
          AND timestamp <= ${endTime.getTime() * 1000}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      auth: `
        SELECT
          id,
          auth_logs.timestamp,
          event_message,
          metadata.level,
          metadata.status,
          metadata.path,
          metadata.msg,
          metadata.error
        FROM auth_logs
        CROSS JOIN unnest(metadata) as metadata
        WHERE timestamp >= ${startTime.getTime() * 1000}
          AND timestamp <= ${endTime.getTime() * 1000}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      edge: `
        SELECT
          id,
          function_edge_logs.timestamp,
          event_message,
          response.status_code,
          request.method,
          m.function_id,
          m.execution_time_ms
        FROM function_edge_logs
        CROSS JOIN unnest(metadata) as m
        CROSS JOIN unnest(m.response) as response
        CROSS JOIN unnest(m.request) as request
        WHERE timestamp >= ${startTime.getTime() * 1000}
          AND timestamp <= ${endTime.getTime() * 1000}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
    };

    const analyticsType = log_type === "api" ? "api" : log_type === "edge" ? "edge" : log_type;
    const sql = sqlQueries[analyticsType] || sqlQueries["api"];

    // Call Supabase Management Analytics API using the personal access token
    if (managementToken) {
      const analyticsRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${managementToken}`,
          },
          body: JSON.stringify({ sql }),
        }
      );

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        const rawRows = analyticsData?.result ?? [];

        if (analyticsType === "api") {
          logs = rawRows.map((row: any) => {
            const msg = row.event_message || "";
            const parts = msg.split(" | ");
            const method = parts[0]?.trim() || row.method || "GET";
            const status = parts[1]?.trim() || row.status || "200";
            const ip = parts[2]?.trim() || row.ip_address || null;
            const reqId = parts[3]?.trim() || null;
            const fullUrl = parts[4]?.trim() || "";
            let path = row.path || "";
            try {
              if (fullUrl) path = new URL(fullUrl).pathname + (new URL(fullUrl).search || "");
            } catch (_) {}
            return {
              id: row.id,
              timestamp: new Date(row.timestamp / 1000).toISOString(),
              level: parseInt(status) >= 400 ? "error" : "info",
              event_message: msg,
              method,
              status,
              path,
              ip,
              req_id: reqId,
              source: "api",
            };
          });
        } else if (analyticsType === "edge") {
          logs = rawRows.map((row: any) => {
            const msg = row.event_message || "";
            const parts = msg.split(" | ");
            const method = parts[0]?.trim() || row.method || "POST";
            const status = parts[1]?.trim() || row.status_code?.toString() || "200";
            const ip = parts[2]?.trim() || null;
            let path = "";
            try {
              if (parts[4]) path = new URL(parts[4].trim()).pathname;
            } catch (_) {}
            return {
              id: row.id,
              timestamp: new Date(row.timestamp / 1000).toISOString(),
              level: parseInt(status) >= 400 ? "error" : "info",
              event_message: msg,
              method,
              status,
              path,
              ip,
              execution_ms: row.execution_time_ms,
              function_id: row.function_id,
              source: "edge",
            };
          });
        } else if (analyticsType === "postgres") {
          logs = rawRows.map((row: any) => ({
            id: row.id,
            timestamp: new Date(row.timestamp / 1000).toISOString(),
            level: row.error_severity === "ERROR" ? "error" : "info",
            event_message: row.event_message || row.query || "",
            method: "SQL",
            status: row.error_severity === "ERROR" ? "500" : "200",
            path: row.query ? row.query.slice(0, 60) : "",
            ip: null,
            source: "postgres",
            details: { query: row.query, detail: row.detail, hint: row.hint, duration_ms: row.duration_ms },
          }));
        } else if (analyticsType === "auth") {
          logs = rawRows.map((row: any) => ({
            id: row.id,
            timestamp: new Date(row.timestamp / 1000).toISOString(),
            level: row.level === "error" ? "error" : "info",
            event_message: row.event_message || row.msg || "",
            method: row.method || "POST",
            status: row.status?.toString() || "200",
            path: row.path || "/auth/v1",
            ip: null,
            source: "auth",
          }));
        }
      } else {
        // Log error for debugging
        const errText = await analyticsRes.text();
        console.error("Management API error:", analyticsRes.status, errText);
      }
    }

    // If analytics API returned nothing (no token or no results), fall back to our own tables
    if (logs.length === 0) {
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
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // Apply search filter
    if (search) {
      const s = search.toLowerCase();
      logs = logs.filter((l) =>
        JSON.stringify(l).toLowerCase().includes(s)
      );
    }

    logs = logs.slice(0, limit);

    return new Response(JSON.stringify({ success: true, logs, count: logs.length, has_management_token: !!managementToken }), {
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
