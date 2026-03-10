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
    if (!preorder_id) throw new Error("Missing preorder_id");

    const { data: preorder, error: preErr } = await supabaseAdmin
      .from("preorder_requests")
      .select("*")
      .eq("id", preorder_id)
      .eq("user_id", user.id)
      .single();

    if (preErr || !preorder) throw new Error("Pre-order not found");
    if (!preorder.stripe_session_id) throw new Error("No Stripe session found");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(preorder.stripe_session_id);

    if (session.payment_status === "paid") {
      if (payment_type === "arrival") {
        await supabaseAdmin
          .from("preorder_requests")
          .update({ arrival_payment_status: "paid" })
          .eq("id", preorder_id);
      } else {
        await supabaseAdmin
          .from("preorder_requests")
          .update({ payment_status: "paid", status: "approved" })
          .eq("id", preorder_id);
      }
      return new Response(JSON.stringify({ status: "paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: session.payment_status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
