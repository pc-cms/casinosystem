import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clubApi, fetchShopCatalog } from "@/lib/club-api";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export default function ClubShop() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["club-shop"], queryFn: fetchShopCatalog });
  const { data: wallet } = useQuery({ queryKey: ["club-wallet"], queryFn: () => clubApi.wallet() });
  const [busyId, setBusyId] = useState<string | null>(null);

  const isVerified = wallet?.player?.verification_status === "verified";

  const order = async (id: string, price: number, casino_id: string) => {
    if (!isVerified) {
      toast.error("Complete verification to purchase");
      return;
    }
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

  if (isLoading) return <p className="text-sm" style={{ color: GOLD_DEEP }}>Loading…</p>;

  return (
    <div className="space-y-3">
      {!isVerified && (
        <Link
          to="/club/profile"
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: `${GOLD}66`, backgroundColor: "rgba(232,198,136,0.08)" }}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
          <div className="flex-1 min-w-0">
            <p className="font-faberge text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD }}>
              Get verified to shop
            </p>
            <p className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: GOLD_DEEP }}>
              Tap to complete verification
            </p>
          </div>
        </Link>
      )}

      <div className="text-sm" style={{ color: GOLD_DEEP }}>
        Your balance:{" "}
        <span className="font-mono font-semibold" style={{ color: GOLD }}>
          {formatNumberSpaces(wallet?.balance ?? 0)}
        </span>{" "}
        credits
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: GOLD_DEEP }}>No items in stock right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it: any) => (
            <li key={it.id} className="rounded-lg border bg-black/45 p-3 flex gap-3" style={{ borderColor: `${GOLD}33` }}>
              {it.photo_url && (
                <img src={it.photo_url} alt={it.name} className="w-16 h-16 rounded-md object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: GOLD }}>{it.name}</p>
                {it.description && <p className="text-xs line-clamp-2" style={{ color: GOLD_DEEP }}>{it.description}</p>}
                <p className="text-xs mt-1" style={{ color: GOLD_DEEP }}>
                  <span className="font-mono font-semibold" style={{ color: GOLD }}>{formatNumberSpaces(it.price_credits)}</span> credits ·{" "}
                  <span>{it.stock_qty} left</span>
                </p>
              </div>
              <Button
                size="sm"
                disabled={busyId === it.id || !isVerified}
                onClick={() => order(it.id, it.price_credits, it.casino_id)}
              >
                {busyId === it.id ? "…" : "Buy"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
