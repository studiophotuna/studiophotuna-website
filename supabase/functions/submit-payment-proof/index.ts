// supabase/functions/submit-payment-proof/index.ts
//
// Called after the guest has already uploaded their screenshot directly to
// the `payment-proofs` storage bucket (same client-side pattern as the
// avatar upload). This function just records the metadata, sets the
// license to 'pending_verification', and emails you so you don't have to
// keep checking the dashboard.
//
// Deploy with:
//   supabase functions deploy submit-payment-proof
//
// Required secrets:
//   RESEND_API_KEY          from resend.com (free tier is enough for this)
//   ADMIN_NOTIFICATION_EMAIL   the email address that should get notified
//   ADMIN_NOTIFICATION_FROM    e.g. "Studio Photuna <onboarding@resend.dev>"
//                               (use Resend's shared onboarding@resend.dev
//                               sender until you verify your own domain)
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

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

    const { billing, amount_php, gcash_reference_number, gcash_sender_name, screenshot_path } = await req.json();

    if (!["monthly", "yearly"].includes(billing)) return json({ error: "Invalid billing cycle." }, 400);
    if (!gcash_reference_number || gcash_reference_number.trim().length < 6) {
      return json({ error: "Please enter a valid GCash reference number." }, 400);
    }
    if (!screenshot_path) return json({ error: "Screenshot is required." }, 400);

    // Defense in depth: confirm the screenshot was actually uploaded into
    // this user's own folder, not just any path string the client sent.
    if (!screenshot_path.startsWith(`${user.id}/`)) {
      return json({ error: "Screenshot path does not belong to this account." }, 403);
    }

    const { data: proof, error: insertErr } = await supabaseAdmin
      .from("payment_proofs")
      .insert({
        user_id: user.id,
        billing,
        amount_php,
        gcash_reference_number: gcash_reference_number.trim(),
        gcash_sender_name: gcash_sender_name?.trim() || null,
        screenshot_path,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Mark the license as awaiting manual review. Nothing is activated yet.
    await supabaseAdmin.from("licenses").upsert(
      {
        user_id: user.id,
        payment_provider: "manual_gcash",
        state: "pending_verification",
      },
      { onConflict: "user_id" }
    );

    await notifyAdmin(user.email ?? "unknown", proof);

    return json({ submitted: true, proofId: proof.id });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error submitting payment proof." }, 500);
  }
});

async function notifyAdmin(guestEmail: string, proof: Record<string, any>) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
  const fromAddress = Deno.env.get("ADMIN_NOTIFICATION_FROM") || "Studio Photuna <onboarding@resend.dev>";

  // Notification is best-effort -- if it's not configured yet or fails, the
  // proof is still saved and reviewable from the dashboard, so we never let
  // an email problem block the guest's submission.
  if (!apiKey || !adminEmail) {
    console.warn("RESEND_API_KEY / ADMIN_NOTIFICATION_EMAIL not set -- skipping admin email.");
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [adminEmail],
        subject: `New GCash payment proof -- ₱${proof.amount_php} (${proof.billing})`,
        html: `
          <p>A new GCash payment proof was submitted on Studio Photuna.</p>
          <ul>
            <li><strong>Guest email:</strong> ${guestEmail}</li>
            <li><strong>Plan:</strong> ${proof.billing}</li>
            <li><strong>Amount:</strong> ₱${proof.amount_php}</li>
            <li><strong>GCash reference number:</strong> ${proof.gcash_reference_number}</li>
            <li><strong>Sender name on GCash:</strong> ${proof.gcash_sender_name || "(not provided)"}</li>
          </ul>
          <p>Check this against your GCash transaction history, then review and
          approve it in Supabase: Table Editor &rarr; payment_proofs (id: ${proof.id}).
          The screenshot is in Storage &rarr; payment-proofs.</p>
        `,
      }),
    });
  } catch (err) {
    console.error("Admin notification email failed (non-fatal):", err);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
