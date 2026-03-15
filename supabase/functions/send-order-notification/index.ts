import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function buildOrderEmailHtml(order: any, customerName: string, shortOrderId: string, itemsHtml: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 4px 0 0; opacity: 0.7; font-size: 13px; }
    .body { padding: 24px 32px; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .info-item { background: #f9f9f9; border-radius: 6px; padding: 12px 16px; }
    .info-item .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item .value { font-size: 15px; font-weight: bold; color: #1a1a2e; margin-top: 4px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .items-table th { background: #f0f0f0; padding: 10px 12px; text-align: left; font-size: 12px; color: #555; }
    .items-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .total-row td { font-weight: bold; font-size: 15px; background: #f9f9f9; }
    .cta { text-align: center; margin: 24px 0 8px; }
    .cta a { background: #1a1a2e; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: bold; }
    .footer { background: #f0f0f0; padding: 16px 32px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛒 New Order Received</h1>
      <p>NanoCircuit.lk Admin Notification</p>
    </div>
    <div class="body">
      <div class="badge">Order #${shortOrderId}</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Customer</div>
          <div class="value">${customerName}</div>
        </div>
        <div class="info-item">
          <div class="label">Payment Method</div>
          <div class="value">${order.payment_method || "N/A"}</div>
        </div>
        <div class="info-item">
          <div class="label">Payment Status</div>
          <div class="value">${order.payment_status || "N/A"}</div>
        </div>
        <div class="info-item">
          <div class="label">Order Total</div>
          <div class="value">Rs. ${order.total?.toLocaleString() || "0"}</div>
        </div>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr class="total-row">
            <td colspan="2">Total</td>
            <td>Rs. ${order.total?.toLocaleString() || "0"}</td>
          </tr>
        </tbody>
      </table>
      <div class="cta">
        <a href="https://shop-sun-lk.lovable.app/admin">View in Admin Dashboard</a>
      </div>
    </div>
    <div class="footer">NanoCircuit.lk &mdash; This is an automated admin notification.</div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
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
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        if (user?.email) adminEmails.push(user.email);

        const { data: adminProfile } = await supabaseAdmin
          .from("profiles")
          .select("phone")
          .eq("user_id", role.user_id)
          .maybeSingle();
        if (adminProfile?.phone) adminPhones.push(adminProfile.phone);
      }
    }

    // Always include the site inbox
    const siteInbox = "info@nanocircuit.lk";
    if (!adminEmails.includes(siteInbox)) {
      adminEmails.push(siteInbox);
    }

    const shortOrderId = order.id.slice(0, 8).toUpperCase();
    const customerName = customerProfile?.full_name || user_email || "Customer";

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

    // Send email to admins if new order
    if (type === "new_order" && adminEmails.length > 0) {
      const itemsHtml = (order.order_items || [])
        .map((i: any) => `<tr><td>${i.products?.name || "Item"}</td><td>${i.quantity}</td><td>Rs. ${i.total_price?.toLocaleString()}</td></tr>`)
        .join("");

      const emailHtml = buildOrderEmailHtml(order, customerName, shortOrderId, itemsHtml);

      try {
        // Call the SMTP edge function
        const emailRes = await fetch(
          `${SUPABASE_URL}/functions/v1/send-smtp-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              to: adminEmails,
              subject: `🛒 New Order #${shortOrderId} - Rs. ${order.total?.toLocaleString()}`,
              html: emailHtml,
              text: `New Order #${shortOrderId}\nCustomer: ${customerName}\nTotal: Rs. ${order.total?.toLocaleString()}\nPayment: ${order.payment_method}`,
            }),
          }
        );
        const emailResult = await emailRes.json();
        console.log("Admin email result:", emailResult);
      } catch (emailErr) {
        console.error("Failed to send admin email:", emailErr);
      }
    }

    // Send SMS to admins if new order and API key exists
    const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
    if (type === "new_order" && TEXTLK_API_KEY && adminPhones.length > 0) {
      const { data: template } = await supabaseAdmin
        .from("sms_templates")
        .select("*")
        .eq("template_key", "admin_new_order")
        .eq("is_active", true)
        .maybeSingle();

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
              sender_id: Deno.env.get("TEXTLK_SENDER_ID") ?? "NanoCircuit",
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
