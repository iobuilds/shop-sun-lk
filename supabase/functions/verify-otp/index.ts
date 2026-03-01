import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { phone, otp } = await req.json();
    if (!phone || !otp) throw new Error("Phone and OTP are required");

    // Get the latest OTP for this phone
    const { data: otpRecord, error } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", phone)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !otpRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "No OTP found. Please request a new one." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check lockout
    if (otpRecord.locked_until && new Date(otpRecord.locked_until) > new Date()) {
      const remainingMins = Math.ceil((new Date(otpRecord.locked_until).getTime() - Date.now()) / 60000);
      return new Response(
        JSON.stringify({ success: false, error: `Too many attempts. Try again in ${remainingMins} minutes.`, locked: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP has expired. Please request a new one.", expired: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check OTP
    if (String(otpRecord.otp_code) !== String(otp)) {
      const newAttempts = otpRecord.attempts + 1;
      const updateData: Record<string, unknown> = { attempts: newAttempts };

      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }

      await supabaseAdmin
        .from("otp_verifications")
        .update(updateData)
        .eq("id", otpRecord.id);

      const remaining = MAX_ATTEMPTS - newAttempts;
      return new Response(
        JSON.stringify({
          success: false,
          error: remaining > 0
            ? `Invalid OTP. ${remaining} attempt(s) remaining.`
            : `Too many failed attempts. Locked for ${LOCKOUT_MINUTES} minutes.`,
          locked: remaining <= 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // OTP is correct — mark verified
    await supabaseAdmin
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    return new Response(
      JSON.stringify({ success: true, message: "Phone verified successfully!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("OTP verification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
