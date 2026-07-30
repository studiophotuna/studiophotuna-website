// supabase/functions/create-booking-checkout-session/index.ts
//
// Creates a one-time Stripe Checkout session for an event booking's 50%
// deposit. Called anonymously (no Supabase auth) by the public Book an
// Event wizard right after a booking request is inserted.
//
// Deploy with:
//   supabase functions deploy create-booking-checkout-session --no-verify-jwt
// (--no-verify-jwt is required: guests booking an event aren't signed in.)
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   STRIPE_SECRET_KEY       sk_live_... / sk_test_...
//   SITE_URL                e.g. https://studiophotuna.com
//   SUPABASE_URL            (auto-injected by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return json({ error: "Missing booking_id." }, 400);

    // The admin can switch this off (or to a provider we don't support yet)
    // at any time, so re-check server-side rather than trusting the client.
    const { data: settings } = await supabaseAdmin
      .from("payment_gateway_settings")
      .select("provider")
      .eq("context", "book")
      .maybeSingle();

    if (settings?.provider !== "stripe") {
      return json({ error: "Online payment isn't available for bookings right now. Please use the manual payment method." }, 400);
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("event_bookings")
      .select("id, package_name, email, estimated_total, reservation_status")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingErr || !booking) return json({ error: "Booking not found." }, 404);
    if (booking.reservation_status !== "unpaid") return json({ error: "This booking's deposit has already been processed." }, 400);
    if (!booking.estimated_total || booking.estimated_total <= 0) return json({ error: "This booking needs a custom quote before payment can be collected." }, 400);

    const depositAmount = Math.round(booking.estimated_total / 2);
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://studiophotuna.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.email ?? undefined,
      line_items: [{
        price_data: {
          currency: "php",
          product_data: { name: `Event Booking Deposit — ${booking.package_name || "Studio Photuna"}` },
          unit_amount: depositAmount * 100,
        },
        quantity: 1,
      }],
      success_url: `${siteUrl}/payment/book_success?booking_id=${booking.id}`,
      cancel_url: `${siteUrl}/payment/book_cancel?booking_id=${booking.id}`,
      metadata: { booking_id: booking.id },
    });

    await supabaseAdmin
      .from("event_bookings")
      .update({ deposit_amount: depositAmount, payment_provider: "stripe", stripe_checkout_session_id: session.id })
      .eq("id", booking.id);

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error creating booking checkout session." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
