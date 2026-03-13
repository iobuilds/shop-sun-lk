import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const projectRef = Deno.env.get("VITE_SUPABASE_PROJECT_ID") || "rcefmfiqqqsfurkdljup";
    const managementToken = Deno.env.get("MANAGEMENT_API_TOKEN");

    if (!managementToken) {
      return new Response(JSON.stringify({ error: "MANAGEMENT_API_TOKEN not set" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set JWT expiry to 604800 seconds (7 days)
    // Set refresh token reuse interval to 0 (always valid until explicitly revoked)
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jwt_expiry: 604800, // 7 days in seconds
        refresh_token_rotation_enabled: true,
        security_refresh_token_reuse_interval: 10,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({ success: res.ok, data }), {
      status: res.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
