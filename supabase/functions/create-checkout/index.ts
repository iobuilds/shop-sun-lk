import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.email) throw new Error("Not authenticated");

    const { items, shipping_address, payment_method, coupon_code, wallet_amount } = await req.json();

    if (!items || items.length === 0) throw new Error("Cart is empty");

    // Fetch product details and verify stock
    const productIds = items.map((i: any) => i.id);
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock_quantity, images, category_id")
      .in("id", productIds);
    if (prodError) throw prodError;

    const productMap = new Map(products!.map((p: any) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) throw new Error(`Product ${item.id} not found`);
      if ((product.stock_quantity || 0) < item.quantity) {
        throw new Error(`${product.name} is out of stock (only ${product.stock_quantity} available)`);
      }
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const product = productMap.get(item.id)!;
      const total = product.price * item.quantity;
      subtotal += total;
      return {
        product_id: item.id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: total,
      };
    });

    // Validate and apply coupon
    let discount_amount = 0;
    let validated_coupon_code: string | null = null;
    if (coupon_code) {
      const { data: coupon, error: couponError } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", coupon_code.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (couponError) throw couponError;
      if (!coupon) throw new Error("Invalid coupon code");
      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) throw new Error("Coupon not yet active");
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error("Coupon expired");
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) throw new Error("Coupon usage limit reached");
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) throw new Error(`Minimum order Rs. ${coupon.min_order_amount} required`);

      // Per-user limit check
      if (coupon.per_user_limit) {
        const { count } = await supabaseAdmin
          .from("coupon_usage")
          .select("*", { count: "exact", head: true })
          .eq("coupon_id", coupon.id)
          .eq("user_id", user.id);
        if ((count || 0) >= coupon.per_user_limit) throw new Error("You have used this coupon the maximum times");
      }

      // Private coupon check
      if (coupon.coupon_type === "private") {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("phone").eq("user_id", user.id).maybeSingle();
        const userPhone = profile?.phone?.replace(/\s/g, "") || "";
        const { data: assignment } = await supabaseAdmin
          .from("coupon_assignments")
          .select("id")
          .eq("coupon_id", coupon.id)
          .or(`phone.eq.${userPhone},user_id.eq.${user.id}`)
          .maybeSingle();
        if (!assignment) throw new Error("This coupon is not available for your account");
      }

      // Category scope
      let eligible_subtotal = subtotal;
      const validCategoryIds: string[] = coupon.valid_category_ids || [];
      if (coupon.category_scope !== "all" && validCategoryIds.length > 0) {
        let eligibleTotal = 0;
        for (const item of items) {
          const product = productMap.get(item.id);
          if (!product) continue;
          const catId = product.category_id;
          let isEligible = coupon.category_scope === "selected"
            ? validCategoryIds.includes(catId)
            : !validCategoryIds.includes(catId);
          if (isEligible) eligibleTotal += product.price * item.quantity;
        }
        if (eligibleTotal === 0) throw new Error("Coupon does not apply to items in cart");
        eligible_subtotal = eligibleTotal;
      }

      if (coupon.discount_type === "percentage") {
        discount_amount = Math.round(eligible_subtotal * (coupon.discount_value / 100));
        if (coupon.max_discount_cap && discount_amount > coupon.max_discount_cap) {
          discount_amount = coupon.max_discount_cap;
        }
      } else {
        discount_amount = Math.min(coupon.discount_value, eligible_subtotal);
      }
      validated_coupon_code = coupon.code;

      // Increment used_count and record usage
      await supabaseAdmin.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);
    }

    // Wallet credit usage
    let wallet_deduction = 0;
    if (wallet_amount && wallet_amount > 0) {
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("id, balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (wallet && wallet.balance > 0) {
        wallet_deduction = Math.min(wallet_amount, wallet.balance, subtotal - discount_amount);
        if (wallet_deduction > 0) {
          // Will deduct after order creation
        }
      }
    }

    const shipping_fee = subtotal >= 5000 ? 0 : 350;
    const total = Math.max(0, subtotal - discount_amount - wallet_deduction + shipping_fee);

    const createOrder = async (pm: string) => {
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          shipping_fee,
          total,
          discount_amount: discount_amount + wallet_deduction,
          coupon_code: validated_coupon_code,
          payment_method: pm,
          payment_status: "pending",
          status: "pending",
          shipping_address: shipping_address || {},
          notes: wallet_deduction > 0 ? `wallet_used:${wallet_deduction}` : null,
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const itemsWithOrder = orderItems.map((oi: any) => ({ ...oi, order_id: order.id }));
      const { error: itemsError } = await supabaseAdmin.from("order_items").insert(itemsWithOrder);
      if (itemsError) throw itemsError;

      // Record coupon usage
      if (validated_coupon_code && coupon_code) {
        const { data: couponData } = await supabaseAdmin
          .from("coupons").select("id").eq("code", validated_coupon_code).maybeSingle();
        if (couponData) {
          await supabaseAdmin.from("coupon_usage").insert({
            coupon_id: couponData.id,
            user_id: user.id,
            order_id: order.id,
          });
        }
      }

      // Deduct wallet
      if (wallet_deduction > 0) {
        const { data: wallet } = await supabaseAdmin
          .from("wallets").select("id").eq("user_id", user.id).maybeSingle();
        if (wallet) {
          await supabaseAdmin.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            user_id: user.id,
            amount: -wallet_deduction,
            type: "debit",
            reason: "Order payment",
            order_id: order.id,
          });
        }
      }

      // Fire notification (non-blocking)
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ type: "new_order", order_id: order.id, user_email: user.email }),
      }).catch(() => {});

      return order;
    };

    if (payment_method === "bank_transfer") {
      const order = await createOrder("bank_transfer");
      return new Response(
        JSON.stringify({ type: "bank_transfer", order_id: order.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Stripe payment
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const order = await createOrder("stripe");

    const lineItems = items.map((item: any) => {
      const product = productMap.get(item.id)!;
      return {
        price_data: {
          currency: "lkr",
          product_data: {
            name: product.name,
            images: product.images?.length ? [product.images[0]] : [],
          },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.quantity,
      };
    });

    if (shipping_fee > 0) {
      lineItems.push({
        price_data: {
          currency: "lkr",
          product_data: { name: "Shipping Fee", images: [] },
          unit_amount: shipping_fee * 100,
        },
        quantity: 1,
      });
    }

    let discounts: any[] = [];
    const totalDiscount = discount_amount + wallet_deduction;
    if (totalDiscount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: totalDiscount * 100,
        currency: "lkr",
        duration: "once",
        name: wallet_deduction > 0
          ? `Discount + Wallet Credit`
          : `Coupon: ${validated_coupon_code}`,
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      discounts,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/order-success?order_id=${order.id}`,
      cancel_url: `${req.headers.get("origin")}/cart`,
      metadata: { order_id: order.id },
    });

    await supabaseAdmin
      .from("orders")
      .update({ notes: `stripe_session:${session.id}${wallet_deduction > 0 ? `,wallet_used:${wallet_deduction}` : ""}` })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ type: "stripe", url: session.url, order_id: order.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
