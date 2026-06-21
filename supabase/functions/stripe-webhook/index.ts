// supabase/functions/stripe-webhook/index.ts
//
// Receives Stripe webhook events and is the ONLY place subscription state
// gets written, using the service_role key (never exposed to the browser).
//
// Deploy with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// (--no-verify-jwt is required: Stripe calls this endpoint directly, it
// doesn't have a Supabase user session/JWT.)
//
// Then in the Stripe Dashboard -> Developers -> Webhooks, add an endpoint:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// listening for:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_failed
// Copy the resulting "Signing secret" into STRIPE_WEBHOOK_SECRET.
//
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertLicenseFromSubscription(userId, subscription);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id ?? (await findUserIdByCustomer(subscription.customer as string));
        if (userId) await upsertLicenseFromSubscription(userId, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id ?? (await findUserIdByCustomer(subscription.customer as string));
        if (userId) {
          await supabaseAdmin
            .from("licenses")
            .update({ state: "cancelled", plan: "free" })
            .eq("user_id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await findUserIdByCustomer(invoice.customer as string);
        if (userId) {
          await supabaseAdmin
            .from("licenses")
            .update({ state: "past_due" })
            .eq("user_id", userId);
        }
        break;
      }

      default:
        // Unhandled event types are fine to ignore.
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    return new Response("Internal error handling webhook", { status: 500 });
  }
});

async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("licenses")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function upsertLicenseFromSubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const interval = subscription.items.data[0]?.price?.recurring?.interval;

  await supabaseAdmin.from("licenses").upsert(
    {
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan: interval === "year" ? "pro_yearly" : "pro_monthly",
      state: subscription.status, // active | trialing | past_due | canceled ...
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "user_id" }
  );
}
