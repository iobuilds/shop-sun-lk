import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

async function sendCustomerEmail(
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
    const { order_id, template_key, extra_data } = await req.json();
    if (!order_id || !template_key) throw new Error("order_id and template_key are required");

    // Duplicate-send guard (skip for rejection events)
    const skipDuplicateCheck = ["pcb_payment_rejected", "pcb_arrival_rejected"].includes(template_key);
    if (!skipDuplicateCheck) {
      const { data: existingLog } = await supabaseAdmin
        .from("sms_logs").select("id")
        .eq("order_id", order_id).eq("template_key", template_key).eq("status", "sent").limit(1);
      if (existingLog && existingLog.length > 0) {
        return new Response(
          JSON.stringify({ success: false, message: "Already sent for this event" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Fetch PCB order + customer
    const { data: order, error: orderError } = await supabaseAdmin
      .from("pcb_order_requests").select("*").eq("id", order_id).single();
    if (orderError || !order) throw new Error("PCB order not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("phone, full_name").eq("user_id", order.user_id).maybeSingle();

    const phone = profile?.phone;
    const shortId = order.id.slice(0, 8).toUpperCase();
    const unitCost = order.unit_cost_total || 0;
    const shippingFee = order.shipping_fee || 0;
    const taxAmount = order.tax_amount || 0;
    const grandTotal = unitCost + shippingFee + taxAmount;

    // Common template data
    const templateData: Record<string, string> = {
      customer_name: profile?.full_name || "Customer",
      order_id: shortId,
      total: grandTotal.toLocaleString(),
      unit_cost: unitCost.toLocaleString(),
      shipping_fee: shippingFee.toLocaleString(),
      tax_amount: taxAmount.toLocaleString(),
      quantity: String(order.quantity || 1),
      admin_notes: order.admin_notes || "",
      tracking_number: order.tracking_number || "",
      ...(extra_data || {}),
    };

    // ── Get user email ────────────────────────────────────────────────────────
    let userEmail = "";
    try {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
      if (user?.email) userEmail = user.email;
    } catch (_) { /* best-effort */ }

    // ── Send SMS ──────────────────────────────────────────────────────────────
    let smsStatus = "skipped";
    if (phone) {
      const { data: smsTemplate } = await supabaseAdmin
        .from("sms_templates").select("*")
        .eq("template_key", template_key).eq("is_active", true).maybeSingle();

      if (smsTemplate) {
        let msg = smsTemplate.message_template
          .replace(/{{customer_name}}/g, profile?.full_name || "Customer")
          .replace(/{{order_id}}/g, shortId)
          .replace(/{{total}}/g, grandTotal.toLocaleString())
          .replace(/{{tracking_link}}/g, "")
          .replace(/{{admin_notes}}/g, order.admin_notes ? ` Note: ${order.admin_notes}` : "")
          .replace(/{{reject_reason}}/g, extra_data?.reject_reason ? ` Reason: ${extra_data.reject_reason}` : "");

        if (extra_data) {
          for (const [k, v] of Object.entries(extra_data)) {
            msg = msg.replace(new RegExp(`{{${k}}}`, "g"), String(v));
          }
        }

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
            message: msg,
          }),
        });

        const smsResult = await smsResponse.json();
        smsStatus = smsResult.status === "success" ? "sent" : "failed";

        await supabaseAdmin.from("sms_logs").insert({
          phone, message: msg, template_key,
          status: smsStatus, provider_response: smsResult,
          order_id, user_id: order.user_id,
        });
      }
    }

    // ── Send Email (non-blocking, checks is_active) ───────────────────────────
    if (userEmail) {
      await sendCustomerEmail(userEmail, template_key, templateData);
    }

    return new Response(
      JSON.stringify({ success: true, sms_status: smsStatus, email_attempted: !!userEmail }),
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
