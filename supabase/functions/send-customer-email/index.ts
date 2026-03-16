import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function renderTemplate(template: string, data: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(data)) {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), val ?? "");
  }
  return out.replace(/{{[\w_]+}}/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractBodyContent(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .trim();
}

function buildHtmlFromText(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333">${escapeHtml(line)}</p>`
    )
    .join("");
}

function buildInboxFriendlyHtml(subject: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;font-family:Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f7fb;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <div class="c" style="max-width:640px;margin:0 auto;background-color:#ffffff;border:1px solid #e6e8ef;border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(15,23,42,0.08);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:28px 32px 18px;background:linear-gradient(180deg,#eef2ff 0%,#ffffff 100%);border-bottom:1px solid #e6e8ef;">
                <p style="margin:0 0 10px;font-size:11px;line-height:1.4;letter-spacing:0.24em;text-transform:uppercase;color:#667085;">NanoCircuit.lk</p>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#101828;font-weight:700;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${bodyContent}</td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e6e8ef;text-align:center;font-size:12px;line-height:1.6;color:#667085;">
                NanoCircuit.lk · Trusted electronics parts, PCB services, and order updates.
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function deliverViaSmtp(to: string[], subject: string, html: string, text: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-smtp-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ to, subject, html, text }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || "Failed to send email");
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { to, template_key, template_data } = await req.json();
    if (!to || !template_key) throw new Error("'to' and 'template_key' are required");

    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("template_key", template_key)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
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

    const recipients = Array.isArray(to) ? to : [to];
    const subject = renderTemplate(template.subject, data).trim();
    const textBody = (template.text_body ? renderTemplate(template.text_body, data) : subject).trim();
    const renderedHtml = template.html_body ? renderTemplate(template.html_body, data).trim() : "";
    const bodyContent = renderedHtml ? extractBodyContent(renderedHtml) : buildHtmlFromText(textBody);
    const htmlBody = buildInboxFriendlyHtml(subject, bodyContent || buildHtmlFromText(textBody));

    const result = await deliverViaSmtp(recipients, subject, htmlBody, textBody);

    console.log(`Email [${template_key}] sent via send-smtp-email: ${result?.messageId || "ok"}`);

    return new Response(
      JSON.stringify({ success: true, template_key, recipients, messageId: result?.messageId }),
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
