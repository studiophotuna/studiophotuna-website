// providers/xendit.ts -- Xendit Invoice for a booking deposit.
//
// API: https://developers.xendit.co/api-reference/#create-invoice
// Auth: HTTP Basic, secret key as username, blank password.
// Note: unlike Stripe/PayMongo, Xendit's `amount` is the plain currency
// value (e.g. 5000 = PHP 5,000) -- do NOT multiply by 100.

const XENDIT_API = "https://api.xendit.co/v2/invoices";

function authHeader(): string {
  const key = Deno.env.get("XENDIT_SECRET_KEY")!;
  return "Basic " + btoa(`${key}:`);
}

export async function createXenditInvoice(opts: {
  depositAmount: number; description: string; email: string | null;
  successUrl: string; cancelUrl: string; bookingId: string;
}): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(XENDIT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      external_id: `booking-${opts.bookingId}`,
      amount: opts.depositAmount,
      currency: "PHP",
      description: opts.description,
      payer_email: opts.email || undefined,
      success_redirect_url: opts.successUrl,
      failure_redirect_url: opts.cancelUrl,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || "Xendit invoice creation failed.");
  return { url: body.invoice_url as string, sessionId: body.id as string };
}
