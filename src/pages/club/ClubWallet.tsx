import { useQuery } from "@tanstack/react-query";
import { clubApi, getClubToken } from "@/lib/club-api";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { Sparkles, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ClubWallet() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["club-wallet"],
    queryFn: () => clubApi.wallet(),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data?.player) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="font-semibold">No player record</p>
        <p className="text-sm text-muted-foreground">
          Visit reception to register your account, then come back.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 shadow-lg">
        <p className="text-xs uppercase tracking-wider opacity-80">Promo balance</p>
        <p className="text-4xl font-bold font-mono tabular-nums mt-1">
          {formatNumberSpaces(data.balance)}
        </p>
        <p className="text-xs opacity-80 mt-1">credits</p>
        <p className="text-xs opacity-90 mt-3">
          {data.player.first_name} {data.player.last_name}
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-2">Active grants</h3>
        {data.grants.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active grants.</p>
        ) : (
          <ul className="space-y-2">
            {data.grants.map((g) => (
              <li key={g.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{g.source}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {g.expires_at ? fmtDateTime(g.expires_at) : "never"}
                  </p>
                </div>
                <p className="font-mono font-semibold">{formatNumberSpaces(g.remaining)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <Sparkles className="w-4 h-4" /> Recent redemptions
        </h3>
        {data.redemptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs border-b border-border py-1.5">
                <span className="text-muted-foreground">
                  {fmtDateTime(r.created_at)} · {r.payout_type}
                </span>
                <span className="font-mono">−{formatNumberSpaces(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
