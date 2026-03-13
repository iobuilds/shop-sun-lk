import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/http/sms/send";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
  if (!TEXTLK_API_KEY) {
    return new Response(JSON.stringify({ error: "TEXTLK_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Validate admin via JWT
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Check admin role
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { phones, message } = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      throw new Error("phones array is required");
    }
    if (!message) throw new Error("message is required");

    const SENDER_ID = Deno.env.get("TEXTLK_SENDER_ID") ?? "NanoCircuit";

    // Normalize phone numbers: 07XXXXXXXX → 947XXXXXXXX
    const normalizedPhones = phones.map((p: string) => {
      const digits = p.replace(/\D/g, "");
      if (digits.startsWith("0") && digits.length === 10) {
        return "94" + digits.slice(1);
      }
      return digits || p;
    });

    // text.lk supports comma-separated recipients in a single call
    const recipient = normalizedPhones.join(",");

    const smsResponse = await fetch(TEXTLK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        api_token: TEXTLK_API_KEY,
        recipient,
        sender_id: SENDER_ID,
        type: "plain",
        message,
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("text.lk campaign response:", JSON.stringify(smsResult));

    const smsStatus = smsResult.status === "success" ? "sent" : "failed";

    // Log one entry per number
    const logsToInsert = phones.map((phone: string) => ({
      phone,
      message,
      template_key: "campaign",
      status: smsStatus,
      provider_response: smsResult,
    }));

    await supabaseAdmin.from("sms_logs").insert(logsToInsert);

    return new Response(
      JSON.stringify({
        success: smsStatus === "sent",
        sent: smsStatus === "sent" ? phones.length : 0,
        total: phones.length,
        status: smsStatus,
        data: smsResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("SMS campaign error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
