// supabase/functions/create-checkout-session/index.ts
//
// Creates a Stripe Checkout session for the signed-in user and returns the
// redirect URL. Deploy with:
//   supabase functions deploy create-checkout-session
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   STRIPE_SECRET_KEY       sk_live_... / sk_test_...
//   STRIPE_PRICE_MONTHLY    price_xxx (Stripe recurring Price id)
//   STRIPE_PRICE_YEARLY     price_xxx
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

const PRICE_IDS: Record<string, string> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY")!,
  yearly: Deno.env.get("STRIPE_PRICE_YEARLY")!,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { billing } = await req.json(); // "monthly" | "yearly"
    const priceId = PRICE_IDS[billing];
    if (!priceId) {
      return json({ error: "Invalid billing cycle." }, 400);
    }

    // Identify the calling user from their Supabase JWT (sent automatically
    // by supabaseClient.functions.invoke()).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);

    const user = userData.user;

    // Reuse an existing Stripe customer for this user if we already have one,
    // otherwise create a new one and store it.
    const { data: existingLicense } = await supabaseAdmin
      .from("licenses")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existingLicense?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("licenses")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId, state: "unsubscribed" },
          { onConflict: "user_id" }
        );
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://studiophotuna.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // account and pricing are now separate pages from home -- send the
      // return trip straight to account.html, and to home's #pricing anchor.
      success_url: `${siteUrl}/account?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancelled#pricing`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id, billing },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error creating checkout session." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
