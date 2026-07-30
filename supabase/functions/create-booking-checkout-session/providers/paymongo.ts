// providers/paymongo.ts -- one-time PayMongo Checkout Session for a booking deposit.
//
// API: https://developers.paymongo.com/reference/create-a-checkout-session
// Auth: HTTP Basic, secret key as username, blank password.

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader(): string {
  const key = Deno.env.get("PAYMONGO_SECRET_KEY")!;
  return "Basic " + btoa(`${key}:`);
}

export async function createPaymongoSession(opts: {
  depositAmount: number; description: string; successUrl: string; cancelUrl: string; bookingId: string;
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
          line_items: [{ currency: "PHP", amount: opts.depositAmount * 100, name: opts.description, quantity: 1 }],
          payment_method_types: ["gcash", "card", "paymaya"],
          success_url: opts.successUrl,
          cancel_url: opts.cancelUrl,
          metadata: { booking_id: opts.bookingId },
        },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.errors?.[0]?.detail || "PayMongo checkout session creation failed.");
  return { url: body.data.attributes.checkout_url as string, sessionId: body.data.id as string };
}
