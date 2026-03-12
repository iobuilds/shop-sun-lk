import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
const textlkSenderId = Deno.env.get("TEXTLK_SENDER_ID");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { type, order_id, user_email } = await req.json();

    // Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*, products(name))")
      .eq("id", order_id)
      .single();
    if (orderError) throw orderError;

    // Fetch customer profile
    const { data: customerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", order.user_id)
      .maybeSingle();

    // Fetch admin user IDs
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminEmails: string[] = [];
    const adminPhones: string[] = [];

    if (adminRoles) {
      for (const role of adminRoles) {
        // Get admin email
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        if (user?.email) adminEmails.push(user.email);

        // Get admin phone from profile
        const { data: adminProfile } = await supabaseAdmin
          .from("profiles")
          .select("phone")
          .eq("user_id", role.user_id)
          .maybeSingle();
        if (adminProfile?.phone) adminPhones.push(adminProfile.phone);
      }
    }

    // Log the notification
    const notification = {
      type,
      order_id,
      user_email,
      admin_emails: adminEmails,
      order_total: order.total,
      payment_method: order.payment_method,
      items_count: order.order_items?.length || 0,
      timestamp: new Date().toISOString(),
    };
    console.log("📧 Order notification:", JSON.stringify(notification));

    // Send SMS to admins if new order and API key exists
    const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
    if (type === "new_order" && TEXTLK_API_KEY && adminPhones.length > 0) {
      // Fetch template from DB
      const { data: template } = await supabaseAdmin
        .from("sms_templates")
        .select("*")
        .eq("template_key", "admin_new_order")
        .eq("is_active", true)
        .maybeSingle();

      const shortOrderId = order.id.slice(0, 8).toUpperCase();
      const customerName = customerProfile?.full_name || "Customer";
      const itemCount = order.order_items?.length || 0;
      const itemNames = (order.order_items || [])
        .slice(0, 3)
        .map((i: any) => i.products?.name || "Item")
        .join(", ");
      const moreItems = itemCount > 3 ? ` +${itemCount - 3} more` : "";

      let message: string;
      if (template?.message_template) {
        message = template.message_template
          .replace(/{{order_id}}/g, shortOrderId)
          .replace(/{{customer_name}}/g, customerName)
          .replace(/{{items}}/g, `${itemNames}${moreItems}`)
          .replace(/{{total}}/g, String(order.total?.toLocaleString() || "0"))
          .replace(/{{payment_method}}/g, order.payment_method || "N/A");
      } else {
        // Fallback if template not found or disabled
        message = `🛒 New Order #${shortOrderId}\nCustomer: ${customerName}\nItems: ${itemNames}${moreItems}\nTotal: Rs.${order.total?.toLocaleString()}\nPayment: ${order.payment_method}\n\nCheck admin dashboard for details.`;
      }

      for (const phone of adminPhones) {
        try {
          const smsRes = await fetch(TEXTLK_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TEXTLK_API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({
              recipient: phone,
              sender_id: textlkSenderId,
              type: "plain",
              message,
            }),
          });
          const smsResult = await smsRes.json();
          console.log(`Admin SMS to ${phone}:`, smsResult?.status || "unknown");

          await supabaseAdmin.from("sms_logs").insert({
            phone,
            message,
            template_key: "admin_new_order",
            status: smsResult?.status === "success" ? "sent" : "failed",
            provider_response: smsResult,
            order_id,
          });
        } catch (smsErr) {
          console.error(`Failed to send admin SMS to ${phone}:`, smsErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notification }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
