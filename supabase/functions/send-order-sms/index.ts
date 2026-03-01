import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
const SENDER_ID = "IO Builds";

const STATUS_TEMPLATE_MAP: Record<string, string> = {
  pending: "order_placed",
  confirmed: "order_placed",
  paid: "payment_received",
  processing: "order_processing",
  packed: "order_processing",
  shipped: "order_shipped",
  out_for_delivery: "order_shipped",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
  returned: "order_cancelled",
};

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
    const { order_id, status, tracking_code } = await req.json();
    if (!order_id || !status) throw new Error("order_id and status are required");

    // Find template for this status
    const templateKey = STATUS_TEMPLATE_MAP[status];
    if (!templateKey) {
      return new Response(
        JSON.stringify({ success: false, message: `No template mapped for status: ${status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check for duplicate - don't send same SMS for same order+status
    const { data: existingLog } = await supabaseAdmin
      .from("sms_logs")
      .select("id")
      .eq("order_id", order_id)
      .eq("template_key", templateKey)
      .eq("status", "sent")
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: "SMS already sent for this status" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch order with user profile
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderError || !order) throw new Error("Order not found");

    // Get user profile for phone
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", order.user_id)
      .single();

    const phone = profile?.phone || (order.shipping_address as any)?.phone;
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, message: "No phone number found for user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch template
    const { data: template } = await supabaseAdmin
      .from("sms_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .single();

    if (!template) {
      return new Response(
        JSON.stringify({ success: false, message: `Template '${templateKey}' not found or disabled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Replace placeholders
    const shortOrderId = order.id.slice(0, 8).toUpperCase();
    let finalMessage = template.message_template
      .replace(/{{customer_name}}/g, profile?.full_name || "Customer")
      .replace(/{{order_id}}/g, shortOrderId)
      .replace(/{{total}}/g, String(order.total?.toLocaleString() || "0"))
      .replace(/{{status}}/g, status)
      .replace(/{{tracking_info}}/g, tracking_code ? `Tracking: ${tracking_code}. ` : "")
      .replace(/{{eta}}/g, "3-5 business days");

    // Send SMS
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
        type: "plain",
        message: finalMessage,
      }),
    });

    const smsResult = await smsResponse.json();
    const smsStatus = smsResult.status === "success" ? "sent" : "failed";

    // Log
    await supabaseAdmin.from("sms_logs").insert({
      phone,
      message: finalMessage,
      template_key: templateKey,
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
    console.error("Order SMS error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
