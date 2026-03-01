import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
  if (!TEXTLK_API_KEY) {
    return new Response(
      JSON.stringify({ error: "TEXTLK_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Try text.lk profile/balance endpoint
    const response = await fetch("https://app.text.lk/api/v3/profile", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${TEXTLK_API_KEY}`,
        "Accept": "application/json",
      },
    });

    const data = await response.json();
    console.log("text.lk profile response:", JSON.stringify(data));

    // Extract balance from profile response
    const balance = data?.data?.remaining_balance ?? data?.data?.balance ?? data?.remaining_balance ?? data?.balance ?? null;

    return new Response(
      JSON.stringify({
        success: true,
        balance: balance,
        raw: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("SMS balance error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
