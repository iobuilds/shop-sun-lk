import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MD5 implementation for Deno
async function md5(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { items, shipping_address, coupon_code, referral_code, wallet_amount } = await req.json();

    if (!items || items.length === 0) throw new Error("Cart is empty");

    const MERCHANT_ID = Deno.env.get("PAYHERE_MERCHANT_ID") ?? "";
    const MERCHANT_SECRET = Deno.env.get("PAYHERE_MERCHANT_SECRET") ?? "";

    if (!MERCHANT_ID || !MERCHANT_SECRET) throw new Error("PayHere not configured");

    // Fetch products to compute totals
    const productIds = items.map((i: any) => i.id);
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock_quantity")
      .in("id", productIds);
    if (prodError) throw prodError;

    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) throw new Error(`Product not found`);
      if ((product.stock_quantity || 0) < item.quantity) throw new Error(`${product.name} is out of stock`);
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += productMap.get(item.id)!.price * item.quantity;
    }

    // Validate coupon discount
    let discount_amount = 0;
    if (coupon_code) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons").select("*").eq("code", coupon_code.toUpperCase().trim()).eq("is_active", true).maybeSingle();
      if (coupon) {
        if (coupon.discount_type === "percentage") {
          discount_amount = Math.round(subtotal * (coupon.discount_value / 100));
          if (coupon.max_discount_cap && discount_amount > coupon.max_discount_cap) discount_amount = coupon.max_discount_cap;
        } else {
          discount_amount = Math.min(coupon.discount_value, subtotal);
        }
      }
    }

    // Validate referral discount
    let referral_discount = 0;
    if (referral_code) {
      const { data: referral } = await supabaseAdmin
        .from("referral_codes").select("*").eq("code", referral_code.toUpperCase().trim()).eq("is_active", true).maybeSingle();
      if (referral && referral.code_purpose !== "reference") {
        if (referral.discount_type === "percentage") {
          referral_discount = Math.round(subtotal * (referral.discount_value / 100));
          if (referral.max_discount_cap && referral_discount > referral.max_discount_cap) referral_discount = referral.max_discount_cap;
        } else {
          referral_discount = Math.min(referral.discount_value, subtotal);
        }
      }
    }

    // Fetch shipping settings
    const { data: shippingSettingsRow } = await supabaseAdmin
      .from("site_settings").select("value").eq("key", "shipping_settings").maybeSingle();
    const shipSettings = shippingSettingsRow?.value as any;
    const localFee = shipSettings?.local_fee ?? 350;
    const overseasFee = shipSettings?.overseas_fee ?? 1500;
    const freeThreshold = shipSettings?.free_shipping_threshold ?? 5000;

    const { data: cartProductSpecs } = await supabaseAdmin
      .from("products").select("id, specifications").in("id", productIds);
    const hasOverseas = (cartProductSpecs || []).some((p: any) => p.specifications?._shipping_type === "overseas");
    let shipping_fee = hasOverseas ? overseasFee : subtotal >= freeThreshold ? 0 : localFee;

    // Wallet deduction
    let wallet_deduction = 0;
    if (wallet_amount && wallet_amount > 0) {
      const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
      if (wallet) wallet_deduction = Math.min(wallet_amount, wallet.balance, subtotal - discount_amount);
    }

    const total = Math.max(0, subtotal + shipping_fee - discount_amount - referral_discount - wallet_deduction);
    const formattedAmount = total.toFixed(2);
    const currency = "LKR";

    // Generate a temporary order reference (will be replaced with real order_id after PayHere creates order)
    const order_ref = `PH-${user.id.slice(0, 8)}-${Date.now()}`;

    // Generate hash: MD5(merchant_secret) → uppercase → then MD5(merchant_id + order_id + amount + currency + upper_md5_secret) → uppercase
    const secretHash = (await md5(MERCHANT_SECRET)).toUpperCase();
    const rawHash = `${MERCHANT_ID}${order_ref}${formattedAmount}${currency}${secretHash}`;
    const hash = (await md5(rawHash)).toUpperCase();

    // Fetch user profile for prefilling
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();

    const addr = shipping_address || {};
    const fullName: string = addr.full_name || profile?.full_name || "";
    const nameParts = fullName.trim().split(" ");
    const first_name = nameParts[0] || "Customer";
    const last_name = nameParts.slice(1).join(" ") || " ";

    // Get PayHere settings (sandbox mode)
    const { data: pmSettings } = await supabaseAdmin
      .from("site_settings").select("value").eq("key", "payment_methods").maybeSingle();
    const payhereSettings = (pmSettings?.value as any) || {};
    const sandbox = payhereSettings.payhere_sandbox !== false; // default sandbox=true for safety

    return new Response(
      JSON.stringify({
        merchant_id: MERCHANT_ID,
        order_ref,
        amount: formattedAmount,
        currency,
        hash,
        sandbox,
        first_name,
        last_name,
        email: user.email || "",
        phone: addr.phone || profile?.phone || "",
        address: [addr.address_line1, addr.address_line2].filter(Boolean).join(", ") || " ",
        city: addr.city || " ",
        country: "Sri Lanka",
        delivery_address: [addr.address_line1, addr.address_line2].filter(Boolean).join(", "),
        delivery_city: addr.city || "",
        delivery_country: "Sri Lanka",
        // Pass along computed totals so front-end can create the order
        computed: { subtotal, shipping_fee, discount_amount, referral_discount, wallet_deduction, total },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
