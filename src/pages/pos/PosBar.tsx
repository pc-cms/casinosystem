/**
 * POS Bar Display — kanban (pending → preparing → ready) for the bartender.
 * Realtime; advance buttons move orders forward; 'ready' → 'served' archives.
 */
import { useMemo } from "react";
import { useCasino } from "@/lib/casino-context";
import { usePosBarOrders, useAdvancePosOrder, type PosBarOrder } from "@/hooks/use-pos-bar-orders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Check, Clock, Flame } from "lucide-react";
import type { PosOrderStatus } from "@/hooks/use-pos-orders";
import { toast } from "sonner";

const COLS: { key: PosOrderStatus; title: string; icon: typeof Clock; next?: "preparing" | "ready" | "served"; nextLabel?: string }[] = [
  { key: "pending",   title: "New",       icon: Clock, next: "preparing", nextLabel: "Start" },
  { key: "preparing", title: "Preparing", icon: Flame, next: "ready",     nextLabel: "Ready" },
  { key: "ready",     title: "Ready",     icon: Check, next: "served",    nextLabel: "Served" },
];

function ageMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function tabLabel(o: PosBarOrder): string {
  return o.tab?.player_name || o.tab?.walkin_label || "Walk-in";
}

function OrderCard({ order, onAdvance }: { order: PosBarOrder; onAdvance?: () => void }) {
  const age = ageMinutes(order.created_at);
  const urgent = age >= 10 && order.status !== "ready";
  return (
    <Card className={`p-3 ${urgent ? "border-destructive" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold truncate">{tabLabel(order)}</div>
        <Badge variant={urgent ? "destructive" : "secondary"} className="shrink-0">
          {age}m
        </Badge>
      </div>
      <ul className="text-sm space-y-1 mb-3">
        {order.items.map((it) => (
          <li key={it.id} className="flex justify-between gap-2">
            <span className="truncate">{it.item_name}</span>
            <span className="text-muted-foreground shrink-0">×{it.qty}</span>
          </li>
        ))}
      </ul>
      {onAdvance && (
        <Button size="sm" className="w-full" onClick={onAdvance}>
          {COLS.find((c) => c.key === order.status)?.nextLabel}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}

export default function PosBar() {
  const { activeCasinoId } = useCasino();
  const { data: orders = [], isLoading } = usePosBarOrders(activeCasinoId);
  const advance = useAdvancePosOrder();

  const grouped = useMemo(() => {
    const m: Record<PosOrderStatus, PosBarOrder[]> = { pending: [], preparing: [], ready: [], served: [], void: [] };
    for (const o of orders) m[o.status]?.push(o);
    return m;
  }, [orders]);

  const handleAdvance = (o: PosBarOrder, to: "preparing" | "ready" | "served") => {
    advance.mutate(
      { order_id: o.id, to },
      {
        onSuccess: () => {
          if (to === "ready") toast.success(`Ready: ${tabLabel(o)}`);
          if (to === "served") toast.success(`Served: ${tabLabel(o)}`);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h1 className="text-xl font-semibold">Bar Display</h1>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${orders.length} active`}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
        {COLS.map((col) => {
          const Icon = col.icon;
          const items = grouped[col.key] ?? [];
          return (
            <div key={col.key} className="flex flex-col min-h-0 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 border-b">
                <Icon className="h-4 w-4" />
                <span className="font-medium">{col.title}</span>
                <Badge variant="outline" className="ml-auto">{items.length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-6">·</div>
                ) : (
                  items.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onAdvance={col.next ? () => handleAdvance(o, col.next!) : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
