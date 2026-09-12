// supabase/functions/_shared/recordPayment.ts
//
// Writes a row into subscription_payments so a website purchase appears in the
// operator's billing history, the same as one made in the desktop app.
//
// The app's functions grant the plan *through* that table (grantOnce claims a
// payment before applying it). The website's functions granted before the table
// existed and have their own duplicate protection — capture-subscription-payment
// checks the licence state, and the webhook matches the session id — so this
// only records; it never grants. Keep it that way: two different pieces of code
// deciding whether a plan is owed is how a payment gets applied twice.
//
// Best effort by design. A receipt that fails to write must never fail a
// payment that has already been taken; the caller logs and carries on.

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export type PaymentRecord = {
  provider: "paypal" | "paymongo";
  reference: string;            // PayPal order id, or PayMongo checkout session id
  userId: string;
  billing: "monthly" | "yearly";
  amountCentavos?: number | null;
  currency?: string | null;
  method?: string | null;
  periodEnd?: string | null;
};

export async function recordWebsitePayment(admin: AdminClient, p: PaymentRecord): Promise<void> {
  const now = new Date().toISOString();
  // The app records plans as monthly/yearly; the website's licence rows say
  // pro_monthly/pro_yearly. One spelling in the history, or an operator sees
  // the same plan under two names.
  const plan = p.billing === "yearly" ? "yearly" : "monthly";

  const { error } = await admin.from("subscription_payments").insert({
    provider: p.provider,
    reference: p.reference,
    user_id: p.userId,
    plan,
    plan_type: "subscription",
    amount_centavos: p.amountCentavos ?? null,
    currency: p.currency ?? "PHP",
    method: p.method ?? (p.provider === "paypal" ? "PayPal" : "PayMongo"),
    description: plan === "yearly" ? "Photuna Pro — Yearly" : "Photuna Pro — Monthly",
    source: "website",
    paid_at: now,
    applied_at: now,
    period_start: now,
    period_end: p.periodEnd ?? null,
    expires_at: p.periodEnd ?? null,
  });

  // 23505 = this payment is already recorded (a retried webhook, or the payer
  // reloading the return page). Nothing to do.
  if (error && error.code !== "23505") {
    console.error("[recordPayment] could not record", p.provider, p.reference, error.message);
  }
}
