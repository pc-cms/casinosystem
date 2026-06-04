import { useMemo, useState } from "react";
import { Wallet, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import { useAuth } from "@/lib/auth-context";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format-date";
import { downloadXlsx } from "@/lib/excel-export";

const fmt = (n: number) => (n ?? 0).toLocaleString("fr-FR").replace(/,/g, " ");

const AmBudgetPage = () => {
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: balances = [] } = useQuery({
    queryKey: ["am_budgets_self", user?.id, activeCasinoId],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("am_budgets")
        .select("id, casino_id, balance, updated_at, casinos(name)")
        .eq("am_user_id", user.id);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!user?.id,
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["am_budget_ledger", user?.id, activeCasinoId, reasonFilter, fromDate, toDate],
    queryFn: async () => {
      if (!user?.id) return [];
      let q = supabase
        .from("am_budget_ledger")
        .select("id, casino_id, delta, reason, ref_type, ref_id, created_at, casinos(name)")
        .eq("am_user_id", user.id);
      if (activeCasinoId) q = q.eq("casino_id", activeCasinoId);
      if (reasonFilter !== "all") q = q.ilike("reason", `%${reasonFilter}%`);
      if (fromDate) q = q.gte("created_at", fromDate);
      if (toDate) q = q.lte("created_at", `${toDate}T23:59:59`);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!user?.id,
  });

  const totals = useMemo(() => {
    let topup = 0n, spent = 0n;
    for (const r of ledger) {
      const d = BigInt(r.delta ?? 0);
      if (d > 0n) topup += d; else spent += d;
    }
    return { topup: Number(topup), spent: Number(spent), current: balances.reduce((s, b) => s + Number(b.balance || 0), 0) };
  }, [ledger, balances]);

  const exportCsv = async () => {
    const rows: (string | number | null)[][] = [
      ["Date", "Casino", "Reason", "Ref Type", "Delta"],
      ...ledger.map((r) => [
        fmtDateTime(r.created_at),
        r.casinos?.name ?? "—",
        r.reason,
        r.ref_type ?? "",
        Number(r.delta ?? 0),
      ]),
    ];
    await downloadXlsx(`am-budget-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: "Ledger", rows }]);
  };

  return (
    <PageShell>
      <PageHeader title="My AM Budget" icon={Wallet}>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </PageHeader>

      <PageSection title="Balances">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">No budget allocated yet. Ask Finance Manager to top up.</p>
          ) : balances.map((b) => (
            <div key={b.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs uppercase text-muted-foreground tracking-wider">{b.casinos?.name ?? "—"}</p>
              <p className="font-mono text-2xl font-bold mt-1">{fmt(b.balance)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">credits</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
          <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Top-ups (filtered)</p><p className="font-mono font-bold cms-amount-positive">+{fmt(totals.topup)}</p></div>
          <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Issued (filtered)</p><p className="font-mono font-bold cms-amount-negative">{fmt(totals.spent)}</p></div>
          <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Current total</p><p className="font-mono font-bold">{fmt(totals.current)}</p></div>
        </div>
      </PageSection>

      <PageSection title="Ledger">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="top">Top-up</SelectItem>
                <SelectItem value="grant">Grant / issue</SelectItem>
                <SelectItem value="cashback">Cashback</SelectItem>
                <SelectItem value="reversal">Reversal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        </div>

        <DataTable
          columns={[
            { key: "date", header: "Date", render: (r: any) => fmtDateTime(r.created_at) },
            { key: "casino", header: "Casino", render: (r: any) => r.casinos?.name ?? "—" },
            { key: "reason", header: "Reason", render: (r: any) => <Badge variant="outline">{r.reason}</Badge> },
            { key: "ref", header: "Ref", render: (r: any) => r.ref_type ?? "—" },
            { key: "delta", header: "Delta", align: "right", render: (r: any) => (
              <span className={`font-mono font-bold ${Number(r.delta) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {Number(r.delta) >= 0 ? "+" : ""}{fmt(Number(r.delta))}
              </span>
            ) },
          ]}
          rows={ledger}
          rowKey={(r: any) => r.id}
          emptyMessage="No ledger entries"
        />
      </PageSection>
    </PageShell>
  );
};

export default AmBudgetPage;
