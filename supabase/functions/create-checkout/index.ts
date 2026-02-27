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
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.email) throw new Error("Not authenticated");

    const { items, shipping_address, payment_method, coupon_code } = await req.json();

    if (!items || items.length === 0) throw new Error("Cart is empty");

    // Fetch product details and verify stock
    const productIds = items.map((i: any) => i.id);
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock_quantity, images")
      .in("id", productIds);
    if (prodError) throw prodError;

    const productMap = new Map(products!.map((p: any) => [p.id, p]));

    // Validate stock
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
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error("Coupon expired");
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) throw new Error("Coupon usage limit reached");
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) throw new Error(`Minimum order Rs. ${coupon.min_order_amount} required`);

      if (coupon.discount_type === "percentage") {
        discount_amount = Math.round(subtotal * (coupon.discount_value / 100));
      } else {
        discount_amount = Math.min(coupon.discount_value, subtotal);
      }
      validated_coupon_code = coupon.code;

      // Increment used_count
      await supabaseAdmin.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);
    }

    const shipping_fee = subtotal >= 5000 ? 0 : 350;
    const total = Math.max(0, subtotal - discount_amount + shipping_fee);

    if (payment_method === "bank_transfer") {
      // Create order directly for bank transfer
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          shipping_fee,
          total,
          discount_amount,
          coupon_code: validated_coupon_code,
          payment_method: "bank_transfer",
          payment_status: "pending",
          status: "pending",
          shipping_address: shipping_address || {},
        })
        .select()
        .single();
      if (orderError) throw orderError;

      // Insert order items (triggers stock reduction)
      const itemsWithOrder = orderItems.map((oi: any) => ({
        ...oi,
        order_id: order.id,
      }));
      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(itemsWithOrder);
      if (itemsError) throw itemsError;

      // Fire notification (non-blocking)
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ type: "new_order", order_id: order.id, user_email: user.email }),
      }).catch(() => {});

      return new Response(
        JSON.stringify({ type: "bank_transfer", order_id: order.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Stripe payment
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create order with pending payment
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        subtotal,
        shipping_fee,
        total,
        discount_amount,
        coupon_code: validated_coupon_code,
        payment_method: "stripe",
        payment_status: "pending",
        status: "pending",
        shipping_address: shipping_address || {},
      })
      .select()
      .single();
    if (orderError) throw orderError;

    // Insert order items (triggers stock reduction)
    const itemsWithOrder = orderItems.map((oi: any) => ({
      ...oi,
      order_id: order.id,
    }));
    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(itemsWithOrder);
    if (itemsError) throw itemsError;

    // Create line items for Stripe
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

    // Add shipping as line item if applicable
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

    // Apply discount as Stripe coupon if applicable
    let discounts: any[] = [];
    if (discount_amount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discount_amount * 100,
        currency: "lkr",
        duration: "once",
        name: `Coupon: ${validated_coupon_code}`,
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

    // Store stripe session id on the order for verification
    await supabaseAdmin
      .from("orders")
      .update({ notes: `stripe_session:${session.id}` })
      .eq("id", order.id);

    // Fire notification (non-blocking)
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ type: "new_order", order_id: order.id, user_email: user.email }),
    }).catch(() => {});

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
