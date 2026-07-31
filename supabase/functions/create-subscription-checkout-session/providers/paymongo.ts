// providers/paymongo.ts -- one-time PayMongo Checkout Session for a Pro plan
// subscription period (no auto-renewal -- see index.ts header comment).
//
// API: https://developers.paymongo.com/reference/create-a-checkout-session
// Auth: HTTP Basic, secret key as username, blank password.
//
// payment_method_types below only matters for methods that are Active on
// the PayMongo account (Dashboard -> Settings -> Payment Methods) --
// anything still "Submitted"/pending approval or "Inactive" is silently
// left out of the checkout even if listed here.

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader(): string {
  const key = Deno.env.get("PAYMONGO_SECRET_KEY")!;
  return "Basic " + btoa(`${key}:`);
}

export async function createPaymongoSession(opts: {
  amount: number; description: string;
  successUrl: string; cancelUrl: string; userId: string; billing: string;
}): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_line_items: true,
          description: opts.description,
          line_items: [{ currency: "PHP", amount: opts.amount * 100, name: opts.description, quantity: 1 }],
          payment_method_types: ["qrph", "gcash", "card", "paymaya"],
          success_url: opts.successUrl,
          cancel_url: opts.cancelUrl,
          metadata: { supabase_user_id: opts.userId, billing: opts.billing },
        },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.errors?.[0]?.detail || "PayMongo checkout session creation failed.");
  return { url: body.data.attributes.checkout_url as string, sessionId: body.data.id as string };
}
