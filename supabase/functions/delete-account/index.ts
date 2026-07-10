// supabase/functions/delete-account/index.ts
//
// Self-service account deletion, required so users can exercise their
// erasure right under the Data Privacy Act of 2012 (RA 10173) without
// having to email the DPO and wait on a manual process. Deleting an
// auth.users row requires the service-role key, which the client can
// never hold -- hence this function.
//
// A user can only ever delete themselves: the target id is taken from
// their own verified JWT, never from the request body.
//
// What gets hard-deleted: profile, avatar file, license, galleries,
// support tickets (+ ticket_replies via ON DELETE CASCADE), booth
// registrations.
// What gets anonymized instead of deleted: payment_proofs -- the GCash
// sender name and screenshot are removed, but the row (amount, dates,
// status) stays for accounting/tax record-keeping, which RA 10173 and
// standard retention practice both allow even after an erasure request.
//
// Deploy with:
//   supabase functions deploy delete-account
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);
    const userId = userData.user.id;

    // Best-effort cleanup -- collect problems but don't let one failure
    // abort the rest of the deletion (a half-deleted account is worse
    // than one with a stray orphaned row we can clean up manually).
    const warnings: string[] = [];
    const run = async (label: string, fn: () => Promise<{ error: any }>) => {
      try {
        const { error } = await fn();
        if (error) warnings.push(`${label}: ${error.message}`);
      } catch (err) {
        warnings.push(`${label}: ${err.message ?? String(err)}`);
      }
    };

    // Avatar file(s) -- stored under `${userId}/...` in the avatars bucket.
    try {
      const { data: files } = await supabaseAdmin.storage.from("avatars").list(userId);
      if (files?.length) {
        await supabaseAdmin.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (err) {
      warnings.push(`avatar storage cleanup: ${err.message ?? String(err)}`);
    }

    // Payment proof screenshots -- remove the image, keep the ledger row.
    try {
      const { data: proofs } = await supabaseAdmin
        .from("payment_proofs")
        .select("id, screenshot_path")
        .eq("user_id", userId);
      const paths = (proofs || []).map((p) => p.screenshot_path).filter(Boolean);
      if (paths.length) await supabaseAdmin.storage.from("payment-proofs").remove(paths);
      if (proofs?.length) {
        await run("anonymize payment_proofs", () =>
          supabaseAdmin
            .from("payment_proofs")
            .update({
              gcash_sender_name: null,
              admin_note: "[Account deleted by user request]",
            })
            .eq("user_id", userId)
        );
      }
    } catch (err) {
      warnings.push(`payment proof cleanup: ${err.message ?? String(err)}`);
    }

    await run("delete galleries (user_id)", () => supabaseAdmin.from("galleries").delete().eq("user_id", userId));
    await run("delete galleries (owner_user_id)", () => supabaseAdmin.from("galleries").delete().eq("owner_user_id", userId));
    await run("delete support_tickets", () => supabaseAdmin.from("support_tickets").delete().eq("user_id", userId));
    await run("delete booths", () => supabaseAdmin.from("booths").delete().eq("user_id", userId));
    await run("delete licenses", () => supabaseAdmin.from("licenses").delete().eq("user_id", userId));
    await run("delete profile", () => supabaseAdmin.from("profiles").delete().eq("id", userId));

    // Finally, the auth account itself -- this is the point of no return.
    const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteErr) throw authDeleteErr;

    if (warnings.length) console.warn("delete-account completed with warnings:", warnings);

    return json({ deleted: true, warnings: warnings.length ? warnings : undefined });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error deleting account." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
