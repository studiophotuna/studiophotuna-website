// supabase/functions/create-portal-session/index.ts
//
// Lets a signed-in subscriber manage or cancel their plan via Stripe's
// hosted Customer Portal (update card, view invoices, cancel, switch plan).
// Deploy with:
//   supabase functions deploy create-portal-session
//
// Required secrets: STRIPE_SECRET_KEY, SITE_URL
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);

    const { data: license } = await supabaseAdmin
      .from("licenses")
      .select("stripe_customer_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!license?.stripe_customer_id) {
      return json({ error: "No billing account found yet. Subscribe first." }, 400);
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://studiophotuna.com";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: license.stripe_customer_id,
      return_url: `${siteUrl}/?#account`,
    });

    return json({ url: portalSession.url });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error opening billing portal." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
