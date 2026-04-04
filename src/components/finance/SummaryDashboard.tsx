/**
 * FM Summary Dashboard — aggregated KPIs across all casinos.
 * Only visible to finance_manager and super_admin.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberSpaces } from "@/lib/currency";
import { Building2, TrendingUp, Wallet, Users, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CasinoSummary = {
  casino_id: string;
  casino_name: string;
  total_balance: number;
  today_result: number;
  monthly_net: number;
  visitors_today: number;
  open_shift: boolean;
};

const useSummaryData = () => {
  const { accessibleCasinos } = useCasino();

  return useQuery({
    queryKey: ["fm-summary", accessibleCasinos.map(c => c.id)],
    enabled: accessibleCasinos.length > 0,
    queryFn: async (): Promise<CasinoSummary[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const currentMonth = today.slice(0, 7);
      const casinoIds = accessibleCasinos.map(c => c.id);

      // Parallel queries
      const [walletsRes, summariesRes, visitsRes, shiftsRes] = await Promise.all([
        supabase.from("financial_wallets").select("casino_id, current_balance").in("casino_id", casinoIds),
        supabase.from("daily_summaries").select("casino_id, date, total_result, total_expenses").in("casino_id", casinoIds).gte("date", `${currentMonth}-01`),
        supabase.from("casino_visits").select("casino_id").in("casino_id", casinoIds).eq("date", today).is("checked_out_at", null),
        supabase.from("shifts").select("casino_id, status").in("casino_id", casinoIds).eq("status", "open"),
      ]);

      const wallets = walletsRes.data ?? [];
      const summaries = summariesRes.data ?? [];
      const visits = visitsRes.data ?? [];
      const shifts = shiftsRes.data ?? [];

      return accessibleCasinos.map(casino => {
        const casinoWallets = wallets.filter(w => w.casino_id === casino.id);
        const totalBalance = casinoWallets.reduce((s, w) => s + Number(w.current_balance), 0);

        const todaySummary = summaries.find(s => s.casino_id === casino.id && s.date === today);
        const todayResult = todaySummary ? Number(todaySummary.total_result) : 0;

        const monthSummaries = summaries.filter(s => s.casino_id === casino.id);
        const monthlyNet = monthSummaries.reduce((s, d) => s + Number(d.total_result) - Number(d.total_expenses), 0);

        const visitorsToday = visits.filter(v => v.casino_id === casino.id).length;
        const openShift = shifts.some(s => s.casino_id === casino.id);

        return {
          casino_id: casino.id,
          casino_name: casino.name,
          total_balance: totalBalance,
          today_result: todayResult,
          monthly_net: monthlyNet,
          visitors_today: visitorsToday,
          open_shift: openShift,
        };
      });
    },
    refetchInterval: 60_000,
  });
};

export const SummaryDashboard = () => {
  const { data: summaries = [], isLoading } = useSummaryData();
  const { switchCasino } = useCasino();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const grandTotal = summaries.reduce((s, c) => s + c.total_balance, 0);
  const grandMonthly = summaries.reduce((s, c) => s + c.monthly_net, 0);
  const grandToday = summaries.reduce((s, c) => s + c.today_result, 0);
  const grandVisitors = summaries.reduce((s, c) => s + c.visitors_today, 0);

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AggCard icon={Wallet} label="Grand Total" value={grandTotal} />
        <AggCard icon={TrendingUp} label="Monthly Net" value={grandMonthly} colored />
        <AggCard icon={Building2} label="Today (All)" value={grandToday} colored />
        <AggCard icon={Users} label="Visitors Now" value={grandVisitors} raw />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map(c => (
          <Card key={c.casino_id} className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">{c.casino_name}</CardTitle>
                <Badge variant={c.open_shift ? "default" : "secondary"} className="text-[10px]">
                  {c.open_shift ? "OPEN" : "CLOSED"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => switchCasino(c.casino_id)}
              >
                View <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-mono font-bold">{formatNumberSpaces(c.total_balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className={`font-mono font-bold ${c.today_result >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {c.today_result > 0 ? "+" : ""}{formatNumberSpaces(c.today_result)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Net</p>
                  <p className={`font-mono font-bold ${c.monthly_net >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {c.monthly_net > 0 ? "+" : ""}{formatNumberSpaces(c.monthly_net)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Visitors</p>
                  <p className="font-mono font-bold">{c.visitors_today}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const AggCard = ({ icon: Icon, label, value, colored, raw }: {
  icon: any; label: string; value: number; colored?: boolean; raw?: boolean;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${colored ? (value >= 0 ? "text-emerald-500" : "text-destructive") : ""}`}>
        {raw ? value : formatNumberSpaces(value)}
      </p>
    </CardContent>
  </Card>
);
