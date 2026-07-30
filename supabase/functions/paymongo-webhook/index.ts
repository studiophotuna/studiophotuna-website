// supabase/functions/paymongo-webhook/index.ts
//
// Receives PayMongo webhook events for event booking deposits. Deploy with:
//   supabase functions deploy paymongo-webhook --no-verify-jwt
// (--no-verify-jwt is required: PayMongo calls this endpoint directly, it
// doesn't have a Supabase user session/JWT.)
//
// Register the endpoint in the PayMongo Dashboard -> Developers -> Webhooks:
//   https://<project-ref>.functions.supabase.co/paymongo-webhook
// listening for: checkout_session.payment.paid
// Copy the resulting signing secret into PAYMONGO_WEBHOOK_SECRET.
//
// Signature format (header "Paymongo-Signature"):
//   t=<unix_timestamp>,te=<test_mode_signature>,li=<live_mode_signature>
// Signed payload = `${timestamp}.${rawBody}`, HMAC-SHA256 with the webhook
// secret, hex digest compared against `li` (live) or `te` (test).
//
// Required secrets: PAYMONGO_WEBHOOK_SECRET
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected by Supabase.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const secret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET")!;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const timestamp = parts.t;
  const candidate = parts.li || parts.te;
  if (!timestamp || !candidate) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === candidate;
}

serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("Paymongo-Signature");

  if (!(await verifySignature(rawBody, signature))) {
    console.error("PayMongo webhook signature verification failed.");
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;

    if (eventType === "checkout_session.payment.paid") {
      const checkoutSession = event.data.attributes.data;
      const bookingId = checkoutSession?.attributes?.metadata?.booking_id;
      if (bookingId) {
        await supabaseAdmin
          .from("event_bookings")
          .update({ reservation_status: "partial_paid", reservation_paid_at: new Date().toISOString() })
          .eq("id", bookingId)
          .eq("payment_session_id", checkoutSession.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Error handling PayMongo webhook:", err);
    return new Response("Internal error handling webhook", { status: 500 });
  }
});
