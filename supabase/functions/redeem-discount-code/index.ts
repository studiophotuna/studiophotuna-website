// supabase/functions/redeem-discount-code/index.ts
//
// Validates a discount code for the signed-in caller and, if valid,
// records the redemption so that same user can never reuse it again
// (enforced by a unique (discount_code_id, user_id) constraint on
// discount_code_redemptions -- this applies to every code, restricted
// or not). Intended for any authenticated client that needs to apply a
// discount_codes-table code outside the website's own subscription
// checkout (which validates + redeems inline in
// create-subscription-checkout-session / the payment webhooks instead)
// -- e.g. the desktop Booth App, which already does its licensing and
// payment operations through Supabase.
//
// This function does not charge anything -- it only validates and
// records the redemption, then returns the discount type/value for the
// caller to apply to whatever amount it's charging.
//
// Deploy with:
//   supabase functions deploy redeem-discount-code
//
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);
    const user = userData.user;

    const { code, plan } = await req.json();
    if (!code || typeof code !== "string") return json({ error: "Missing discount code." }, 400);

    const { data: discount, error: lookupErr } = await supabaseAdmin
      .from("discount_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!discount) return json({ error: "Invalid discount code." }, 404);
    if (!discount.is_active) return json({ error: "This code is no longer active." }, 400);

    const now = new Date();
    if (discount.valid_from && new Date(discount.valid_from) > now) {
      return json({ error: "This code isn't active yet." }, 400);
    }
    if (discount.valid_until && new Date(discount.valid_until) < now) {
      return json({ error: "This code has expired." }, 400);
    }
    if (discount.max_uses !== null && discount.uses_count >= discount.max_uses) {
      return json({ error: "This code has reached its usage limit." }, 400);
    }
    if (discount.restricted_user_id && discount.restricted_user_id !== user.id) {
      return json({ error: "This code isn't available for your account." }, 403);
    }
    if (plan && Array.isArray(discount.applies_to) && discount.applies_to.length && !discount.applies_to.includes(plan)) {
      return json({ error: "This code doesn't apply to the selected plan." }, 400);
    }

    const { data: existingRedemption } = await supabaseAdmin
      .from("discount_code_redemptions")
      .select("id")
      .eq("discount_code_id", discount.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingRedemption) return json({ error: "You've already used this code." }, 409);

    const { error: redeemErr } = await supabaseAdmin
      .from("discount_code_redemptions")
      .insert({ discount_code_id: discount.id, user_id: user.id });
    if (redeemErr) {
      // Unique-constraint race: two simultaneous requests both passed the
      // check above. Whichever loses the insert just reports already-used.
      return json({ error: "You've already used this code." }, 409);
    }
    await supabaseAdmin
      .from("discount_codes")
      .update({ uses_count: discount.uses_count + 1 })
      .eq("id", discount.id);

    return json({
      valid: true,
      code: discount.code,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error redeeming discount code." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
