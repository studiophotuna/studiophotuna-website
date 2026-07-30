// supabase/functions/capture-booking-payment/index.ts
//
// Captures a previously-approved PayPal order for an event booking's 50%
// deposit. Called anonymously by the /payment/book_success page when it
// detects PayPal's `token` (order id) query param after the buyer returns
// from approving payment on paypal.com. Stripe/PayMongo/Xendit don't need
// this -- their payment confirmation arrives via webhook instead.
//
// Deploy with:
//   supabase functions deploy capture-booking-payment --no-verify-jwt
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id, order_id } = await req.json();
    if (!booking_id || !order_id) return json({ error: "Missing booking_id or order_id." }, 400);

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("event_bookings")
      .select("id, reservation_status, payment_provider, payment_session_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingErr || !booking) return json({ error: "Booking not found." }, 404);
    if (booking.payment_provider !== "paypal" || booking.payment_session_id !== order_id) {
      return json({ error: "This order does not match the booking on record." }, 400);
    }
    if (booking.reservation_status !== "unpaid") {
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
      await supabaseAdmin
        .from("event_bookings")
        .update({ reservation_status: "partial_paid", reservation_paid_at: new Date().toISOString() })
        .eq("id", booking_id);
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
