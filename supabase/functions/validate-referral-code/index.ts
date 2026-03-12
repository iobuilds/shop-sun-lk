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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { code, subtotal } = await req.json();
    if (!code) throw new Error("No code provided");

    const { data: referral, error: refError } = await supabaseAdmin
      .from("referral_codes")
      .select("*")
      .eq("code", code.toUpperCase().trim())
      .eq("is_active", true)
      .maybeSingle();

    if (refError) throw refError;
    if (!referral) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid referral code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Check expiry
    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "Referral code has expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Check max uses
    if (referral.max_uses && referral.used_count >= referral.max_uses) {
      return new Response(JSON.stringify({ valid: false, error: "Referral code usage limit reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Check min order amount
    if (referral.min_order_amount && subtotal < referral.min_order_amount) {
      return new Response(JSON.stringify({ valid: false, error: `Minimum order Rs. ${referral.min_order_amount} required for this referral code` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Check per user limit
    if (referral.per_user_limit) {
      const { count } = await supabaseAdmin
        .from("referral_code_usage")
        .select("*", { count: "exact", head: true })
        .eq("referral_code_id", referral.id)
        .eq("user_id", user.id);
      if ((count || 0) >= referral.per_user_limit) {
        return new Response(JSON.stringify({ valid: false, error: "You have already used this referral code the maximum number of times" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }
    }

    // Calculate discount
    let discount = 0;
    if (referral.discount_type === "percentage") {
      discount = Math.round(subtotal * (referral.discount_value / 100));
      if (referral.max_discount_cap && discount > referral.max_discount_cap) {
        discount = referral.max_discount_cap;
      }
    } else {
      discount = Math.min(referral.discount_value, subtotal);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        code: referral.code,
        name: referral.name,
        description: referral.description,
        discount,
        discount_type: referral.discount_type,
        discount_value: referral.discount_value,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
