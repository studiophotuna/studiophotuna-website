// supabase/functions/xendit-webhook/index.ts
//
// Receives Xendit invoice callback events for event booking deposits.
// Deploy with:
//   supabase functions deploy xendit-webhook --no-verify-jwt
// (--no-verify-jwt is required: Xendit calls this endpoint directly, it
// doesn't have a Supabase user session/JWT.)
//
// Register the callback URL in the Xendit Dashboard -> Settings ->
// Developers -> Callbacks:
//   https://<project-ref>.functions.supabase.co/xendit-webhook
// Copy the "Verification Token" shown there into XENDIT_WEBHOOK_TOKEN --
// Xendit sends it back on every callback in the X-Callback-Token header
// and this must match exactly (Xendit doesn't HMAC-sign the body).
//
// Required secrets: XENDIT_WEBHOOK_TOKEN
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected by Supabase.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const token = req.headers.get("x-callback-token");
  const expected = Deno.env.get("XENDIT_WEBHOOK_TOKEN");

  if (!token || !expected || token !== expected) {
    console.error("Xendit webhook token verification failed.");
    return new Response("Invalid token", { status: 401 });
  }

  try {
    const event = await req.json();
    // Invoice callbacks: status is "PAID" (or "SETTLED") once paid.
    // external_id was set to `booking-<booking_id>` at invoice creation.
    if (event?.status === "PAID" || event?.status === "SETTLED") {
      const externalId = event?.external_id as string | undefined;
      const bookingId = externalId?.startsWith("booking-") ? externalId.slice("booking-".length) : null;
      if (bookingId) {
        await supabaseAdmin
          .from("event_bookings")
          .update({ reservation_status: "partial_paid", reservation_paid_at: new Date().toISOString() })
          .eq("id", bookingId)
          .eq("payment_session_id", event.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Error handling Xendit webhook:", err);
    return new Response("Internal error handling webhook", { status: 500 });
  }
});
