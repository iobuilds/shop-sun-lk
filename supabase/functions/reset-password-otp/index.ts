import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action, identifier, phone, otp, newPassword } = await req.json();

    // ─── ACTION: lookup ──────────────────────────────────────────────────────
    // Given email OR phone → return masked phone to send OTP to
    if (action === "lookup") {
      if (!identifier) throw new Error("identifier is required");

      const isPhone = /^\d/.test(identifier.replace(/^\+/, ""));
      let profile: any = null;

      if (isPhone) {
        // Direct phone lookup
        let p = identifier.replace(/\D/g, "");
        if (p.startsWith("0")) p = "94" + p.slice(1);
        if (!p.startsWith("94")) p = "94" + p;

        const { data } = await supabaseAdmin
          .from("profiles")
          .select("phone, user_id")
          .eq("phone", p)
          .maybeSingle();
        profile = data;
      } else {
        // Email lookup — find user then their profile
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const user = users?.users?.find(
          (u) => u.email?.toLowerCase() === identifier.toLowerCase()
        );
        if (user) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("phone, user_id")
            .eq("user_id", user.id)
            .maybeSingle();
          profile = data;
        }
      }

      if (!profile?.phone) {
        return new Response(
          JSON.stringify({ success: false, error: "No account found with this email or phone number." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Return masked phone (last 4 digits visible)
      const rawPhone = profile.phone;
      const masked = rawPhone.slice(0, -4).replace(/\d/g, "*") + rawPhone.slice(-4);

      return new Response(
        JSON.stringify({ success: true, phone: rawPhone, maskedPhone: masked }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: send_otp ───────────────────────────────────────────────────
    if (action === "send_otp") {
      if (!phone) throw new Error("phone is required");

      // Generate 5-digit OTP
      const otpCode = String(Math.floor(10000 + Math.random() * 90000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      // Invalidate old OTPs for this phone
      await supabaseAdmin
        .from("otp_verifications")
        .update({ verified: true })
        .eq("phone", phone)
        .eq("verified", false);

      // Insert new OTP
      await supabaseAdmin.from("otp_verifications").insert({
        phone,
        otp_code: otpCode,
        expires_at: expiresAt,
      });

      // Send via SMS
      const message = `Your NanoCircuit password reset OTP is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;

      const TEXTLK_API_KEY = Deno.env.get("TEXTLK_API_KEY");
      const TEXTLK_SENDER_ID = Deno.env.get("TEXTLK_SENDER_ID") || "NanoCircuit";

      if (TEXTLK_API_KEY) {
        const smsRes = await fetch("https://api.text.lk/api/v3/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            recipient: phone,
            sender_id: TEXTLK_SENDER_ID,
            message,
            api_key: TEXTLK_API_KEY,
          }),
        });
        const smsData = await smsRes.json();
        console.log("SMS response:", smsData);
      }

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: verify_and_reset ────────────────────────────────────────────
    if (action === "verify_and_reset") {
      if (!phone || !otp || !newPassword) {
        throw new Error("phone, otp, and newPassword are required");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Verify OTP (reuse existing verify-otp logic inline)
      const { data: otpRecord, error: otpErr } = await supabaseAdmin
        .from("otp_verifications")
        .select("*")
        .eq("phone", phone)
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (otpErr || !otpRecord) {
        return new Response(
          JSON.stringify({ success: false, error: "No OTP found. Please request a new one." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      if (otpRecord.locked_until && new Date(otpRecord.locked_until) > new Date()) {
        const remaining = Math.ceil((new Date(otpRecord.locked_until).getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ success: false, error: `Too many attempts. Try again in ${remaining} minutes.`, locked: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "OTP has expired. Please request a new one.", expired: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      if (String(otpRecord.otp_code) !== String(otp)) {
        const newAttempts = otpRecord.attempts + 1;
        const updateData: any = { attempts: newAttempts };
        if (newAttempts >= 5) {
          updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        await supabaseAdmin.from("otp_verifications").update(updateData).eq("id", otpRecord.id);
        const remaining = 5 - newAttempts;
        return new Response(
          JSON.stringify({
            success: false,
            error: remaining > 0 ? `Invalid OTP. ${remaining} attempt(s) remaining.` : "Too many failed attempts. Locked for 15 minutes.",
            locked: remaining <= 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // OTP correct — mark verified
      await supabaseAdmin.from("otp_verifications").update({ verified: true }).eq("id", otpRecord.id);

      // Find the user by phone
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile?.user_id) {
        return new Response(
          JSON.stringify({ success: false, error: "User not found." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Update password using admin API
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, message: "Password reset successfully!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("reset-password-otp error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
