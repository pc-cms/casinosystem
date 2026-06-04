// Premier Club: submit KYC (selfie + id front + id back + edited details).
// Photos are uploaded to existing buckets via service role, then the player is
// locked into `pending` and a kyc_reviews row is created.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyClubToken, tokenFromRequest } from "../_shared/club-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ERROR_MESSAGES: Record<string, string> = {
  player_not_found: "Player record not found.",
  already_submitted: "Verification already submitted.",
  invalid_first_name: "First name is required.",
  invalid_last_name: "Last name is required.",
  invalid_dob: "Date of birth is required.",
  invalid_id_number: "ID number is required.",
  missing_photos: "Selfie and ID photos are required.",
  duplicate_id: "A player with this ID number already exists.",
};

function decodeDataUrl(s: string): { bytes: Uint8Array; contentType: string } {
  // accepts both raw base64 and "data:image/jpeg;base64,..." forms
  const m = s.match(/^data:([^;]+);base64,(.+)$/);
  const ct = m ? m[1] : "image/jpeg";
  const b64 = m ? m[2] : s;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType: ct };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = tokenFromRequest(req);
    if (!token) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const session = await verifyClubToken(token);
    if (!session) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const first = String(body.first_name ?? "").trim();
    const last = String(body.last_name ?? "").trim();
    const dob = String(body.dob ?? "").trim();
    const idNumber = String(body.id_number ?? "").trim();
    const selfie = String(body.selfie_b64 ?? "");
    const idFront = String(body.id_front_b64 ?? "");
    const idBack = String(body.id_back_b64 ?? "");
    const ocr = (body.ocr ?? {}) as Record<string, unknown>;

    if (!selfie || !idFront || !idBack) {
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.missing_photos, code: "missing_photos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: player } = await sb.from("players").select("id").eq("phone", session.phone).maybeSingle();
    if (!player) {
      return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stamp = Date.now();
    const selfieDec = decodeDataUrl(selfie);
    const idFrontDec = decodeDataUrl(idFront);
    const idBackDec = decodeDataUrl(idBack);

    // Selfie → public players bucket. ID photos → private documents bucket.
    const selfiePath = `players/${player.id}/selfie-${stamp}.jpg`;
    const idFrontPath = `players/${player.id}/id-front-${stamp}.jpg`;
    const idBackPath = `players/${player.id}/id-back-${stamp}.jpg`;

    const up1 = await sb.storage.from("player-photos").upload(selfiePath, selfieDec.bytes, {
      contentType: selfieDec.contentType, upsert: true,
    });
    if (up1.error) throw up1.error;
    const up2 = await sb.storage.from("player-documents").upload(idFrontPath, idFrontDec.bytes, {
      contentType: idFrontDec.contentType, upsert: true,
    });
    if (up2.error) throw up2.error;
    const up3 = await sb.storage.from("player-documents").upload(idBackPath, idBackDec.bytes, {
      contentType: idBackDec.contentType, upsert: true,
    });
    if (up3.error) throw up3.error;

    const { data: pub } = sb.storage.from("player-photos").getPublicUrl(selfiePath);
    const selfieUrl = pub.publicUrl;

    const { error } = await sb.rpc("club_submit_kyc", {
      _player_id: player.id,
      _first: first,
      _last: last,
      _dob: dob,
      _id_number: idNumber,
      _selfie_url: selfieUrl,
      _id_front_url: idFrontPath,
      _id_back_url: idBackPath,
      _ocr: ocr,
    });
    if (error) {
      const code = (error.message || "").replace(/.*: /, "").trim();
      return new Response(JSON.stringify({ error: ERROR_MESSAGES[code] || "Submit failed", code }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
