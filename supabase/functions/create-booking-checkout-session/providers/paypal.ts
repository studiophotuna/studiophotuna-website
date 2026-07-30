// providers/paypal.ts -- PayPal Orders (v2) for a booking deposit.
//
// API: https://developer.paypal.com/docs/api/orders/v2/
// Unlike the other providers, PayPal does not finalize the charge here --
// it only returns an "approve" link the guest is redirected to. After they
// approve on paypal.com, PayPal redirects back to successUrl with `token`
// (the order id) and `PayerID` query params appended. The actual charge
// happens in a separate server-side capture call -- see
// capture-booking-payment/index.ts, triggered from the book_success page
// when it detects that `token` param.
//
// PayPal's list of supported transaction currencies can vary by merchant
// account/country. If PHP charges get rejected for this account, this
// needs revisiting (e.g. charging in USD instead).

function apiBase(): string {
  return Deno.env.get("PAYPAL_ENV") === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error_description || "PayPal authentication failed.");
  return body.access_token as string;
}

export async function createPaypalOrder(opts: {
  depositAmount: number; description: string; successUrl: string; cancelUrl: string; bookingId: string;
}): Promise<{ url: string; sessionId: string }> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "PayPal-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: opts.bookingId,
        description: opts.description,
        amount: { currency_code: "PHP", value: opts.depositAmount.toFixed(2) },
      }],
      application_context: {
        return_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        user_action: "PAY_NOW",
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || "PayPal order creation failed.");
  const approveLink = (body.links || []).find((l: { rel: string }) => l.rel === "approve")?.href;
  if (!approveLink) throw new Error("PayPal did not return an approval link.");
  return { url: approveLink as string, sessionId: body.id as string };
}
