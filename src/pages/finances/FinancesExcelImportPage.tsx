/**
 * Excel Import — upload the historical "JC Expenses report" Excel,
 * the edge function parses it and proposes a mapping against fin_categories.
 * FM/super_admin reviews → Apply writes fin_budget rows for selected year
 * (annual planned spread evenly across 12 months).
 */
import { useState, useMemo } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFinExcelImports, useFinCategories } from "@/hooks/use-fin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fmtDateTime } from "@/lib/format-date";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";

type Row = {
  excel_name: string;
  plan_year_tzs: number;
  plan_year_usd: number;
  plan_month_tzs: number;
  plan_month_usd: number;
  actual_tzs: number;
  actual_usd: number;
  suggested_category_id: string | null;
  suggested_category_name: string | null;
  match_score: number;
  category_id?: string | null;
};

type Sheet = {
  sheet_name: string;
  detected_casino_code: "A" | "M" | "D" | "JC";
  incomes: { live_game: number; slots: number; other: number; total: number };
  sections: { group_label: string; rows: Row[] }[];
};

const CASINO_CODE_TO_NAME: Record<string, string> = { A: "Arusha", M: "Mwanza", D: "Dodoma" };

export default function FinancesExcelImportPage() {
  const qc = useQueryClient();
  const { data: imports = [] } = useFinExcelImports();
  const { data: cats = [] } = useFinCategories();
  const { data: casinos = [] } = useQuery({
    queryKey: ["casinos-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("casinos").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  // sheet_name → casino_id
  const [casinoBySheet, setCasinoBySheet] = useState<Record<string, string>>({});

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data, error } = await supabase.functions.invoke("fin-excel-import", { body: fd });
      if (error) throw error;
      const sh: Sheet[] = data.sheets || [];
      // auto-apply suggestion to category_id
      sh.forEach((s) => s.sections.forEach((sec) => sec.rows.forEach((r) => (r.category_id = r.suggested_category_id))));
      setSheets(sh);
      // auto-pick casino from code
      const m: Record<string, string> = {};
      sh.forEach((s) => {
        const name = CASINO_CODE_TO_NAME[s.detected_casino_code];
        const c = casinos.find((x: any) => x.name.toLowerCase().includes((name || "").toLowerCase()));
        if (c) m[s.sheet_name] = c.id;
      });
      setCasinoBySheet(m);
      toast.success(`Parsed ${sh.length} sheet(s)`);
    } catch (e: any) {
      toast.error(e.message || "Parse failed");
    } finally {
      setParsing(false);
    }
  };

  const apply = useMutation({
    mutationFn: async () => {
      let total = 0;
      for (const sheet of sheets) {
        const casinoId = casinoBySheet[sheet.sheet_name];
        if (!casinoId) continue; // skip JC / unmapped sheets
        const rowsToInsert: any[] = [];
        sheet.sections.forEach((sec) => {
          sec.rows.forEach((r) => {
            if (!r.category_id) return;
            const annualTzs = r.plan_year_tzs || (r.plan_month_tzs * 12);
            const annualUsd = r.plan_year_usd || (r.plan_month_usd * 12);
            const monthlyTzs = annualTzs / 12;
            const monthlyUsd = annualUsd / 12;
            for (let m = 1; m <= 12; m++) {
              if (monthlyTzs > 0) rowsToInsert.push({
                casino_id: casinoId, year, month: m, category_id: r.category_id,
                currency: "TZS", planned_amount: Math.round(monthlyTzs * 100) / 100,
              });
              if (monthlyUsd > 0) rowsToInsert.push({
                casino_id: casinoId, year, month: m, category_id: r.category_id,
                currency: "USD", planned_amount: Math.round(monthlyUsd * 100) / 100,
              });
            }
          });
        });
        if (rowsToInsert.length) {
          const { error } = await supabase
            .from("fin_budget")
            .upsert(rowsToInsert, { onConflict: "casino_id,year,month,category_id,currency" });
          if (error) throw error;
          total += rowsToInsert.length;
        }
      }
      return total;
    },
    onSuccess: (n) => {
      toast.success(`Wrote ${n} budget rows`);
      qc.invalidateQueries({ queryKey: ["fin-budget"] });
      setSheets([]);
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ready = sheets.length > 0 && Object.values(casinoBySheet).some(Boolean);

  return (
    <PageShell>
      <PageHeader icon={Upload} title="Excel Import" subtitle="Parse historical JC Expenses report → fin_budget">
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 font-mono" />
      </PageHeader>

      <PageSection title="1 · Upload Excel">
        <div className="flex items-center gap-3">
          <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-md" />
          <Button onClick={handleParse} disabled={!file || parsing}>
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Parse
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Format: 4 sheets (JC consolidated + A/M/D branches). Categories auto-mapped by name similarity.</p>
      </PageSection>

      {sheets.map((sheet) => (
        <PageSection
          key={sheet.sheet_name}
          title={sheet.sheet_name}
          titleRight={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Detected: {sheet.detected_casino_code}</span>
              <Select
                value={casinoBySheet[sheet.sheet_name] || "skip"}
                onValueChange={(v) => setCasinoBySheet((m) => ({ ...m, [sheet.sheet_name]: v === "skip" ? "" : v }))}
              >
                <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">— Skip (consolidated) —</SelectItem>
                  {casinos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="text-xs text-muted-foreground mb-2">
            Incomes (Oct): Live <b>{formatNumberSpaces(sheet.incomes.live_game)}</b> · Slots <b>{formatNumberSpaces(sheet.incomes.slots)}</b> · Total <b>{formatNumberSpaces(sheet.incomes.total)}</b>
          </div>
          {sheet.sections.map((sec) => (
            <div key={sec.group_label} className="mb-4">
              <div className="text-sm font-semibold mb-1">{sec.group_label}</div>
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1">Excel name</th>
                    <th className="text-left px-2 py-1">Mapped category</th>
                    <th className="text-right px-2 py-1">Plan/Year TZS</th>
                    <th className="text-right px-2 py-1">Plan/Year USD</th>
                    <th className="text-right px-2 py-1">Actual TZS</th>
                    <th className="text-right px-2 py-1">Actual USD</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1">{r.excel_name}</td>
                      <td className="px-2 py-1">
                        <Select
                          value={r.category_id || "none"}
                          onValueChange={(v) => {
                            r.category_id = v === "none" ? null : v;
                            setSheets((s) => [...s]);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <div className="flex items-center gap-1">
                              {r.category_id ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Skip —</SelectItem>
                            {cats.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.group_name} · {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-right font-mono px-2 py-1">{formatNumberSpaces(r.plan_year_tzs)}</td>
                      <td className="text-right font-mono px-2 py-1">{formatNumberSpaces(r.plan_year_usd)}</td>
                      <td className="text-right font-mono px-2 py-1">{formatNumberSpaces(r.actual_tzs)}</td>
                      <td className="text-right font-mono px-2 py-1">{formatNumberSpaces(r.actual_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </PageSection>
      ))}

      {sheets.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setSheets([]); setFile(null); }}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={!ready || apply.isPending}>
            {apply.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply → fin_budget ({year})
          </Button>
        </div>
      )}

      <PageSection title="Recent imports">
        {!imports.length && <div className="text-sm text-muted-foreground text-center py-4">No imports logged yet</div>}
        {imports.map((i: any) => (
          <div key={i.id} className="flex justify-between border-b border-border py-1.5 text-sm">
            <span>{i.filename}</span>
            <span className="text-xs text-muted-foreground">{i.target_kind} · {i.status} · {fmtDateTime(i.created_at)}</span>
          </div>
        ))}
      </PageSection>
    </PageShell>
  );
}
