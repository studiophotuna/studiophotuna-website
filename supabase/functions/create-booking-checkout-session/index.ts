// supabase/functions/create-booking-checkout-session/index.ts
//
// Creates a checkout/payment session for an event booking's 50% deposit,
// using whichever payment gateway the admin has configured for the "book"
// context (Bookings Admin > Settings). Called anonymously (no Supabase
// auth) by the public Book an Event wizard right after a booking request
// is inserted.
//
// Deploy with:
//   supabase functions deploy create-booking-checkout-session --no-verify-jwt
// (--no-verify-jwt is required: guests booking an event aren't signed in.)
//
// Required secrets (set with `supabase secrets set KEY=value`) -- only the
// ones for the currently-active provider need to be set:
//   STRIPE_SECRET_KEY
//   PAYMONGO_SECRET_KEY
//   XENDIT_SECRET_KEY
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV ("live" or "sandbox"; defaults to live)
//   SITE_URL                e.g. https://studiophotuna.com
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeSession } from "./providers/stripe.ts";
import { createPaymongoSession } from "./providers/paymongo.ts";
import { createXenditInvoice } from "./providers/xendit.ts";
import { createPaypalOrder } from "./providers/paypal.ts";

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

    // The admin can switch this at any time, so re-check server-side
    // rather than trusting the client.
    const { data: settings } = await supabaseAdmin
      .from("payment_gateway_settings")
      .select("provider")
      .eq("context", "book")
      .maybeSingle();

    const provider = settings?.provider;
    if (!provider || provider === "manual_gcash") {
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
    const successUrl = `${siteUrl}/payment/book_success?booking_id=${booking.id}`;
    const cancelUrl = `${siteUrl}/payment/book_cancel?booking_id=${booking.id}`;
    const description = `Event Booking Deposit — ${booking.package_name || "Studio Photuna"}`;

    let result: { url: string; sessionId: string };
    switch (provider) {
      case "stripe":
        result = await createStripeSession({ depositAmount, description, email: booking.email, successUrl, cancelUrl, bookingId: booking.id });
        break;
      case "paymongo":
        result = await createPaymongoSession({ depositAmount, description, successUrl, cancelUrl, bookingId: booking.id });
        break;
      case "xendit":
        result = await createXenditInvoice({ depositAmount, description, email: booking.email, successUrl, cancelUrl, bookingId: booking.id });
        break;
      case "paypal":
        result = await createPaypalOrder({ depositAmount, description, successUrl, cancelUrl, bookingId: booking.id });
        break;
      default:
        return json({ error: "The selected payment gateway isn't supported yet." }, 400);
    }

    await supabaseAdmin
      .from("event_bookings")
      .update({ deposit_amount: depositAmount, payment_provider: provider, payment_session_id: result.sessionId })
      .eq("id", booking.id);

    return json({ url: result.url });
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
