import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find admin messages older than 5 minutes that haven't been read and no reminder sent
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: unrepliedMessages, error: fetchError } = await supabase
      .from("conversation_messages")
      .select("id, conversation_id, created_at, conversations!inner(user_id, subject)")
      .eq("sender_type", "admin")
      .eq("is_read", false)
      .eq("reminder_sent", false)
      .lt("created_at", fiveMinAgo);

    if (fetchError) throw fetchError;

    if (!unrepliedMessages || unrepliedMessages.length === 0) {
      return new Response(JSON.stringify({ success: true, reminders_sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let remindersSent = 0;

    for (const msg of unrepliedMessages) {
      const convo = (msg as any).conversations;
      if (!convo?.user_id) continue;

      // Check if user has replied after this admin message
      const { data: userReplies } = await supabase
        .from("conversation_messages")
        .select("id")
        .eq("conversation_id", msg.conversation_id)
        .eq("sender_type", "user")
        .gt("created_at", msg.created_at)
        .limit(1);

      if (userReplies && userReplies.length > 0) {
        // User replied, mark reminder as not needed
        await supabase
          .from("conversation_messages")
          .update({ reminder_sent: true })
          .eq("id", msg.id);
        continue;
      }

      // Get user's phone from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, full_name")
        .eq("user_id", convo.user_id)
        .maybeSingle();

      if (!profile?.phone) {
        // No phone, mark as sent to avoid retrying
        await supabase
          .from("conversation_messages")
          .update({ reminder_sent: true })
          .eq("id", msg.id);
        continue;
      }

      // Send SMS reminder
      const smsMessage = `TechLK: You have a new message from support. Please check your dashboard messages.`;
      
      const textlkApiKey = Deno.env.get("TEXTLK_API_KEY");
      if (textlkApiKey) {
        try {
          const smsResponse = await fetch("https://app.text.lk/api/v3/sms/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${textlkApiKey}`,
            },
            body: JSON.stringify({
              recipient: profile.phone,
              sender_id: "IO Builds",
              message: smsMessage,
            }),
          });
          const smsResult = await smsResponse.json();

          // Log in sms_logs
          await supabase.from("sms_logs").insert({
            phone: profile.phone,
            message: smsMessage,
            status: smsResult?.status === "success" ? "sent" : "failed",
            template_key: "message_reminder",
            user_id: convo.user_id,
            provider_response: smsResult,
          });
        } catch (smsErr) {
          console.error("SMS send error:", smsErr);
        }
      }

      // Mark reminder as sent
      await supabase
        .from("conversation_messages")
        .update({ reminder_sent: true })
        .eq("id", msg.id);

      remindersSent++;
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: remindersSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
