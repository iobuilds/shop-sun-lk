import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
const SENDER_ID = "IO Builds";

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

  try {
    const { phone, message, type, template_key, template_data, order_id, user_id } = await req.json();

    if (!phone) throw new Error("Phone number is required");

    let finalMessage = message;

    // If template_key provided, fetch template and replace placeholders
    if (template_key && !message) {
      const { data: template } = await supabaseAdmin
        .from("sms_templates")
        .select("*")
        .eq("template_key", template_key)
        .eq("is_active", true)
        .single();

      if (!template) throw new Error(`Template '${template_key}' not found or inactive`);

      finalMessage = template.message_template;
      if (template_data) {
        for (const [key, value] of Object.entries(template_data)) {
          finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, "g"), String(value));
        }
      }
    }

    if (!finalMessage) throw new Error("Message is required");

    // Determine SMS type (otp or plain)
    const smsType = type === "otp" ? "otp" : "plain";

    // Send via text.lk API
    const smsResponse = await fetch(TEXTLK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TEXTLK_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        recipient: phone,
        sender_id: SENDER_ID,
        type: smsType,
        message: finalMessage,
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("text.lk response:", JSON.stringify(smsResult));

    const smsStatus = smsResult.status === "success" ? "sent" : "failed";

    // Log the SMS
    await supabaseAdmin.from("sms_logs").insert({
      phone,
      message: finalMessage,
      template_key: template_key || null,
      status: smsStatus,
      provider_response: smsResult,
      order_id: order_id || null,
      user_id: user_id || null,
    });

    // If OTP type, store OTP for verification
    if (smsType === "otp" && smsResult.data?.otp) {
      // Clean up old OTPs for this phone
      await supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("phone", phone)
        .eq("verified", false);

      await supabaseAdmin.from("otp_verifications").insert({
        phone,
        otp_code: String(smsResult.data.otp),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: smsStatus === "sent", status: smsStatus, data: smsResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("SMS send error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
