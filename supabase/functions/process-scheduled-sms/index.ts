import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXTLK_API_URL = "https://app.text.lk/api/http/sms/send";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
  if (!TEXTLK_API_KEY) {
    return new Response(JSON.stringify({ error: "TEXTLK_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Fetch all scheduled campaigns that are due
    const { data: dueCampaigns, error: fetchErr } = await supabaseAdmin
      .from("sms_scheduled_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(JSON.stringify({ message: "No campaigns due", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const SENDER_ID = Deno.env.get("TEXTLK_SENDER_ID") ?? "NanoCircuit";
    let processed = 0;

    for (const campaign of dueCampaigns) {
      const phones: string[] = campaign.phones as string[];
      if (!phones || phones.length === 0) continue;

      const recipient = phones.join(",");

      try {
        const smsResponse = await fetch(TEXTLK_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TEXTLK_API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            recipient,
            sender_id: SENDER_ID,
            type: "plain",
            message: campaign.message,
          }),
        });

        const smsResult = await smsResponse.json();
        const smsStatus = smsResult.status === "success" ? "sent" : "failed";

        // Update campaign status
        await supabaseAdmin
          .from("sms_scheduled_campaigns")
          .update({
            status: smsStatus,
            sent_at: new Date().toISOString(),
            provider_response: smsResult,
          })
          .eq("id", campaign.id);

        // Insert sms_logs
        const logsToInsert = phones.map((phone: string) => ({
          phone,
          message: campaign.message,
          template_key: "campaign",
          status: smsStatus,
          provider_response: smsResult,
        }));
        await supabaseAdmin.from("sms_logs").insert(logsToInsert);

        processed++;
      } catch (err) {
        console.error(`Failed to send campaign ${campaign.id}:`, err);
        await supabaseAdmin
          .from("sms_scheduled_campaigns")
          .update({ status: "failed" })
          .eq("id", campaign.id);
      }
    }

    return new Response(JSON.stringify({ message: "Done", processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    console.error("process-scheduled-sms error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
