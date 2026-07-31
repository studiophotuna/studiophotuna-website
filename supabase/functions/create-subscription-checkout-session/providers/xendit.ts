// providers/xendit.ts -- Xendit Invoice for a Pro plan subscription period
// (no auto-renewal -- see index.ts header comment).
//
// API: https://developers.xendit.co/api-reference/#create-invoice
// Auth: HTTP Basic, secret key as username, blank password.
// Note: unlike Stripe/PayMongo, Xendit's `amount` is the plain currency
// value (e.g. 1800 = PHP 1,800) -- do NOT multiply by 100.

const XENDIT_API = "https://api.xendit.co/v2/invoices";

function authHeader(): string {
  const key = Deno.env.get("XENDIT_SECRET_KEY")!;
  return "Basic " + btoa(`${key}:`);
}

export async function createXenditInvoice(opts: {
  amount: number; description: string; email: string | null;
  successUrl: string; cancelUrl: string; userId: string; billing: string;
}): Promise<{ url: string; sessionId: string }> {
  // external_id must be unique per invoice -- a user can attempt this more
  // than once (e.g. cancel and retry), so a timestamp is appended.
  const externalId = `subscription-${opts.userId}-${opts.billing}-${Date.now()}`;
  const res = await fetch(XENDIT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      external_id: externalId,
      amount: opts.amount,
      currency: "PHP",
      description: opts.description,
      payer_email: opts.email || undefined,
      success_redirect_url: opts.successUrl,
      failure_redirect_url: opts.cancelUrl,
      metadata: { supabase_user_id: opts.userId, billing: opts.billing },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || "Xendit invoice creation failed.");
  return { url: body.invoice_url as string, sessionId: body.id as string };
}
