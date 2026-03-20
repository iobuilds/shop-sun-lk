import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const STATUS_TEMPLATE_MAP: Record<string, string> = {
  pending: "order_placed",
  confirmed: "order_confirmed",
  paid: "payment_received",
  payment_rejected: "payment_rejected",
  processing: "order_processing",
  packed: "order_packed",
  shipped: "order_shipped",
  out_for_delivery: "order_out_for_delivery",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
  returned: "order_returned",
  refund_processed: "refund_processed",
  wallet_credited: "wallet_credited",
  coupon_extra_credit: "coupon_extra_credit",
  delivery_eta_updated: "delivery_eta_updated",
  tracking_updated: "tracking_updated",
};

async function sendCustomerEmail(
  supabaseAdmin: any,
  userEmail: string,
  templateKey: string,
  templateData: Record<string, string>
) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-customer-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ to: userEmail, template_key: templateKey, template_data: templateData }),
    });
    const result = await res.json();
    console.log(`Email [${templateKey}] → ${userEmail}:`, result?.success ? "sent" : result?.message || "failed");
  } catch (e) {
    console.error(`Email send error [${templateKey}]:`, e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
  if (!TEXTLK_API_KEY) {
    return new Response(JSON.stringify({ error: "TEXTLK_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { order_id, status, tracking_code } = await req.json();
    if (!order_id || !status) throw new Error("order_id and status are required");

    const templateKey = STATUS_TEMPLATE_MAP[status];
    if (!templateKey) {
      return new Response(
        JSON.stringify({ success: false, message: `No template mapped for status: ${status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // No duplicate-send guard — admin may legitimately re-send a status update
    // (e.g. when reverting to a previous step and re-advancing, or resending manually)

    // Fetch order + profile
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders").select("*").eq("id", order_id).single();
    if (orderError || !order) throw new Error("Order not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("phone, full_name").eq("user_id", order.user_id).single();

    const phone = profile?.phone || (order.shipping_address as any)?.phone;
    const shortOrderId = order.id.slice(0, 8).toUpperCase();
    const trackingLink = order.tracking_link || "";
    const eta = order.expected_delivery || "3-5 business days";

    // Common template data for email
    const templateData: Record<string, string> = {
      customer_name: profile?.full_name || "Customer",
      order_id: shortOrderId,
      total: String(order.total?.toLocaleString() || "0"),
      status,
      payment_method: order.payment_method || "N/A",
      tracking_number: tracking_code || order.tracking_number || "",
      tracking_link: trackingLink,
      eta,
    };

    // ── Get user email ────────────────────────────────────────────────────────
    let userEmail = "";
    try {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
      if (user?.email) userEmail = user.email;
    } catch (_) { /* email is best-effort */ }

    // ── Send SMS ──────────────────────────────────────────────────────────────
    let smsStatus = "skipped";
    if (phone) {
      const { data: smsTemplate } = await supabaseAdmin
        .from("sms_templates").select("*")
        .eq("template_key", templateKey).eq("is_active", true).single();

      if (smsTemplate) {
        let finalMessage = smsTemplate.message_template
          .replace(/{{customer_name}}/g, profile?.full_name || "Customer")
          .replace(/{{order_id}}/g, shortOrderId)
          .replace(/{{total}}/g, String(order.total?.toLocaleString() || "0"))
          .replace(/{{status}}/g, status)
          .replace(/{{tracking_info}}/g, tracking_code ? `Tracking: ${tracking_code}. ` : "")
          .replace(/{{tracking_link}}/g, trackingLink)
          .replace(/{{eta}}/g, eta)
          .replace(/{{wallet_amount}}/g, String((order as any).wallet_amount || "0"))
          .replace(/{{coupon_code}}/g, order.coupon_code || "");

        const smsResponse = await fetch(TEXTLK_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TEXTLK_API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            recipient: phone,
            sender_id: Deno.env.get("TEXTLK_SENDER_ID") ?? "NanoCircuit",
            type: "plain",
            message: finalMessage,
          }),
        });

        const smsResult = await smsResponse.json();
        smsStatus = smsResult.status === "success" ? "sent" : "failed";

        await supabaseAdmin.from("sms_logs").insert({
          phone,
          message: finalMessage,
          template_key: templateKey,
          status: smsStatus,
          provider_response: smsResult,
          order_id,
          user_id: order.user_id,
        });
      }
    }

    // ── Send Email (non-blocking, checks is_active) ───────────────────────────
    if (userEmail) {
      await sendCustomerEmail(supabaseAdmin, userEmail, templateKey, templateData);
    }

    return new Response(
      JSON.stringify({ success: true, sms_status: smsStatus, email_attempted: !!userEmail }),
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
