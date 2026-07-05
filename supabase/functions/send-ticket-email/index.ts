// supabase/functions/send-ticket-email/index.ts
//
// Sends the two support-ticket emails that the frontend previously only
// claimed to send: a confirmation to the guest right after they submit a
// ticket, and a notification to the guest whenever an admin replies from
// the Admin Bookings > Support Tickets view.
//
// Deploy with:
//   supabase functions deploy send-ticket-email
//
// Required secrets:
//   RESEND_API_KEY          from resend.com
//   TICKET_NOTIFICATION_FROM  e.g. "Studio Photuna <notification@studiophotuna.com>"
//                               (domain must be verified in Resend, otherwise
//                               fall back to "Studio Photuna <onboarding@resend.dev>")
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
    const { type, ticket_id, reply_message } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id is required." }, 400);
    if (!["confirmation", "reply"].includes(type)) {
      return json({ error: "type must be 'confirmation' or 'reply'." }, 400);
    }

    // Always re-read the ticket from the database instead of trusting
    // whatever the client sends -- the client only ever supplies the id.
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id, name, email, category, message")
      .eq("id", ticket_id)
      .single();
    if (ticketErr || !ticket) return json({ error: "Ticket not found." }, 404);
    if (!ticket.email) return json({ error: "This ticket has no email on file." }, 400);

    if (type === "confirmation") {
      await sendEmail({
        to: ticket.email,
        subject: "We've received your Studio Photuna support request",
        html: confirmationHtml(ticket),
      });
      return json({ sent: true });
    }

    // type === "reply" -- only an authenticated admin may trigger this.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (!profile || !["admin", "superadmin"].includes(String(profile.role || "").toLowerCase())) {
      return json({ error: "Admin access required." }, 403);
    }

    if (!reply_message || !reply_message.trim()) {
      return json({ error: "reply_message is required." }, 400);
    }

    await sendEmail({
      to: ticket.email,
      subject: `Re: Your Studio Photuna support ticket`,
      html: replyHtml(ticket, reply_message.trim()),
    });
    return json({ sent: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message ?? "Unexpected error sending ticket email." }, 500);
  }
});

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress =
    Deno.env.get("TICKET_NOTIFICATION_FROM") || "Studio Photuna <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY not set -- skipping ticket email.");
    throw new Error("Email service is not configured yet.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      reply_to: "notification@studiophotuna.com",
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error (${res.status}): ${body}`);
  }
}

function confirmationHtml(ticket: Record<string, any>) {
  return `
    <p>Hi ${escapeHtml(ticket.name) || "there"},</p>
    <p>We've received your support request and our team will get back to you shortly.</p>
    <blockquote style="border-left:3px solid #6f4dff;margin:0;padding-left:12px;color:#5f6678;">${escapeHtml(ticket.message)}</blockquote>
    <p>Category: <strong>${escapeHtml(ticket.category) || "General"}</strong></p>
    <p>&mdash; Studio Photuna Support</p>
  `;
}

function replyHtml(ticket: Record<string, any>, message: string) {
  return `
    <p>Hi ${escapeHtml(ticket.name) || "there"},</p>
    <p>You have a new reply on your Studio Photuna support ticket:</p>
    <blockquote style="border-left:3px solid #6f4dff;margin:0;padding-left:12px;color:#5f6678;">${escapeHtml(message)}</blockquote>
    <p style="color:#8b92a6;font-size:12px;">Your original message: "${escapeHtml(ticket.message)}"</p>
    <p>Reply to this email if you need anything else.</p>
    <p>&mdash; Studio Photuna Support</p>
  `;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] as string)
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
