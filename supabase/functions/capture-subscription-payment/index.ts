// supabase/functions/capture-subscription-payment/index.ts
//
// Captures a previously-approved PayPal order for a Pro plan subscription
// period. Called by the signed-in customer's browser (via
// supabaseClient.functions.invoke(), which attaches their session JWT
// automatically) from the /payment/app_success page when it detects
// PayPal's `token` (order id) query param after they return from
// approving payment on paypal.com.
//
// Deploy with:
//   supabase functions deploy capture-subscription-payment
//
// Required secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV
// ("live" or "sandbox"; defaults to live)
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected by Supabase.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function apiBase(): string {
  return Deno.env.get("PAYPAL_ENV") === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error_description || "PayPal authentication failed.");
  return body.access_token as string;
}

function periodEndFor(billing: string): string {
  const end = new Date();
  if (billing === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}

// Only called once payment has actually cleared -- a code validated at
// checkout-session creation isn't consumed until here, so an abandoned
// checkout never burns a single-use code.
async function finalizeDiscountRedemption(discountCodeId: string | null, userId: string) {
  if (!discountCodeId) return;
  const { error: redeemErr } = await supabaseAdmin
    .from("discount_code_redemptions")
    .insert({ discount_code_id: discountCodeId, user_id: userId });
  if (redeemErr) return; // already redeemed (race with another session) -- nothing more to do
  const { data: discount } = await supabaseAdmin
    .from("discount_codes")
    .select("uses_count")
    .eq("id", discountCodeId)
    .maybeSingle();
  if (discount) {
    await supabaseAdmin
      .from("discount_codes")
      .update({ uses_count: discount.uses_count + 1 })
      .eq("id", discountCodeId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);
    const user = userData.user;

    const { order_id } = await req.json();
    if (!order_id) return json({ error: "Missing order_id." }, 400);

    const { data: license, error: licenseErr } = await supabaseAdmin
      .from("licenses")
      .select("user_id, state, payment_provider, payment_session_id, pending_billing, pending_discount_code_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (licenseErr || !license) return json({ error: "License not found." }, 404);
    if (license.payment_provider !== "paypal" || license.payment_session_id !== order_id) {
      return json({ error: "This order does not match the account on record." }, 400);
    }
    if (license.state !== "pending_verification") {
      return json({ captured: true }); // already processed -- e.g. a duplicate return trip
    }

    const accessToken = await getAccessToken();
    const res = await fetch(`${apiBase()}/v2/checkout/orders/${order_id}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("PayPal capture failed:", body);
      return json({ captured: false, error: body?.message || "Capture failed." });
    }

    if (body.status === "COMPLETED") {
      const billing = license.pending_billing === "yearly" ? "yearly" : "monthly";
      await supabaseAdmin
        .from("licenses")
        .update({
          state: "active",
          plan: billing === "yearly" ? "pro_yearly" : "pro_monthly",
          current_period_end: periodEndFor(billing),
          cancel_at_period_end: true, // no auto-renewal for this provider yet -- customer resubscribes manually
          pending_discount_code_id: null,
        })
        .eq("user_id", user.id);
      await finalizeDiscountRedemption(license.pending_discount_code_id, user.id);
      return json({ captured: true });
    }

    return json({ captured: false, error: `Unexpected order status: ${body.status}` });
  } catch (err) {
    console.error(err);
    return json({ captured: false, error: err.message ?? "Unexpected error capturing payment." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
