import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { ImapFlow } from "npm:imapflow@1.0.162";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const host = Deno.env.get("SMTP_HOST") ?? "";
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
  const smtpUser = Deno.env.get("SMTP_USERNAME") ?? "";
  // Try full email first, fall back to username only
  const user = fromEmail || smtpUser;
  const pass = Deno.env.get("SMTP_PASSWORD") ?? "";

  if (!host || !user || !pass) {
    return new Response(
      JSON.stringify({ error: "IMAP configuration missing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  // Read body safely
  let body: any = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    }
  } catch (_) {}

  const action = body?.action || "list";
  const uid = body?.uid ? String(body.uid) : null;

  const client = new ImapFlow({
    host,
    port: 143,
    secure: false,
    auth: { user, pass },
    logger: false,
    disableAutoIdle: true,
  });

  try {
    await client.connect();

    if (action === "body" && uid) {
      // ── Fetch single email body ──────────────────────────────────────────
      const lock = await client.getMailboxLock("INBOX");
      let emailData: any = null;
      try {
        for await (const msg of client.fetch(uid, {
          envelope: true,
          bodyParts: ["TEXT", "1", "1.1", "1.2", "HTML", "2"],
          flags: true,
          uid: true,
        }, { uid: true })) {
          // Try to get HTML body first, then plain text
          const htmlPart = msg.bodyParts?.get("html") || msg.bodyParts?.get("2");
          const textPart = msg.bodyParts?.get("text")
            || msg.bodyParts?.get("1")
            || msg.bodyParts?.get("1.1")
            || msg.bodyParts?.get("1.2");

          const isHtml = !!htmlPart;
          const rawBody = htmlPart || textPart;
          const bodyContent = rawBody ? new TextDecoder().decode(rawBody) : "(empty message)";

          emailData = {
            uid: msg.uid,
            subject: msg.envelope?.subject || "(no subject)",
            from: msg.envelope?.from?.[0]
              ? `${msg.envelope.from[0].name || ""} <${msg.envelope.from[0].address || ""}>`.trim()
              : "Unknown",
            to: msg.envelope?.to?.map((t: any) => t.address).join(", ") || "",
            date: msg.envelope?.date?.toISOString() || new Date().toISOString(),
            body: bodyContent,
            isHtml,
          };

          // Mark as read
          try {
            await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          } catch (_) {}
        }
      } finally {
        lock.release();
      }
      await client.logout();
      return new Response(JSON.stringify({ success: true, email: emailData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── List emails ──────────────────────────────────────────────────────────
    const lock = await client.getMailboxLock("INBOX");
    const emails: any[] = [];
    let totalCount = 0;
    let unseenCount = 0;

    try {
      const status = await client.status("INBOX", { messages: true, unseen: true });
      totalCount = status.messages || 0;
      unseenCount = status.unseen || 0;

      if (totalCount > 0) {
        const start = Math.max(1, totalCount - 49);
        const range = start === totalCount ? `${totalCount}` : `${start}:${totalCount}`;

        for await (const msg of client.fetch(range, {
          envelope: true,
          flags: true,
          internalDate: true,
          uid: true,
          size: true,
        })) {
          emails.push({
            uid: msg.uid,
            seq: msg.seq,
            subject: msg.envelope?.subject || "(no subject)",
            from: msg.envelope?.from?.[0]
              ? `${msg.envelope.from[0].name || ""} <${msg.envelope.from[0].address || ""}>`.trim()
              : "Unknown",
            fromEmail: msg.envelope?.from?.[0]?.address || "",
            to: msg.envelope?.to?.[0]?.address || "",
            date: msg.internalDate?.toISOString() || new Date().toISOString(),
            isRead: msg.flags?.has("\\Seen") || false,
            size: msg.size || 0,
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return new Response(
      JSON.stringify({ success: true, emails: emails.reverse(), total: totalCount, unseen: unseenCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("IMAP error:", error);
    try { await client.logout(); } catch (_) {}
    return new Response(
      JSON.stringify({ error: error.message || "IMAP connection failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
