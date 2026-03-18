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

      const trimmed = identifier.trim();
      // Detect phone: starts with digit, +, or 0
      const isPhone = /^[+0]?\d/.test(trimmed) && !trimmed.includes("@");
      let profile: any = null;

      if (isPhone) {
        // Normalise phone — try multiple formats stored in DB
        let digits = trimmed.replace(/\D/g, "");
        // Build candidate formats
        const candidates: string[] = [];
        if (digits.startsWith("94") && digits.length === 11) {
          candidates.push(digits);               // 94XXXXXXXXX
          candidates.push("0" + digits.slice(2)); // 07XXXXXXXX
        } else if (digits.startsWith("0") && digits.length === 10) {
          candidates.push(digits);               // 07XXXXXXXX
          candidates.push("94" + digits.slice(1)); // 94XXXXXXXXX
        } else {
          // 9-digit bare number
          candidates.push(digits);
          candidates.push("94" + digits);
          candidates.push("0" + digits);
        }

        for (const candidate of candidates) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("phone, user_id")
            .eq("phone", candidate)
            .maybeSingle();
          if (data?.phone) { profile = data; break; }
        }
      } else {
        // Email lookup — paginate through all auth users to find matching email
        let page = 1;
        const perPage = 1000;
        let found = false;
        while (!found) {
          const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          const users = usersPage?.users ?? [];
          const user = users.find(
            (u: any) => u.email?.toLowerCase() === trimmed.toLowerCase()
          );
          if (user) {
            const { data } = await supabaseAdmin
              .from("profiles")
              .select("phone, user_id")
              .eq("user_id", user.id)
              .maybeSingle();
            profile = data;
            found = true;
          }
          // If returned fewer than perPage, we've reached the end
          if (users.length < perPage) break;
          page++;
        }
      }

      // Profile not found at all
      if (!profile) {
        return new Response(
          JSON.stringify({ success: false, error: "No account found with this email or phone number." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Profile found but no phone linked
      if (!profile.phone) {
        return new Response(
          JSON.stringify({ success: false, error: "No mobile number linked to this account. Please contact the admin." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return masked phone (last 4 digits visible)
      const rawPhone = profile.phone;
      const masked = rawPhone.slice(0, -4).replace(/\d/g, "*") + rawPhone.slice(-4);

      return new Response(
        JSON.stringify({ success: true, method: "sms", phone: rawPhone, maskedPhone: masked }),
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
    // OTP was already verified in the previous step (verify-otp edge fn marked it verified=true).
    // We look up the most recent verified OTP for this phone that was verified within the last 15 minutes.
    if (action === "verify_and_reset") {
      if (!phone || !newPassword) {
        throw new Error("phone and newPassword are required");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Check there is a recently verified OTP for this phone (within last 15 min)
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: otpRecord, error: otpErr } = await supabaseAdmin
        .from("otp_verifications")
        .select("*")
        .eq("phone", phone)
        .eq("verified", true)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (otpErr || !otpRecord) {
        return new Response(
          JSON.stringify({ success: false, error: "OTP session expired. Please start over." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

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
