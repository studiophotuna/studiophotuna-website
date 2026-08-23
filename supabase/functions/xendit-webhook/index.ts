// supabase/functions/xendit-webhook/index.ts
//
// Receives Xendit invoice callback events for both event booking deposits
// and Pro plan subscription payments (one-time per billing period, no
// auto-renewal). Deploy with:
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
  const token = req.headers.get("x-callback-token");
  const expected = Deno.env.get("XENDIT_WEBHOOK_TOKEN");

  if (!token || !expected || token !== expected) {
    console.error("Xendit webhook token verification failed.");
    return new Response("Invalid token", { status: 401 });
  }

  try {
    const event = await req.json();
    // Invoice callbacks: status is "PAID" (or "SETTLED") once paid.
    if (event?.status === "PAID" || event?.status === "SETTLED") {
      const metadata = event?.metadata || {};
      // Fallback for invoices created before metadata was added:
      // external_id was `booking-<booking_id>`.
      const externalId = event?.external_id as string | undefined;
      const bookingId = metadata.booking_id
        || (externalId?.startsWith("booking-") ? externalId.slice("booking-".length) : null);
      const userId = metadata.supabase_user_id;

      if (bookingId) {
        await supabaseAdmin
          .from("event_bookings")
          .update({ reservation_status: "partial_paid", reservation_paid_at: new Date().toISOString() })
          .eq("id", bookingId)
          .eq("payment_session_id", event.id);
      } else if (userId) {
        const { data: license } = await supabaseAdmin
          .from("licenses")
          .select("pending_billing, pending_discount_code_id")
          .eq("user_id", userId)
          .eq("payment_session_id", event.id)
          .maybeSingle();
        if (license) {
          const billing = license.pending_billing === "yearly" ? "yearly" : "monthly";
          await supabaseAdmin
            .from("licenses")
            .update({
              state: "active",
              plan: billing === "yearly" ? "pro_yearly" : "pro_monthly",
              current_period_end: periodEndFor(billing),
              cancel_at_period_end: true,
              pending_discount_code_id: null,
            })
            .eq("user_id", userId);
          await finalizeDiscountRedemption(license.pending_discount_code_id, userId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Error handling Xendit webhook:", err);
    return new Response("Internal error handling webhook", { status: 500 });
  }
});
