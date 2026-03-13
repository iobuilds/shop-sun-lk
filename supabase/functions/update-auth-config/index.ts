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
    const projectRef = "rcefmfiqqqsfurkdljup";
    const managementToken = Deno.env.get("MANAGEMENT_API_TOKEN");

    console.log("Management token present:", !!managementToken);
    console.log("Token prefix:", managementToken?.substring(0, 10));

    if (!managementToken) {
      return new Response(JSON.stringify({ error: "MANAGEMENT_API_TOKEN not set" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set JWT expiry to 604800 seconds (7 days) so users stay logged in longer
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

    const responseText = await res.text();
    console.log("Management API response status:", res.status);
    console.log("Management API response:", responseText);

    let data;
    try { data = JSON.parse(responseText); } catch { data = responseText; }

    return new Response(JSON.stringify({ success: res.ok, status: res.status, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
