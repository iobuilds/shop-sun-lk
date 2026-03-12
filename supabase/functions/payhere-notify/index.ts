import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// MD5 for Deno
async function md5(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // PayHere sends POST with application/x-www-form-urlencoded
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const MERCHANT_SECRET = Deno.env.get("PAYHERE_MERCHANT_SECRET") ?? "";
    const MERCHANT_ID = Deno.env.get("PAYHERE_MERCHANT_ID") ?? "";

    const body = await req.text();
    const params = new URLSearchParams(body);

    const merchant_id = params.get("merchant_id") || "";
    const order_id = params.get("order_id") || "";
    const payhere_amount = params.get("payhere_amount") || "";
    const payhere_currency = params.get("payhere_currency") || "";
    const status_code = params.get("status_code") || "";
    const md5sig = params.get("md5sig") || "";

    // Verify signature
    const secretHash = (await md5(MERCHANT_SECRET)).toUpperCase();
    const localSig = (await md5(
      `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`
    )).toUpperCase();

    if (localSig !== md5sig) {
      console.error("PayHere signature mismatch");
      return new Response("Invalid signature", { status: 400 });
    }

    // status_code: 2=success, 0=pending, -1=cancelled, -2=failed, -3=chargedback
    const statusMap: Record<string, string> = {
      "2": "paid",
      "0": "pending",
      "-1": "cancelled",
      "-2": "failed",
      "-3": "chargedback",
    };
    const payment_status = statusMap[status_code] || "pending";

    // Find order by payhere_order_ref stored in notes, or by id directly
    // We store order_id as the DB order id in the notes field
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status")
      .or(`id.eq.${order_id},notes.ilike.%payhere_ref:${order_id}%`)
      .maybeSingle();

    if (!order) {
      console.error("Order not found for PayHere notify:", order_id);
      return new Response("Order not found", { status: 200 }); // 200 to prevent PayHere retries
    }

    if (status_code === "2") {
      // Payment success
      await supabaseAdmin.from("orders").update({
        payment_status: "paid",
        status: "confirmed",
      } as any).eq("id", order.id);

      await supabaseAdmin.from("order_status_history" as any).insert({
        order_id: order.id,
        status: "confirmed",
        note: `PayHere payment successful. Payment ID: ${params.get("payment_id") || ""}`,
      });

      // Fire SMS notification
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ type: "payment_confirmed", order_id: order.id }),
      }).catch(() => {});
    } else if (status_code === "-1" || status_code === "-2") {
      await supabaseAdmin.from("orders").update({ payment_status: "failed" } as any).eq("id", order.id);
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("PayHere notify error:", error.message);
    return new Response("Error", { status: 200 }); // Always 200 to prevent PayHere retries
  }
});
