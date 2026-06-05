import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import { useAuth } from "@/lib/auth-context";
import { mapOcrNameToDbName, parseSpaced, type OcrRow } from "@/lib/import-helpers";
import { toast } from "sonner";

/** Save one day's worth of imported rows into table_daily_results (upsert per (casino,date,table)). */
export const useSaveImportedDay = () => {
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, rows }: { date: string; rows: OcrRow[] }) => {
      if (!activeCasinoId) throw new Error("No active casino");
      if (!user?.id) throw new Error("Not authenticated");
      if (!date) throw new Error("Date is required");

      // Resolve OCR names to real gaming_tables (one row per name)
      const dbNames = rows
        .map((r) => mapOcrNameToDbName(r.table))
        .filter((n): n is string => Boolean(n));

      const { data: tables, error: tErr } = await supabase
        .from("gaming_tables")
        .select("id, name")
        .eq("casino_id", activeCasinoId)
        .in("name", dbNames);
      if (tErr) throw tErr;

      // Pick one table_id per name (deterministic: first by id sort)
      const tableIdByName = new Map<string, string>();
      const sorted = (tables || []).slice().sort((a, b) => a.id.localeCompare(b.id));
      for (const t of sorted) {
        if (!tableIdByName.has(t.name)) tableIdByName.set(t.name, t.id);
      }

      const records = rows
        .map((r) => {
          const dbName = mapOcrNameToDbName(r.table);
          if (!dbName) return null; // skip Total
          const table_id = tableIdByName.get(dbName);
          if (!table_id) return null; // table doesn't exist for this casino
          return {
            casino_id: activeCasinoId,
            date,
            table_id,
            open: parseSpaced(r.open),
            fill: parseSpaced(r.fill),
            credit: parseSpaced(r.credit),
            close: parseSpaced(r.close),
            drop_amount: parseSpaced(r.drop),
            result: parseSpaced(r.result),
            source: "imported" as const,
            confirmed: true,
            created_by: user.id,
          };
        })
        .filter((r): r is NonNullable<typeof r> => Boolean(r));

      if (records.length === 0) {
        throw new Error("No matching tables in this casino for the imported rows");
      }

      const { error } = await supabase
        .from("table_daily_results")
        .upsert(records, { onConflict: "casino_id,date,table_id" });
      if (error) throw error;

      // Update / insert fin_day_closing.tables_result with Total row if available
      const totalRow = rows.find((r) => r.table.toUpperCase() === "TOTAL");
      if (totalRow) {
        const totalResult = parseSpaced(totalRow.result);
        const { data: existing } = await supabase
          .from("fin_day_closing")
          .select("id")
          .eq("casino_id", activeCasinoId)
          .eq("business_date", date)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("fin_day_closing")
            .update({ tables_result: totalResult })
            .eq("id", existing.id);
        } else {
          await supabase.from("fin_day_closing").insert({
            casino_id: activeCasinoId,
            business_date: date,
            tables_result: totalResult,
            slots_result: 0,
          });
        }
      }

      return { saved: records.length };
    },
    onSuccess: (res, vars) => {
      toast.success(`Imported ${res.saved} rows for ${vars.date}`);
      qc.invalidateQueries({ queryKey: ["table-daily-results"] });
      qc.invalidateQueries({ queryKey: ["daily-summaries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Read all daily results for the active casino in a date range. Used by /table-results. */
export const useDailyResults = (fromDate: string, toDate: string) => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["table-daily-results", activeCasinoId, fromDate, toDate],
    enabled: !!activeCasinoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_daily_results")
        .select("id, date, table_id, open, fill, credit, close, drop_amount, result, source, gaming_tables!inner(name, game)")
        .eq("casino_id", activeCasinoId!)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};
