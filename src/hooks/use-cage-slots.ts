// ============================================================
// CAGE SLOTS — hooks (queries + mutations)
// Mirrors patterns from Live Game Cage (use-shift.ts) but for slots only.
// ============================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { offlineMutation } from "@/lib/offline-mutation";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";

export type SlotsShiftType = "day" | "night";
export type SlotsStatus = "draft" | "open" | "ready_for_review" | "approved" | "closed" | "reversed";
export type SlotsInventoryType = "opening" | "closing";
export type SlotsCountType = "opening" | "check" | "closing";

// ============ Settings ============
export const useCageSlotsSettings = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["cage-slots-settings", casinoId],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("cage_slots_settings")
        .select("*")
        .eq("casino_id", casinoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

// ============ Active shift ============
export const useActiveCageSlotsShift = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["cage-slots-active-shift", casinoId],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("cage_slots_shifts")
        .select("*")
        .eq("casino_id", casinoId)
        .in("status", ["open", "ready_for_review"])
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

// ============ Shift detail ============
export const useCageSlotsShift = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-shift", shiftId],
    queryFn: async () => {
      if (!shiftId) return null;
      const { data, error } = await supabase
        .from("cage_slots_shifts")
        .select("*")
        .eq("id", shiftId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!shiftId,
    refetchInterval: 15_000,
  });
};

// ============ History ============
export const useCageSlotsHistory = (limit = 60) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["cage-slots-history", casinoId, limit],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("cage_slots_shifts")
        .select("*")
        .eq("casino_id", casinoId)
        .order("business_date", { ascending: false })
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId,
  });
};

// ============ Children: exchange rates ============
export const useSlotsRates = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-rates", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("cage_slots_exchange_rates")
        .select("*")
        .eq("cage_slots_shift_id", shiftId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!shiftId,
  });
};

// ============ Children: cash inventory ============
export const useSlotsInventory = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-inventory", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("cage_slots_cash_inventory")
        .select("*")
        .eq("cage_slots_shift_id", shiftId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!shiftId,
  });
};

// ============ Children: cards ============
export const useSlotsCards = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-cards", shiftId],
    queryFn: async () => {
      if (!shiftId) return null;
      const { data, error } = await supabase
        .from("cage_slots_cards")
        .select("*")
        .eq("cage_slots_shift_id", shiftId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!shiftId,
  });
};

// ============ Children: cash counts ============
export const useSlotsCashCounts = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-cash-counts", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("cage_slots_cash_counts")
        .select("*")
        .eq("cage_slots_shift_id", shiftId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!shiftId,
  });
};

// ============ Children: comments ============
export const useSlotsComments = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-comments", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("cage_slots_comments")
        .select("*")
        .eq("cage_slots_shift_id", shiftId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!shiftId,
  });
};

// ============ Children: cashless (scoped to shift) ============
export const useSlotsCashless = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cage-slots-cashless", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await (supabase as any)
        .from("cashless_transactions")
        .select("*, players(first_name,last_name)")
        .eq("cage_slots_shift_id", shiftId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!shiftId,
  });
};

// ============ Mutation: open shift ============
export const useOpenSlotsShift = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  const { data: businessDate } = useEffectiveBusinessDate();

  return useMutation({
    mutationFn: async (input: {
      shift_type: SlotsShiftType;
      exchange_rates: Record<string, number>;
      opening_cash: Array<{ currency: string; denomination: number; quantity: number }>;
      opening_card_count: number;
      card_deposit_value_tzs: number;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const bd = businessDate || new Date().toISOString().slice(0, 10);

      const { data: shift, error: e1 } = await supabase
        .from("cage_slots_shifts")
        .insert({
          casino_id: casinoId,
          business_date: bd,
          shift_type: input.shift_type,
          cashier_id: user.id,
          opened_by: user.id,
          status: "open",
          client_uuid: crypto.randomUUID(),
        } as any)
        .select()
        .single();
      if (e1) {
        if (e1.message?.includes("uq_cage_slots_one_open_per_slot")) {
          throw new Error("A slots shift is already open for this date/type");
        }
        throw e1;
      }

      // Rates
      const rateRows = Object.entries(input.exchange_rates).map(([code, rate]) => ({
        cage_slots_shift_id: shift.id,
        casino_id: casinoId,
        currency_code: code,
        rate_to_tzs: rate,
      }));
      if (rateRows.length) {
        const { error } = await supabase.from("cage_slots_exchange_rates").insert(rateRows as any);
        if (error) throw error;
      }

      // Opening cash inventory
      const invRows = input.opening_cash
        .filter(r => r.quantity > 0)
        .map(r => ({
          cage_slots_shift_id: shift.id,
          casino_id: casinoId,
          inventory_type: "opening" as SlotsInventoryType,
          currency_code: r.currency,
          denomination: r.denomination,
          quantity: r.quantity,
          rate_to_tzs: input.exchange_rates[r.currency] || (r.currency === "TZS" ? 1 : 0),
          created_by: user.id,
        }));
      if (invRows.length) {
        const { error } = await supabase.from("cage_slots_cash_inventory").insert(invRows as any);
        if (error) throw error;
      }

      // Opening cards (single 1:1 row)
      {
        const { error } = await supabase.from("cage_slots_cards").insert({
          cage_slots_shift_id: shift.id,
          casino_id: casinoId,
          opening_card_count: input.opening_card_count,
          card_deposit_value_tzs: input.card_deposit_value_tzs,
        } as any);
        if (error) throw error;
      }

      // Opening cash check snapshot (seed)
      const openingTotal = invRows.reduce((s, r) => s + r.denomination * r.quantity * r.rate_to_tzs, 0)
        + input.opening_card_count * input.card_deposit_value_tzs;
      try {
        await supabase.from("cage_slots_cash_counts").insert({
          cage_slots_shift_id: shift.id,
          casino_id: casinoId,
          count_type: "check" as SlotsCountType,
          counted_by: user.id,
          denominations: {
            cash: input.opening_cash,
            cards: { count: input.opening_card_count, value_tzs: input.card_deposit_value_tzs },
            rateMap: input.exchange_rates,
            totals: { total_tzs: openingTotal, is_opening: true },
            is_opening: true,
          } as any,
          total_tzs: openingTotal,
          note: "Opening snapshot",
        } as any);
      } catch (e) {
        console.error("seed opening check failed", e);
      }

      await logAction(casinoId, "system", "CAGE_SLOTS_SHIFT_OPENED", { shift_id: shift.id, shift_type: input.shift_type });
      return shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cage-slots-active-shift"] });
      qc.invalidateQueries({ queryKey: ["cage-slots-history"] });
      toast.success("Slots shift opened");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: update system result ============
export const useUpdateSlotsSystemResult = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (input: { shift_id: string; system_shift_result: number }) => {
      const { error } = await supabase
        .from("cage_slots_shifts")
        .update({ system_shift_result: input.system_shift_result } as any)
        .eq("id", input.shift_id);
      if (error) throw error;
      if (casinoId) {
        await logAction(casinoId, "edit", "CAGE_SLOTS_SYSTEM_RESULT_SET", {
          shift_id: input.shift_id, value: input.system_shift_result,
        });
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-active-shift"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: set closing cash inventory row ============
export const useUpsertSlotsInventory = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      inventory_type: SlotsInventoryType;
      currency: string;
      denomination: number;
      quantity: number;
      rate_to_tzs: number;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const payload = {
        cage_slots_shift_id: input.shift_id,
        casino_id: casinoId,
        inventory_type: input.inventory_type,
        currency_code: input.currency,
        denomination: input.denomination,
        quantity: input.quantity,
        rate_to_tzs: input.rate_to_tzs,
        created_by: user.id,
      } as any;
      const { error } = await supabase
        .from("cage_slots_cash_inventory")
        .upsert(payload, {
          onConflict: "cage_slots_shift_id,inventory_type,currency_code,denomination",
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-inventory", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: update cards (closing) ============
export const useUpdateSlotsCards = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      closing_card_count: number;
    }) => {
      const { error } = await supabase
        .from("cage_slots_cards")
        .update({ closing_card_count: input.closing_card_count } as any)
        .eq("cage_slots_shift_id", input.shift_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-cards", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: cash check snapshot ============
export const useCreateSlotsCashCount = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      count_type: SlotsCountType;
      denominations: Record<string, any>;
      total_tzs: number;
      note?: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("cage_slots_cash_counts").insert({
        cage_slots_shift_id: input.shift_id,
        casino_id: casinoId,
        count_type: input.count_type,
        denominations: input.denominations as any,
        total_tzs: input.total_tzs,
        counted_by: user.id,
        note: input.note || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-cash-counts", vars.shift_id] });
      toast.success("Cash check recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: submit for review (closing check) ============
export const useSubmitSlotsForReview = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      closing_total_tzs: number;
      closing_denominations: Record<string, any>;
      cashier_note?: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      // Persist closing snapshot as a "check" so it appears in cash checks history
      const closingTotal = Number(input.closing_total_tzs) || 0;
      await supabase.from("cage_slots_cash_counts").insert({
        cage_slots_shift_id: input.shift_id,
        casino_id: casinoId,
        count_type: "check" as SlotsCountType,
        denominations: {
          ...input.closing_denominations,
          is_closing: true,
          totals: { ...(input.closing_denominations.totals || {}), total_tzs: closingTotal, is_closing: true },
        } as any,
        total_tzs: closingTotal,
        counted_by: user.id,
        note: "Closing snapshot",
      } as any);

      const { error } = await supabase
        .from("cage_slots_shifts")
        .update({
          status: "ready_for_review",
          submitted_at: new Date().toISOString(),
          cashier_note: input.cashier_note || null,
        } as any)
        .eq("id", input.shift_id);
      if (error) throw error;

      await logAction(casinoId, "system", "CAGE_SLOTS_SHIFT_SUBMITTED", { shift_id: input.shift_id });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-active-shift"] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-history"] });
      toast.success("Submitted for manager review");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: manager approve & close ============
export const useApproveSlotsShift = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      manager_comment?: string;
      manager_id: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      if (input.manager_comment) {
        await supabase.from("cage_slots_comments").insert({
          cage_slots_shift_id: input.shift_id,
          casino_id: casinoId,
          comment_type: "manager_comment",
          comment_text: input.manager_comment,
          created_by: input.manager_id,
        } as any);
      }
      const { error } = await supabase
        .from("cage_slots_shifts")
        .update({
          status: "closed",
          reviewed_by: input.manager_id,
          reviewed_at: new Date().toISOString(),
          closed_by: input.manager_id,
          closed_at: new Date().toISOString(),
          manager_comment: input.manager_comment || null,
        } as any)
        .eq("id", input.shift_id);
      if (error) throw error;
      await logAction(casinoId, "system", "CAGE_SLOTS_SHIFT_CLOSED", {
        shift_id: input.shift_id, manager_id: input.manager_id,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-active-shift"] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-history"] });
      toast.success("Slots shift closed");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: reverse a closed shift ============
export const useReverseSlotsShift = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { shift_id: string; reason: string; manager_id: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("cage_slots_shifts")
        .update({ status: "reversed" } as any)
        .eq("id", input.shift_id);
      if (error) throw error;
      await supabase.from("cage_slots_comments").insert({
        cage_slots_shift_id: input.shift_id,
        casino_id: casinoId,
        comment_type: "reversal_reason",
        comment_text: input.reason,
        created_by: input.manager_id,
      } as any);
      await logAction(casinoId, "system", "CAGE_SLOTS_SHIFT_REVERSED", {
        shift_id: input.shift_id, manager_id: input.manager_id, reason: input.reason,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-active-shift"] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-history"] });
      toast.success("Shift reversed");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

// ============ Mutation: create cashless tied to shift ============
export const useCreateSlotsCashless = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  const { data: businessDate } = useEffectiveBusinessDate();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      direction: "IN" | "OUT";
      provider: "AIRTEL" | "MPESA" | "TIGO" | "HALOTEL";
      player_id?: string | null;
      player_name: string;
      amount: number;
      reference?: string;
      note?: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const bd = businessDate || new Date().toISOString().slice(0, 10);
      const { error } = await (supabase as any).from("cashless_transactions").insert({
        casino_id: casinoId,
        operator_id: user.id,
        business_date: bd,
        direction: input.direction,
        provider: input.provider,
        player_id: input.player_id ?? null,
        player_name: input.player_name,
        amount: input.amount,
        currency: "TZS",
        reference: input.reference || "",
        note: input.note || "",
        cage_slots_shift_id: input.shift_id,
        source_module: "cage_slots",
      });
      if (error) throw error;
      await logAction(casinoId, "expense", "CAGE_SLOTS_CASHLESS_CREATED", {
        shift_id: input.shift_id, direction: input.direction, amount: input.amount,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cage-slots-cashless", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shift", vars.shift_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};
