import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Port 465 = implicit TLS; port 587/25 = STARTTLS (tls:false, starttls handled by denomailer)
    const useTLS = SMTP_PORT === 465;

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: useTLS,
        auth: { username: SMTP_USERNAME, password: SMTP_PASSWORD },
      },
    });

    await client.send({
      from: `NanoCircuit.lk <${SMTP_FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      content: text || "Please view this email in an HTML-compatible email client.",
      html: html || undefined,
    });

    await client.close();

    console.log(`✅ Email sent to ${Array.isArray(to) ? to.join(", ") : to}: ${subject}`);

    return new Response(
      JSON.stringify({ success: true }),
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
