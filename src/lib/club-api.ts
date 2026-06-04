// Premier Club PWA — minimal token + API helpers (no Supabase auth; uses club-token).
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "club:token";
const PHONE_KEY = "club:phone";

export function getClubToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function getClubPhone(): string | null {
  return localStorage.getItem(PHONE_KEY);
}
export function setClubSession(token: string, phone: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PHONE_KEY, phone);
}
export function clearClubSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PHONE_KEY);
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function callFn<T = any>(name: string, body: any, withAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON,
  };
  if (withAuth) {
    const tok = getClubToken();
    if (!tok) throw new Error("not_logged_in");
    headers["Authorization"] = `Bearer ${tok}`;
  }
  const res = await fetch(`${FN_URL}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `request_failed_${res.status}`);
  return json as T;
}

export const clubApi = {
  sendOtp: (phone: string) => callFn("club-send-otp", { phone }),
  verifyOtp: (phone: string, code: string) => callFn<{ ok: boolean; token: string; phone: string; player_exists: boolean; player: any }>("club-verify-otp", { phone, code }),
  loginPassword: (phone: string, password: string) => callFn<{ ok: boolean; token: string; phone: string; player_exists: boolean; player: any }>("club-login-password", { phone, password }),
  registerMinimal: (input: { first_name: string; last_name: string; dob: string; password: string }) =>
    callFn<{ ok: boolean; player: any }>("club-register-player", input, true),
  wallet: () => callFn<{ ok: boolean; player: any; balance: number; grants: any[]; redemptions: any[]; redeem_token?: string; redeem_token_exp?: number }>("club-wallet", {}, true),
  updateProfile: (input: { first_name: string; last_name: string; dob: string; id_number?: string | null; casino_slug?: string | null }) =>
    callFn<{ ok: boolean }>("club-update-profile", input, true),
  submitKyc: (input: {
    first_name: string; last_name: string; dob: string; id_number: string;
    selfie_b64: string; id_front_b64: string; id_back_b64: string;
    ocr?: Record<string, unknown>;
  }) => callFn<{ ok: boolean }>("club-submit-kyc", input, true),
  cancelKyc: () => callFn<{ ok: boolean }>("club-cancel-kyc", {}, true),
  placeShopOrder: (item_id: string, qty: number, casino_id: string) =>
    callFn<{ ok: boolean; order_id: string; total: number }>("club-shop-order", { item_id, qty, casino_id }, true),
  buyTicket: (lottery_id: string, qty: number, casino_id: string) =>
    callFn<{ ok: boolean; lottery_id: string; qty: number; total: number; tickets: number[] }>("club-buy-ticket", { lottery_id, qty, casino_id }, true),
};

// Plain Supabase reads (anonymous; tables have public read policies for catalog)
export async function fetchShopCatalog() {
  const { data, error } = await supabase
    .from("shop_items")
    .select("id, name, description, price_credits, stock_qty, photo_url, casino_id, is_active")
    .eq("is_active", true)
    .gt("stock_qty", 0)
    .order("price_credits", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLotteries() {
  const { data, error } = await supabase
    .from("lotteries")
    .select("id, name, description, ticket_price_credits, draw_business_date, status, casino_id, max_tickets_per_player, total_tickets_cap")
    .eq("status", "open")
    .order("draw_business_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyTickets(playerId: string) {
  const { data, error } = await supabase
    .from("lottery_tickets")
    .select("id, ticket_number, purchased_at, lottery_id, lotteries(name, draw_business_date, status)")
    .eq("player_id", playerId)
    .order("purchased_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

