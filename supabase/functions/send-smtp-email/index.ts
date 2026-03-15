import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import * as nodemailer from "npm:nodemailer@6.9.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo.png";

const LOGO_HEADER = `<div style="background:#1a1a2e;padding:20px 32px 0;text-align:center">
  <img src="${LOGO_URL}" alt="NanoCircuit" style="max-height:44px;width:auto;filter:brightness(0) invert(1)">
</div>`;

/** Injects logo above the first .h div if not already present */
function injectLogo(html: string): string {
  if (html.includes(LOGO_URL)) return html; // already has logo
  return html.replace('<div class="c">', `<div class="c">${LOGO_HEADER}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SMTP_HOST = Deno.env.get("SMTP_HOST");
  const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
  const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
  const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL") || "info@nanocircuit.lk";

  if (!SMTP_HOST || !SMTP_USERNAME || !SMTP_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "SMTP configuration missing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: "to, subject, and html/text are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USERNAME, pass: SMTP_PASSWORD },
    });

    const htmlWithLogo = html ? injectLogo(html) : undefined;

    const info = await transporter.sendMail({
      from: `NanoCircuit.lk <${SMTP_FROM_EMAIL}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: text || "Please view this email in an HTML-compatible email client.",
      html: htmlWithLogo,
      headers: {
        // Anti-spam headers
        "X-Mailer": "NanoCircuit Mailer",
        "X-Entity-Ref-ID": `nanocircuit-${Date.now()}`,
        "Precedence": "transactional",
        "Auto-Submitted": "auto-generated",
      },
    });

    console.log(`✅ Email sent: ${info.messageId} to ${Array.isArray(to) ? to.join(", ") : to}`);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("SMTP send error:", error);
    return new Response(
      JSON.stringify({ error: String(error?.message ?? error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
