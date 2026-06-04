import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clubApi, fetchShopCatalog } from "@/lib/club-api";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";

export default function ClubShop() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["club-shop"], queryFn: fetchShopCatalog });
  const { data: wallet } = useQuery({ queryKey: ["club-wallet"], queryFn: () => clubApi.wallet() });
  const [busyId, setBusyId] = useState<string | null>(null);

  const order = async (id: string, price: number, casino_id: string) => {
    if ((wallet?.balance ?? 0) < price) {
      toast.error("Insufficient balance");
      return;
    }
    setBusyId(id);
    try {
      await clubApi.placeShopOrder(id, 1, casino_id);
      toast.success("Order placed — pick up at cage");
      qc.invalidateQueries({ queryKey: ["club-wallet"] });
      qc.invalidateQueries({ queryKey: ["club-shop"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Your balance:{" "}
        <span className="font-mono font-semibold text-foreground">
          {formatNumberSpaces(wallet?.balance ?? 0)}
        </span>{" "}
        credits
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items in stock right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it: any) => (
            <li key={it.id} className="rounded-lg border border-border bg-card p-3 flex gap-3">
              {it.photo_url && (
                <img src={it.photo_url} alt={it.name} className="w-16 h-16 rounded-md object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{it.name}</p>
                {it.description && <p className="text-xs text-muted-foreground line-clamp-2">{it.description}</p>}
                <p className="text-xs mt-1">
                  <span className="font-mono font-semibold">{formatNumberSpaces(it.price_credits)}</span> credits ·{" "}
                  <span className="text-muted-foreground">{it.stock_qty} left</span>
                </p>
              </div>
              <Button size="sm" disabled={busyId === it.id} onClick={() => order(it.id, it.price_credits, it.casino_id)}>
                {busyId === it.id ? "…" : "Buy"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
