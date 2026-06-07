// Public landing consultation form handler.
// Inserts a row into public.consultation_requests using service role and
// (when configured) sends a notification email via Lovable transactional emails.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  name?: string;
  company?: string;
  contact?: string;
  message?: string;
  language?: string;
  source_url?: string;
}

function clean(v: unknown, max = 2000): string {
  return String(v ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const name = clean(body.name, 200);
  const company = clean(body.company, 200);
  const contact = clean(body.contact, 200);
  const message = clean(body.message, 4000);
  const language = clean(body.language, 8) || "en";
  const source_url = clean(body.source_url, 500);

  if (!name || !contact || !message) {
    return new Response(
      JSON.stringify({
        error: "Name, contact and message are required.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const userAgent = req.headers.get("user-agent") ?? "";

  const { data: row, error } = await supabase
    .from("consultation_requests")
    .insert({
      name,
      company: company || null,
      contact,
      message,
      language,
      source_url: source_url || null,
      user_agent: userAgent.slice(0, 500),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[send-consultation] insert failed", error);
    return new Response(
      JSON.stringify({ error: "Could not save your request." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Best-effort email notification. Silently succeeds (lead is already saved)
  // even when the transactional email function or recipient are not configured.
  const recipient = Deno.env.get("CONSULTATION_RECIPIENT_EMAIL");
  if (recipient) {
    try {
      const r = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "consultation-request",
          recipientEmail: recipient,
          idempotencyKey: `consultation-${row!.id}`,
          templateData: {
            name,
            company: company || "—",
            contact,
            message,
            language,
            sourceUrl: source_url || "",
          },
        },
      });
      if (r.error) throw r.error;
      await supabase
        .from("consultation_requests")
        .update({ email_sent: true })
        .eq("id", row!.id);
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      console.warn("[send-consultation] email send failed", msg);
      await supabase
        .from("consultation_requests")
        .update({ email_error: msg.slice(0, 500) })
        .eq("id", row!.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, id: row!.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
