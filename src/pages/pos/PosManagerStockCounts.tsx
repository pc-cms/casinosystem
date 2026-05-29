/**
 * PosManagerStockCounts — variance report from bartender shelf counts.
 * Lists count events (most recent first). Expanding a row reveals per-item
 * expected / counted / variance with TZS impact at moving-average cost.
 */
import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSection } from "@/components/layout/PageSection";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Boxes } from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  usePosStockCounts,
  usePosStockCountItems,
} from "@/hooks/use-pos-stock-counts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";

function useItemNames() {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["pos-item-names", activeCasinoId],
    enabled: !!activeCasinoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_menu_items")
        .select("id, name")
        .eq("casino_id", activeCasinoId!);
      if (error) throw error;
      return new Map((data ?? []).map((r: any) => [r.id as string, r.name as string]));
    },
  });
}

const TYPE_BADGE: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  handover: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  close: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  adhoc: "bg-muted text-muted-foreground",
};

const PosManagerStockCounts = () => {
  const { data: counts = [], isLoading } = usePosStockCounts(100);
  const { data: itemNames } = useItemNames();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <PageShell>
      <PageHeader title="Stock variance" subtitle="Bartender shelf counts vs system stock" icon={Boxes} />
      <PageSection>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : counts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No stock counts recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Bartender</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Variance (TZS)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map((c) => {
                const expanded = openId === c.id;
                const varianceCls =
                  c.total_variance_value_tzs > 0
                    ? "cms-amount-positive"
                    : c.total_variance_value_tzs < 0
                      ? "cms-amount-negative"
                      : "text-muted-foreground";
                return (
                  <>
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(expanded ? null : c.id)}>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{fmtDateTime(c.created_at)}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px] uppercase", TYPE_BADGE[c.count_type] ?? TYPE_BADGE.adhoc)}>
                          {c.count_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{c.counted_by_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{c.items_count}</TableCell>
                      <TableCell className={cn("text-right font-mono tabular-nums font-semibold", varianceCls)}>
                        {c.total_variance_value_tzs > 0 ? "+" : ""}
                        {formatNumberSpaces(c.total_variance_value_tzs)}
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow key={`${c.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/20 p-3">
                          <CountDetail countId={c.id} itemNames={itemNames} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </PageSection>
    </PageShell>
  );
};

const CountDetail = ({ countId, itemNames }: { countId: string; itemNames?: Map<string, string> }) => {
  const { data: items = [], isLoading } = usePosStockCountItems(countId);
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading items…</p>;
  if (items.length === 0) return <p className="text-xs text-muted-foreground italic">No items.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Counted</TableHead>
          <TableHead className="text-right">Δ qty</TableHead>
          <TableHead className="text-right">Unit cost</TableHead>
          <TableHead className="text-right">Δ value (TZS)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((it) => {
          const cls =
            it.variance_value_tzs > 0
              ? "cms-amount-positive"
              : it.variance_value_tzs < 0
                ? "cms-amount-negative"
                : "text-muted-foreground";
          return (
            <TableRow key={it.id}>
              <TableCell className="text-xs">{itemNames?.get(it.item_id) ?? it.item_id.slice(0, 8)}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">{it.expected_qty}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">{it.counted_qty}</TableCell>
              <TableCell className={cn("text-right font-mono text-xs tabular-nums", cls)}>
                {it.variance_qty > 0 ? "+" : ""}
                {it.variance_qty}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                {formatNumberSpaces(it.unit_cost_tzs)}
              </TableCell>
              <TableCell className={cn("text-right font-mono text-xs tabular-nums font-semibold", cls)}>
                {it.variance_value_tzs > 0 ? "+" : ""}
                {formatNumberSpaces(it.variance_value_tzs)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default PosManagerStockCounts;
