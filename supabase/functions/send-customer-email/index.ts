import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import * as nodemailer from "npm:nodemailer@6.9.9";

const LOGO_URL = "https://shop-sun-lk.lovable.app/site-logo.png";

function injectLogo(html: string): string {
  if (html.includes(LOGO_URL) || html.includes("site-logo")) return html;
  return html.replace('<div class="c">', `<div class="c"><div style="background:#1a1a2e;padding:20px 32px 0;text-align:center"><img src="${LOGO_URL}" alt="NanoCircuit" style="max-height:44px;width:auto;filter:brightness(0) invert(1)"></div>`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function renderTemplate(template: string, data: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(data)) {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), val ?? "");
  }
  out = out.replace(/{{[\w_]+}}/g, "");
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SMTP_HOST = Deno.env.get("SMTP_HOST");
  const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
  const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
  const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL") || "info@nanocircuit.lk";

  if (!SMTP_HOST || !SMTP_USERNAME || !SMTP_PASSWORD) {
    return new Response(JSON.stringify({ error: "SMTP not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { to, template_key, template_data } = await req.json();
    if (!to || !template_key) throw new Error("'to' and 'template_key' are required");

    // Fetch template, check is_active
    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("template_key", template_key)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      console.log(`Email template '${template_key}' not found or disabled — skipping`);
      return new Response(
        JSON.stringify({ success: false, message: `Template '${template_key}' disabled or not found` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const data: Record<string, string> = {};
    if (template_data) {
      for (const [k, v] of Object.entries(template_data)) {
        data[k] = String(v ?? "");
      }
    }

    const subject = renderTemplate(template.subject, data);
    const htmlBody = renderTemplate(template.html_body, data);
    const textBody = template.text_body ? renderTemplate(template.text_body, data) : subject;
    const recipients = Array.isArray(to) ? to : [to];

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USERNAME, pass: SMTP_PASSWORD },
    });

    const info = await transporter.sendMail({
      from: `NanoCircuit.lk <${SMTP_FROM_EMAIL}>`,
      to: recipients.join(", "),
      subject,
      text: textBody,
      html: injectLogo(htmlBody),
      headers: {
        "X-Mailer": "NanoCircuit Mailer",
        "X-Entity-Ref-ID": `nanocircuit-${Date.now()}`,
        "Precedence": "transactional",
        "Auto-Submitted": "auto-generated",
      },
    });

    console.log(`✅ Email [${template_key}] sent: ${info.messageId}`);

    return new Response(
      JSON.stringify({ success: true, template_key, recipients, messageId: info.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("send-customer-email error:", error);
    return new Response(
      JSON.stringify({ error: String(error?.message ?? error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
