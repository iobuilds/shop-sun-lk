import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

async function sendViaSMTP(opts: {
  host: string; port: number; username: string; password: string;
  from: string; to: string[]; subject: string; html: string; text: string;
}) {
  // Use Deno's built-in fetch to call the send-smtp-email function internally,
  // or send directly using raw SMTP via nodemailer-style approach.
  // We'll use the smtp-client approach with correct denomailer API.
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
  const client = new SMTPClient({
    connection: {
      hostname: opts.host,
      port: opts.port,
      tls: opts.port === 465,
      auth: { username: opts.username, password: opts.password },
    },
  });

  await client.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    content: opts.text,
    html: opts.html,
  });

  await client.close();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    await sendViaSMTP({
      host: SMTP_HOST,
      port: SMTP_PORT,
      username: SMTP_USERNAME,
      password: SMTP_PASSWORD,
      from: `NanoCircuit.lk <${SMTP_FROM_EMAIL}>`,
      to: recipients,
      subject,
      html: htmlBody,
      text: textBody,
    });

    console.log(`✅ Email [${template_key}] sent to ${recipients.join(", ")}`);

    return new Response(
      JSON.stringify({ success: true, template_key, recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("send-customer-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Placeholder replacement ───────────────────────────────────────────────────
function renderTemplate(template: string, data: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(data)) {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), val ?? "");
  }
  // Clear any unreplaced placeholders
  out = out.replace(/{{[\w_]+}}/g, "");
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // ── 1. Fetch template, check is_active ────────────────────────────────────
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

    // ── 2. Render subject + body ──────────────────────────────────────────────
    const data: Record<string, string> = {};
    if (template_data) {
      for (const [k, v] of Object.entries(template_data)) {
        data[k] = String(v ?? "");
      }
    }

    const subject = renderTemplate(template.subject, data);
    const htmlBody = renderTemplate(template.html_body, data);
    const textBody = template.text_body ? renderTemplate(template.text_body, data) : subject;

    // ── 3. Send via SMTP ──────────────────────────────────────────────────────
    const recipients = Array.isArray(to) ? to : [to];

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      username: SMTP_USERNAME,
      password: SMTP_PASSWORD,
    });

    await client.send({
      from: `NanoCircuit.lk <${SMTP_FROM_EMAIL}>`,
      to: recipients,
      subject,
      content: textBody,
      html: htmlBody,
    });

    await client.close();

    console.log(`✅ Email [${template_key}] sent to ${recipients.join(", ")}`);

    return new Response(
      JSON.stringify({ success: true, template_key, recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("send-customer-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
