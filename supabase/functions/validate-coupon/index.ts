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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { code, subtotal } = await req.json();
    if (!code) throw new Error("Coupon code is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("code", code.toUpperCase().trim())
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!coupon) throw new Error("Invalid coupon code");

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw new Error("This coupon has expired");
    }

    // Check max uses
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      throw new Error("This coupon has reached its usage limit");
    }

    // Check minimum order
    if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
      throw new Error(`Minimum order of Rs. ${coupon.min_order_amount.toLocaleString()} required`);
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = Math.round(subtotal * (coupon.discount_value / 100));
    } else {
      discount = Math.min(coupon.discount_value, subtotal);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        code: coupon.code,
        discount,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        description: coupon.description,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
