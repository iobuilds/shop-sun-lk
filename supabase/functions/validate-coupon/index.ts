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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { code, subtotal, cart_items } = await req.json();
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

    // Check start date
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
      throw new Error("This coupon is not yet active");
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw new Error("This coupon has expired");
    }

    // Check max uses (total)
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      throw new Error("This coupon has reached its usage limit");
    }

    // Check per-user limit
    if (coupon.per_user_limit) {
      const { count } = await supabaseAdmin
        .from("coupon_usage")
        .select("*", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", user.id);
      if ((count || 0) >= coupon.per_user_limit) {
        throw new Error("You have already used this coupon the maximum number of times");
      }
    }

    // Check private coupon assignment
    if (coupon.coupon_type === "private") {
      // Get user's phone from profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();

      const userPhone = profile?.phone?.replace(/\s/g, "") || "";

      const { data: assignment } = await supabaseAdmin
        .from("coupon_assignments")
        .select("id, used")
        .eq("coupon_id", coupon.id)
        .or(`phone.eq.${userPhone},user_id.eq.${user.id}`)
        .maybeSingle();

      if (!assignment) {
        throw new Error("This coupon is not available for your account");
      }
    }

    // Check minimum order
    if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
      throw new Error(`Minimum order of Rs. ${coupon.min_order_amount.toLocaleString()} required`);
    }

    // Category scope validation
    let eligible_subtotal = subtotal;
    let category_message: string | null = null;
    const validCategoryIds: string[] = coupon.valid_category_ids || [];

    if (coupon.category_scope !== "all" && validCategoryIds.length > 0 && cart_items?.length) {
      // Fetch product categories
      const productIds = cart_items.map((i: any) => i.id);
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, category_id, price")
        .in("id", productIds);

      if (products) {
        const productMap = new Map(products.map((p: any) => [p.id, p]));
        let eligibleTotal = 0;
        let hasEligible = false;

        for (const item of cart_items) {
          const product = productMap.get(item.id);
          if (!product) continue;
          const catId = product.category_id;

          let isEligible = false;
          if (coupon.category_scope === "selected") {
            isEligible = validCategoryIds.includes(catId);
          } else if (coupon.category_scope === "excluded") {
            isEligible = !validCategoryIds.includes(catId);
          }

          if (isEligible) {
            hasEligible = true;
            eligibleTotal += product.price * (item.quantity || 1);
          }
        }

        if (!hasEligible) {
          // Get category names for error message
          const { data: cats } = await supabaseAdmin
            .from("categories")
            .select("name")
            .in("id", validCategoryIds);
          const catNames = cats?.map((c: any) => c.name).join(", ") || "selected categories";

          if (coupon.category_scope === "selected") {
            throw new Error(`This coupon is valid only for: ${catNames}`);
          } else {
            throw new Error("This coupon does not apply to the items in your cart");
          }
        }

        eligible_subtotal = eligibleTotal;
        if (eligibleTotal < subtotal) {
          category_message = "Coupon applied to eligible items only";
        }
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = Math.round(eligible_subtotal * (coupon.discount_value / 100));
      // Apply max discount cap
      if (coupon.max_discount_cap && discount > coupon.max_discount_cap) {
        discount = coupon.max_discount_cap;
      }
    } else {
      discount = Math.min(coupon.discount_value, eligible_subtotal);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        code: coupon.code,
        discount,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        description: coupon.description,
        category_message,
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
