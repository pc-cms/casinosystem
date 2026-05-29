/**
 * G3 · Marketing / Promo Campaigns hooks.
 * - List / create / update campaigns
 * - List / add expenses
 * - List / attribute players
 * - KPI via promo_campaign_kpi RPC (server-computed)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PromoCampaignType = "event" | "bonus" | "advertising" | "sponsorship" | "other";
export type PromoCampaignStatus = "planned" | "active" | "completed" | "cancelled";

export type PromoCampaign = {
  id: string;
  casino_id: string;
  name: string;
  campaign_type: PromoCampaignType;
  status: PromoCampaignStatus;
  starts_on: string;
  ends_on: string | null;
  budget_tzs: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PromoExpense = {
  id: string;
  campaign_id: string;
  casino_id: string;
  spent_on: string;
  amount_tzs: number;
  vendor: string | null;
  description: string | null;
  created_at: string;
};

export type PromoPlayer = {
  id: string;
  campaign_id: string;
  player_id: string;
  casino_id: string;
  attributed_on: string;
  note: string | null;
  created_at: string;
};

export type PromoKPI = {
  campaign_id: string;
  name: string;
  campaign_type: PromoCampaignType;
  status: PromoCampaignStatus;
  starts_on: string;
  ends_on: string | null;
  budget_tzs: number;
  spent_tzs: number;
  utilization_pct: number;
  players_count: number;
  drop_total_tzs: number;
  cashout_total_tzs: number;
  nep_total_tzs: number;
  roi_pct: number;
  cac_per_player_tzs: number;
};

// ---------- Campaigns ----------
export function usePromoCampaigns(casinoId: string | null) {
  return useQuery({
    queryKey: ["promo-campaigns", casinoId],
    enabled: !!casinoId,
    queryFn: async (): Promise<PromoCampaign[]> => {
      const { data, error } = await supabase
        .from("promo_campaigns")
        .select("*")
        .eq("casino_id", casinoId!)
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PromoCampaign[];
    },
  });
}

export function usePromoCampaign(id: string | null) {
  return useQuery({
    queryKey: ["promo-campaign", id],
    enabled: !!id,
    queryFn: async (): Promise<PromoCampaign | null> => {
      const { data, error } = await supabase
        .from("promo_campaigns")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as PromoCampaign | null;
    },
  });
}

export function useCreatePromoCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PromoCampaign, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("promo_campaigns")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promo-campaigns"] }),
  });
}

export function useUpdatePromoCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<PromoCampaign> }) => {
      const { error } = await supabase
        .from("promo_campaigns")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["promo-campaigns"] });
      qc.invalidateQueries({ queryKey: ["promo-campaign", v.id] });
      qc.invalidateQueries({ queryKey: ["promo-kpi", v.id] });
    },
  });
}

// ---------- Expenses ----------
export function usePromoExpenses(campaignId: string | null) {
  return useQuery({
    queryKey: ["promo-expenses", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<PromoExpense[]> => {
      const { data, error } = await supabase
        .from("promo_campaign_expenses")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PromoExpense[];
    },
  });
}

export function useAddPromoExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      campaign_id: string;
      casino_id: string;
      spent_on: string;
      amount_tzs: number;
      vendor?: string;
      description?: string;
    }) => {
      const { error } = await supabase.from("promo_campaign_expenses").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["promo-expenses", v.campaign_id] });
      qc.invalidateQueries({ queryKey: ["promo-kpi", v.campaign_id] });
    },
  });
}

// ---------- Players ----------
export function usePromoPlayers(campaignId: string | null) {
  return useQuery({
    queryKey: ["promo-players", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_campaign_players")
        .select("*, players:player_id(id, first_name, last_name, nickname)")
        .eq("campaign_id", campaignId!)
        .order("attributed_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<PromoPlayer & {
        players: { id: string; first_name: string; last_name: string; nickname: string } | null;
      }>;
    },
  });
}

export function useAttributePromoPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      campaign_id: string;
      casino_id: string;
      player_id: string;
      note?: string;
    }) => {
      const { error } = await supabase.from("promo_campaign_players").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["promo-players", v.campaign_id] });
      qc.invalidateQueries({ queryKey: ["promo-kpi", v.campaign_id] });
    },
  });
}

export function useRemovePromoPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; campaign_id: string }) => {
      const { error } = await supabase.from("promo_campaign_players").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["promo-players", v.campaign_id] });
      qc.invalidateQueries({ queryKey: ["promo-kpi", v.campaign_id] });
    },
  });
}

// ---------- KPI ----------
export function usePromoKPI(campaignId: string | null) {
  return useQuery({
    queryKey: ["promo-kpi", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<PromoKPI | null> => {
      const { data, error } = await supabase.rpc("promo_campaign_kpi", {
        _campaign_id: campaignId!,
      } as any);
      if (error) throw error;
      return data as unknown as PromoKPI;
    },
  });
}
