// supabase/functions/receive-inbound-email/index.ts
//
// Webhook target for Resend's "Inbound" feature. When a guest replies to a
// ticket confirmation/reply email (reply-to: support@studiophotuna.com),
// Resend receives it, then POSTs an `email.received` event here. The event
// payload is metadata-only, so we call back into Resend to fetch the full
// body, then store it so it shows up in Admin Bookings > Inbox.
//
// This function is NOT gated by Supabase's JWT check (verify_jwt=false at
// deploy time) -- Resend has no Supabase session, so instead we verify the
// request ourselves using the Standard Webhooks signature scheme (the same
// one Svix/Resend webhooks use): HMAC-SHA256 over
// "{svix-id}.{svix-timestamp}.{raw body}" using the webhook signing secret.
//
// Deploy with:
//   supabase functions deploy receive-inbound-email --no-verify-jwt
//
// Required secrets:
//   RESEND_API_KEY            same key used by the other ticket functions
//   RESEND_WEBHOOK_SECRET      the "whsec_..." signing secret shown when you
//                               create the webhook in the Resend dashboard
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const TOLERANCE_SECONDS = 5 * 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();

    const verified = await verifySignature(req, rawBody);
    if (!verified) return json({ error: "Invalid webhook signature." }, 401);

    const event = JSON.parse(rawBody);

    if (event?.type !== "email.received") {
      // Resend may send other event types to the same endpoint later --
      // acknowledge them so it doesn't keep retrying, just don't act on them.
      return json({ ignored: true });
    }

    const svixId = req.headers.get("svix-id") ?? crypto.randomUUID();
    const emailId: string | undefined =
      event?.data?.email_id ?? event?.data?.id ?? event?.data?.email?.id;

    // Store a baseline row from the webhook metadata FIRST, using whatever
    // id we have (falling back to the event's own delivery id so a missing
    // email_id never loses the row). This guarantees something lands in
    // Admin Bookings > Inbox even if the enrichment step below fails --
    // the alternative (bailing out before any insert) is exactly what made
    // a real guest reply vanish with no trace anywhere.
    const metaFrom = event?.data?.from;
    const metaTo = event?.data?.to;
    let fromAddress = extractAddress(metaFrom);
    let fromName = extractName(metaFrom);
    let toAddress = Array.isArray(metaTo) ? extractAddress(metaTo[0]) : extractAddress(metaTo);
    let subject: string | null = event?.data?.subject ?? null;
    let textBody: string | null = null;
    let htmlBody: string | null = null;
    let fetchError: string | null = null;
    let raw: unknown = event;

    if (emailId) {
      try {
        const email = await fetchReceivedEmail(emailId);
        fromAddress = extractAddress(email.from) ?? fromAddress;
        fromName = extractName(email.from) ?? fromName;
        toAddress = (Array.isArray(email.to) ? extractAddress(email.to[0]) : extractAddress(email.to)) ?? toAddress;
        subject = email.subject ?? subject;
        textBody = email.text ?? null;
        htmlBody = email.html ?? null;
        raw = email;
      } catch (err) {
        console.error("Failed to fetch full received email, storing metadata only:", err);
        fetchError = err.message ?? String(err);
      }
    } else {
      fetchError = "No email_id found in webhook payload -- stored metadata only.";
    }

    let ticketId: string | null = null;
    if (fromAddress) {
      try {
        const { data: ticket } = await supabaseAdmin
          .from("support_tickets")
          .select("id")
          .eq("email", fromAddress)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        ticketId = ticket?.id ?? null;
      } catch (err) {
        console.error("Ticket lookup failed (non-fatal):", err);
      }
    }

    const { error: insertErr } = await supabaseAdmin.from("inbound_emails").upsert(
      {
        resend_email_id: emailId ?? `no-email-id-${svixId}`,
        from_address: fromAddress,
        from_name: fromName,
        to_address: toAddress,
        subject,
        text_body: textBody,
        html_body: htmlBody,
        ticket_id: ticketId,
        fetch_error: fetchError,
        raw,
      },
      { onConflict: "resend_email_id" }
    );
    if (insertErr) throw insertErr;

    return json({ stored: true, enriched: !fetchError });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error processing inbound email." }, 500);
  }
});

async function fetchReceivedEmail(emailId: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error fetching received email (${res.status}): ${body}`);
  }
  return await res.json();
}

function extractAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/<([^>]+)>/);
    return (match ? match[1] : value).trim().toLowerCase();
  }
  if (typeof value === "object" && value !== null && "email" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).email).trim().toLowerCase();
  }
  return null;
}

function extractName(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "name" in (value as Record<string, unknown>)) {
    const name = (value as Record<string, unknown>).name;
    return name ? String(name) : null;
  }
  if (typeof value === "string") {
    const match = value.match(/^"?([^"<]+)"?\s*<[^>]+>$/);
    return match ? match[1].trim() : null;
  }
  return null;
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("RESEND_WEBHOOK_SECRET not set -- rejecting inbound webhook.");
    return false;
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestamp = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  const secretBytes = base64Decode(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = base64Encode(new Uint8Array(signatureBuffer));

  return svixSignature
    .split(" ")
    .some((entry) => {
      const [version, sig] = entry.split(",");
      return version === "v1" && timingSafeEqual(sig, expected);
    });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
