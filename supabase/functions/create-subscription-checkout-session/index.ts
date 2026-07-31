// supabase/functions/create-subscription-checkout-session/index.ts
//
// Creates a ONE-TIME checkout/payment session covering a single Pro plan
// billing period (monthly or yearly), for whichever payment gateway the
// admin has configured for the "app" context (Bookings Admin > Settings)
// -- used only when that gateway is PayMongo, Xendit, or PayPal. Stripe
// keeps its own separate, already-existing TRUE recurring subscription via
// create-checkout-session; Manual GCash keeps its own proof-upload modal.
//
// This does NOT auto-renew. The customer pays once for the period and
// resubscribes manually next time, the same way the existing Manual GCash
// flow already works -- real recurring billing for these three providers
// is a separate, bigger piece of work for later.
//
// Requires a signed-in Supabase user (unlike the booking-deposit version
// of this function, which is anonymous).
//
// Deploy with:
//   supabase functions deploy create-subscription-checkout-session
//
// Required secrets (set with `supabase secrets set KEY=value`) -- only the
// ones for the currently-active provider need to be set:
//   PAYMONGO_SECRET_KEY
//   XENDIT_SECRET_KEY
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV ("live" or "sandbox"; defaults to live)
//   SITE_URL                e.g. https://studiophotuna.com
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPaymongoSession } from "./providers/paymongo.ts";
import { createXenditInvoice } from "./providers/xendit.ts";
import { createPaypalOrder } from "./providers/paypal.ts";

const PHP_AMOUNTS: Record<string, number> = { monthly: 1800, yearly: 11400 };

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
    const { billing } = await req.json();
    const amount = PHP_AMOUNTS[billing];
    if (!amount) return json({ error: "Invalid billing cycle." }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);
    const user = userData.user;

    // The admin can switch this at any time, so re-check server-side
    // rather than trusting the client.
    const { data: settings } = await supabaseAdmin
      .from("payment_gateway_settings")
      .select("provider")
      .eq("context", "app")
      .maybeSingle();

    const provider = settings?.provider;
    if (provider === "stripe" || provider === "manual_gcash" || !provider) {
      return json({ error: "This payment method isn't handled by this endpoint." }, 400);
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://studiophotuna.com";
    const successUrl = `${siteUrl}/payment/app_success`;
    const cancelUrl = `${siteUrl}/payment/app_cancel`;
    const description = `Studio Photuna Pro Plan — ${billing === "yearly" ? "Yearly" : "Monthly"}`;

    let result: { url: string; sessionId: string };
    switch (provider) {
      case "paymongo":
        result = await createPaymongoSession({ amount, description, successUrl, cancelUrl, userId: user.id, billing });
        break;
      case "xendit":
        result = await createXenditInvoice({ amount, description, email: user.email ?? null, successUrl, cancelUrl, userId: user.id, billing });
        break;
      case "paypal":
        result = await createPaypalOrder({ amount, description, successUrl, cancelUrl, userId: user.id, billing });
        break;
      default:
        return json({ error: "The selected payment gateway isn't supported yet." }, 400);
    }

    // "pending_verification" reuses the exact same state the Manual GCash
    // flow already sets while a proof is under review -- the account UI
    // and getSubscriptionBlocker() already know how to display it.
    await supabaseAdmin
      .from("licenses")
      .upsert(
        { user_id: user.id, payment_provider: provider, payment_session_id: result.sessionId, pending_billing: billing, state: "pending_verification" },
        { onConflict: "user_id" }
      );

    return json({ url: result.url });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error creating subscription checkout session." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
