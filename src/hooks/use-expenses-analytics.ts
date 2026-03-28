import { useMemo } from "react";

interface Expense {
  id: string;
  category: string;
  amount: number;
  player_id: string | null;
  approved: boolean;
  created_at: string;
  players?: { first_name: string; last_name: string } | null;
}

export const useExpenseAnalytics = (expenses: Expense[], dateRange?: { from: string; to: string }) => {
  return useMemo(() => {
    let filtered = expenses;
    if (dateRange?.from) {
      filtered = filtered.filter(e => e.created_at >= `${dateRange.from}T00:00:00`);
    }
    if (dateRange?.to) {
      filtered = filtered.filter(e => e.created_at <= `${dateRange.to}T23:59:59`);
    }

    const totalAmount = filtered.reduce((s, e) => s + Number(e.amount), 0);
    const approvedAmount = filtered.filter(e => e.approved).reduce((s, e) => s + Number(e.amount), 0);
    const pendingAmount = filtered.filter(e => !e.approved).reduce((s, e) => s + Number(e.amount), 0);
    const pendingCount = filtered.filter(e => !e.approved).length;

    // By category
    const byCategory: Record<string, { total: number; count: number }> = {};
    filtered.forEach(e => {
      if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 };
      byCategory[e.category].total += Number(e.amount);
      byCategory[e.category].count += 1;
    });

    // By player (only those linked to a player)
    const byPlayer: Record<string, { name: string; total: number; count: number }> = {};
    filtered.filter(e => e.player_id && e.players).forEach(e => {
      const pid = e.player_id!;
      if (!byPlayer[pid]) {
        byPlayer[pid] = {
          name: `${e.players!.first_name} ${e.players!.last_name}`,
          total: 0,
          count: 0,
        };
      }
      byPlayer[pid].total += Number(e.amount);
      byPlayer[pid].count += 1;
    });

    const topPlayers = Object.entries(byPlayer)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    return {
      filtered,
      totalAmount,
      approvedAmount,
      pendingAmount,
      pendingCount,
      byCategory,
      topPlayers,
    };
  }, [expenses, dateRange?.from, dateRange?.to]);
};
