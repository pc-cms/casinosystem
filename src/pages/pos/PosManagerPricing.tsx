/**
 * /pos/manager/pricing — Suggested price review (M9).
 * For each item with avg_cost_tzs > 0, computes suggested price:
 *   per_serving = serving_size_ml ? avg_cost * serving / bottle : avg_cost
 *   suggested = ceil(per_serving / round_step) * round_step
 * Manager can apply individual or bulk updates. Old price written to price_history by trigger.
 */
import { useMemo, useState } from "react";
import { Tag, Check, CheckSquare, Square } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCasino } from "@/lib/casino-context";
import { useAuth } from "@/lib/auth-context";
import {
  usePosMenuItems,
  usePosMenuCategories,
  useApplySuggestedPrices,
  type PosMenuItem,
} from "@/hooks/use-pos-menu";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "@/hooks/use-toast";

function suggestedPrice(it: PosMenuItem): number | null {
  const avg = Number(it.avg_cost_tzs || 0);
  if (avg <= 0) return null;
  const step = Math.max(1, Number(it.price_round_step_tzs || 500));
  const perServ =
    it.bottle_size_ml && it.serving_size_ml && it.bottle_size_ml > 0 && it.serving_size_ml > 0
      ? (avg * Number(it.serving_size_ml)) / Number(it.bottle_size_ml)
      : avg;
  return Math.ceil(perServ / step) * step;
}

export default function PosManagerPricing() {
  const { activeCasinoId } = useCasino();
  const { roles: typedRoles } = useAuth();
  const roles = typedRoles as readonly string[];
  const canEdit = roles.includes("pos_manager") || roles.includes("super_admin");

  const { data: items = [], isLoading } = usePosMenuItems(activeCasinoId);
  const { data: categories = [] } = usePosMenuCategories(activeCasinoId);
  const applyMut = useApplySuggestedPrices();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const rows = useMemo(() => {
    return items
      .filter((i) => i.is_active)
      .map((i) => {
        const sug = suggestedPrice(i);
        const delta = sug != null ? sug - i.price_tzs : 0;
        const deltaPct = sug != null && i.price_tzs > 0 ? (delta / i.price_tzs) * 100 : 0;
        return { item: i, suggested: sug, delta, deltaPct };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [items]);

  const changeable = rows.filter((r) => r.suggested != null && r.suggested !== r.item.price_tzs);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const allSelected = changeable.length > 0 && changeable.every((r) => selected.has(r.item.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(changeable.map((r) => r.item.id)));
  };

  const applyOne = async (id: string, price: number) => {
    if (!activeCasinoId) return;
    try {
      await applyMut.mutateAsync({ casino_id: activeCasinoId, updates: [{ id, price_tzs: price }] });
      toast({ title: "Price updated" });
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
    }
  };

  const applyBulk = async () => {
    if (!activeCasinoId || selected.size === 0) return;
    const updates = changeable
      .filter((r) => selected.has(r.item.id) && r.suggested != null)
      .map((r) => ({ id: r.item.id, price_tzs: r.suggested! }));
    if (updates.length === 0) return;
    try {
      await applyMut.mutateAsync({ casino_id: activeCasinoId, updates });
      toast({ title: `${updates.length} prices updated` });
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: "Bulk update failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={Tag}
        title="Pricing review"
        subtitle="Suggested prices based on moving-average purchase cost"
      >
        {canEdit && (
          <Button onClick={applyBulk} disabled={selected.size === 0 || applyMut.isPending}>
            <Check className="w-4 h-4 mr-1" />
            Apply {selected.size > 0 ? `(${selected.size})` : "selected"}
          </Button>
        )}
      </PageHeader>

      <PageSection>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center">No items.</div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  {canEdit && (
                    <th className="px-3 py-2 w-8">
                      <button onClick={toggleAll} aria-label="Toggle all">
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                  )}
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Avg cost</th>
                  <th className="px-3 py-2 text-right">Bottle / Serving</th>
                  <th className="px-3 py-2 text-right">Current price</th>
                  <th className="px-3 py-2 text-right">Suggested</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  {canEdit && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item: it, suggested, delta, deltaPct }) => {
                  const changed = suggested != null && suggested !== it.price_tzs;
                  return (
                    <tr key={it.id} className="border-t border-border">
                      {canEdit && (
                        <td className="px-3 py-2">
                          {changed && (
                            <Checkbox
                              checked={selected.has(it.id)}
                              onCheckedChange={() => toggle(it.id)}
                            />
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {catName.get(it.category_id) || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {it.avg_cost_tzs > 0 ? formatNumberSpaces(Math.round(it.avg_cost_tzs)) : "·"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {it.bottle_size_ml && it.serving_size_ml
                          ? `${it.bottle_size_ml} / ${it.serving_size_ml} ml`
                          : "·"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumberSpaces(it.price_tzs)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {suggested != null ? formatNumberSpaces(suggested) : "·"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {suggested == null ? (
                          "·"
                        ) : changed ? (
                          <span
                            className={
                              delta > 0 ? "text-cms-amount-positive" : "text-cms-amount-negative"
                            }
                          >
                            {delta > 0 ? "+" : ""}
                            {formatNumberSpaces(delta)} ({deltaPct > 0 ? "+" : ""}
                            {deltaPct.toFixed(1)}%)
                          </span>
                        ) : (
                          <Badge variant="outline">match</Badge>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2 text-right">
                          {changed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applyOne(it.id, suggested!)}
                              disabled={applyMut.isPending}
                            >
                              Apply
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}
