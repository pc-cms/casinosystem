import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DateNavigator } from "@/components/ui/date-navigator";
import { Ban } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";

type Row = {
  id: string;
  transaction_id: string;
  casino_id: string;
  player_id: string;
  shift_id: string | null;
  business_date: string | null;
  tx_type: string;
  amount: number;
  reason: string;
  cancelled_by: string;
  cancelled_at: string;
  players?: { first_name: string; last_name: string; nickname: string | null } | null;
  cashier?: { full_name: string | null } | null;
};

const CancelledTransactions = () => {
  const { casinoId } = useAuth();
  const { data: today } = useEffectiveBusinessDate();
  const [date, setDate] = useState<string>(today || new Date().toISOString().slice(0, 10));

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transaction_cancellations", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("transaction_cancellations" as any)
        .select("*, players(first_name,last_name,nickname), cashier:profiles!cancelled_by(full_name)")
        .eq("casino_id", casinoId)
        .eq("business_date", date)
        .order("cancelled_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as Row[];
    },
    enabled: !!casinoId,
  });

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows]);

  return (
    <PageShell>
      <PageHeader
        icon={Ban}
        title="Cancelled Transactions"
        subtitle="Audit log of every cancelled IN/OUT for the business day"
        date
      >
        <DateNavigator value={date} onChange={setDate} />
      </PageHeader>

      <div className="cms-panel mb-3 p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{rows.length} cancellations</span>
        <span className="font-mono text-base font-bold">Total: {formatCurrency(total)}</span>
      </div>

      <div className="cms-panel">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card sticky top-0 z-10">
              <tr className="border-b border-border">
                {["Time", "Cashier", "Player", "Type", "Amount", "Reason"].map(h => (
                  <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-2 ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6 text-sm">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6 text-sm">No cancellations on this day</td></tr>
              ) : rows.map(r => {
                const isIn = r.tx_type === "buy" || r.tx_type === "in";
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{fmtDateTime(r.cancelled_at)}</td>
                    <td className="px-3 py-2 text-sm">{r.cashier?.full_name || "—"}</td>
                    <td className="px-3 py-2 text-sm">{r.players?.first_name} {r.players?.last_name}{r.players?.nickname ? ` (${r.players.nickname})` : ""}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isIn ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                        {isIn ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-sm ${isIn ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      {formatCurrency(Number(r.amount))}
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{r.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
};

export default CancelledTransactions;
