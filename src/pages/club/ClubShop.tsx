import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clubApi, fetchShopCatalog } from "@/lib/club-api";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";
import { ShieldAlert, ShoppingBag, X } from "lucide-react";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export default function ClubShop() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["club-shop"], queryFn: fetchShopCatalog });
  const { data: wallet } = useQuery({ queryKey: ["club-wallet"], queryFn: () => clubApi.wallet() });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const isVerified = wallet?.player?.verification_status === "verified";
  const playerCasinoId: string | undefined = wallet?.player?.casino_id;
  const balance = wallet?.balance ?? 0;

  const order = async (id: string, price: number, itemCasinoId: string | null) => {
    if (!isVerified) {
      toast.error("Complete verification to purchase");
      return;
    }
    if (balance < price) {
      toast.error("Insufficient balance");
      return;
    }
    const casinoId = itemCasinoId ?? playerCasinoId;
    if (!casinoId) {
      toast.error("No home casino on your profile");
      return;
    }
    setBusyId(id);
    try {
      await clubApi.placeShopOrder(id, 1, casinoId);
      toast.success("Order placed — pick up at the cage");
      setOpenId(null);
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
    <div className="space-y-4">
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

      {/* Balance strip */}
      <div
        className="rounded-xl border px-4 py-3 flex items-center justify-between backdrop-blur-sm"
        style={{ borderColor: `${GOLD}33`, backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>
          Your balance
        </span>
        <span className="font-faberge text-lg tabular-nums" style={{ color: GOLD }}>
          {formatNumberSpaces(balance)} <span className="text-[10px] tracking-[0.3em]" style={{ color: GOLD_DEEP }}>credits</span>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: GOLD_DEEP }}>
          No items in stock right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((it: any) => {
            const isOpen = openId === it.id;
            const affordable = balance >= it.price_credits;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setOpenId(isOpen ? null : it.id)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden border text-left focus:outline-none transition-all duration-500"
                style={{
                  borderColor: `${GOLD}44`,
                  boxShadow: isOpen
                    ? `inset 0 8px 24px rgba(0,0,0,0.85), inset 0 -2px 6px rgba(232,198,136,0.25), 0 0 0 1px ${GOLD}66`
                    : "0 10px 24px -12px rgba(0,0,0,0.7)",
                  transform: isOpen ? "scale(0.97)" : "scale(1)",
                }}
              >
                {/* Image */}
                {it.photo_url ? (
                  <img
                    src={it.photo_url}
                    alt={it.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
                    style={{ transform: isOpen ? "scale(1.08)" : "scale(1.0)", filter: isOpen ? "brightness(0.35)" : "brightness(0.85)" }}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ backgroundColor: "#1a0004" }} />
                )}

                {/* Static gradient for legibility */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.92) 100%)",
                  }}
                />

                {/* Front face: name + price */}
                <div
                  className="absolute inset-x-0 bottom-0 p-3 transition-opacity duration-300"
                  style={{ opacity: isOpen ? 0 : 1 }}
                >
                  <p className="font-faberge text-[11px] leading-tight line-clamp-2" style={{ color: GOLD }}>
                    {it.name}
                  </p>
                  <p className="mt-1.5 font-faberge text-base tabular-nums" style={{ color: GOLD }}>
                    {formatNumberSpaces(it.price_credits)}
                    <span className="ml-1 text-[9px] tracking-[0.3em]" style={{ color: GOLD_DEEP }}>
                      cr
                    </span>
                  </p>
                </div>

                {/* Stock pill */}
                <span
                  className="absolute top-2 right-2 text-[9px] tracking-[0.25em] uppercase rounded-full px-2 py-0.5 backdrop-blur-sm"
                  style={{
                    color: GOLD,
                    backgroundColor: "rgba(0,0,0,0.55)",
                    border: `1px solid ${GOLD}55`,
                  }}
                >
                  {it.stock_qty} left
                </span>

                {/* Back face: description + buy */}
                <div
                  className="absolute inset-0 flex flex-col p-3 transition-opacity duration-500"
                  style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-faberge text-[11px] tracking-[0.1em] leading-tight" style={{ color: GOLD }}>
                      {it.name}
                    </p>
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ color: GOLD, backgroundColor: "rgba(0,0,0,0.55)", border: `1px solid ${GOLD}55` }}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </div>

                  <p
                    className="mt-2 text-[10px] leading-snug overflow-y-auto pr-1"
                    style={{ color: "rgba(232,198,136,0.85)" }}
                  >
                    {it.description || "No description."}
                  </p>

                  <div className="mt-auto pt-2 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[9px] tracking-[0.3em] uppercase" style={{ color: GOLD_DEEP }}>
                        Price
                      </span>
                      <span className="font-faberge text-base tabular-nums" style={{ color: GOLD }}>
                        {formatNumberSpaces(it.price_credits)}{" "}
                        <span className="text-[9px] tracking-[0.3em]" style={{ color: GOLD_DEEP }}>cr</span>
                      </span>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (busyId === it.id) return;
                        order(it.id, it.price_credits, it.casino_id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (busyId !== it.id) order(it.id, it.price_credits, it.casino_id);
                        }
                      }}
                      aria-disabled={busyId === it.id || !isVerified || !affordable}
                      className="w-full h-9 rounded-md font-faberge text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-1.5 select-none"
                      style={{
                        backgroundColor: !isVerified || !affordable ? "rgba(232,198,136,0.25)" : GOLD,
                        color: "#0a0a0a",
                        opacity: busyId === it.id ? 0.6 : 1,
                        cursor: !isVerified || !affordable ? "not-allowed" : "pointer",
                      }}
                    >
                      {busyId === it.id ? (
                        "…"
                      ) : !isVerified ? (
                        "Verify to buy"
                      ) : !affordable ? (
                        "Not enough credits"
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" /> Order now
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
