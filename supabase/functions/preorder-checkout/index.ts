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
    if (authError || !user) throw new Error("Not authenticated");

    const { preorder_id, payment_type } = await req.json();
    // payment_type: "quote" | "arrival"
    if (!preorder_id) throw new Error("Missing preorder_id");

    const { data: req_data, error: reqErr } = await supabaseAdmin
      .from("preorder_requests")
      .select("*, preorder_items(*)")
      .eq("id", preorder_id)
      .eq("user_id", user.id)
      .single();

    if (reqErr || !req_data) throw new Error("Pre-order not found");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    let amountCents: number;
    let description: string;
    const shortId = preorder_id.slice(0, 8).toUpperCase();

    if (payment_type === "arrival") {
      const arrShipping = Number(req_data.arrival_shipping_fee) || 0;
      const arrTax = Number(req_data.arrival_tax_amount) || 0;
      const total = arrShipping + arrTax;
      if (total <= 0) throw new Error("No arrival charges to pay");
      amountCents = Math.round(total * 100);
      description = `Pre-Order PO-${shortId} — Arrival Charges (Shipping + Tax)`;
    } else {
      const grand = Number(req_data.grand_total) || 0;
      if (grand <= 0) throw new Error("No amount to pay");
      amountCents = Math.round(grand * 100);
      description = `Pre-Order PO-${shortId} — Quote Payment`;
    }

    const origin = req.headers.get("origin") || "https://shop-sun-lk.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "lkr",
            product_data: { name: description },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/pre-order?payment=success&id=${preorder_id}&type=${payment_type}`,
      cancel_url: `${origin}/pre-order?payment=cancel&id=${preorder_id}`,
      metadata: { preorder_id, payment_type, user_id: user.id },
    });

    // Store session id
    await supabaseAdmin
      .from("preorder_requests")
      .update({ stripe_session_id: session.id })
      .eq("id", preorder_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
