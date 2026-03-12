import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
cconst textlkSenderId = Deno.env.get("TEXTLK_SENDER_ID");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { order_id, template_key, extra_data } = await req.json();
    if (!order_id || !template_key) throw new Error("order_id and template_key are required");

    // Fetch template — respects is_active toggle
    const { data: template } = await supabaseAdmin
      .from("sms_templates")
      .select("*")
      .eq("template_key", template_key)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ success: false, message: `Template '${template_key}' not found or disabled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Duplicate-send guard
    const { data: existingLog } = await supabaseAdmin
      .from("sms_logs")
      .select("id")
      .eq("order_id", order_id)
      .eq("template_key", template_key)
      .eq("status", "sent")
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: "SMS already sent for this event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch PCB order + customer
    const { data: order, error: orderError } = await supabaseAdmin
      .from("pcb_order_requests")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderError || !order) throw new Error("PCB order not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", order.user_id)
      .maybeSingle();

    const phone = profile?.phone;
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, message: "No phone number for user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const shortId = order.id.slice(0, 8).toUpperCase();
    const grandTotal = (order.unit_cost_total || 0) + (order.shipping_fee || 0) + (order.tax_amount || 0);

    // Replace placeholders
    let msg = template.message_template
      .replace(/{{customer_name}}/g, profile?.full_name || "Customer")
      .replace(/{{order_id}}/g, shortId)
      .replace(/{{total}}/g, grandTotal.toLocaleString())
      .replace(/{{tracking_link}}/g, "")
      .replace(/{{admin_notes}}/g, order.admin_notes ? ` Note: ${order.admin_notes}` : "")
      .replace(/{{reject_reason}}/g, extra_data?.reject_reason ? ` Reason: ${extra_data.reject_reason}` : "");

    // Allow caller to inject extra replacements
    if (extra_data) {
      for (const [k, v] of Object.entries(extra_data)) {
        msg = msg.replace(new RegExp(`{{${k}}}`, "g"), String(v));
      }
    }

    // Send
    const smsResponse = await fetch(TEXTLK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TEXTLK_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ recipient: phone, sender_id: textlkSenderId, type: "plain", message: msg }),
    });

    const smsResult = await smsResponse.json();
    const smsStatus = smsResult.status === "success" ? "sent" : "failed";

    await supabaseAdmin.from("sms_logs").insert({
      phone,
      message: msg,
      template_key,
      status: smsStatus,
      provider_response: smsResult,
      order_id,
      user_id: order.user_id,
    });

    return new Response(
      JSON.stringify({ success: smsStatus === "sent", status: smsStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("PCB SMS error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
