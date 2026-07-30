// providers/stripe.ts -- one-time Stripe Checkout Session for a booking deposit.

import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

export async function createStripeSession(opts: {
  depositAmount: number; description: string; email: string | null;
  successUrl: string; cancelUrl: string; bookingId: string;
}): Promise<{ url: string; sessionId: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.email ?? undefined,
    line_items: [{
      price_data: {
        currency: "php",
        product_data: { name: opts.description },
        unit_amount: opts.depositAmount * 100,
      },
      quantity: 1,
    }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { booking_id: opts.bookingId },
  });
  return { url: session.url!, sessionId: session.id };
}
