/**
 * PlayerChipTransfersLog — chronological IN/OUT timeline of chip transfers
 * for a single player, with cross-link to the counterparty (pair_id mate).
 *
 * Rules:
 * - Pure presentation; consumes `usePlayerChipTransfers(playerId)`.
 * - Each row shows direction, signed amount, counterparty link, table id,
 *   note, and operator/time.
 * - `pair_id` is shown as a 6-char chip (deterministic) so two sides of the
 *   same transfer are visually grouped across players.
 * - Hidden for users without lifetime financial access (role-controlled at parent).
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlayers } from "@/hooks/use-players";
import { usePlayerChipTransfers } from "@/hooks/use-chip-transfers";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";

interface Props {
  playerId: string;
  /** Optional: limit rows shown initially. */
  limit?: number;
}

const shortPair = (id: string) => id.slice(0, 6).toUpperCase();

const PlayerChipTransfersLog = ({ playerId, limit }: Props) => {
  const { data: transfers = [], isLoading } = usePlayerChipTransfers(playerId);
  const { data: players = [] } = usePlayers();

  const playerById = useMemo(() => {
    const m = new Map<string, any>();
    (players as any[]).forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const rows = useMemo(() => {
    const list = limit ? transfers.slice(0, limit) : transfers;
    return list;
  }, [transfers, limit]);

  // Aggregate totals
  const totals = useMemo(() => {
    let inSum = 0, outSum = 0;
    for (const t of transfers) {
      if (t.direction === "in") inSum += Number(t.amount) || 0;
      else outSum += Number(t.amount) || 0;
    }
    return { inSum, outSum, delta: inSum - outSum, count: transfers.length };
  }, [transfers]);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-2">Loading chip transfers…</p>;
  }

  if (transfers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No chip transfers recorded for this player.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Lifetime totals strip */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge variant="outline" className="font-mono">
          {totals.count} transfer{totals.count === 1 ? "" : "s"}
        </Badge>
        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15 font-mono">
          ↓ In: {formatNumberSpaces(totals.inSum)}
        </Badge>
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15 font-mono">
          ↑ Out: {formatNumberSpaces(totals.outSum)}
        </Badge>
        <Badge
          variant="outline"
          className={`font-mono ${totals.delta > 0 ? "cms-amount-positive" : totals.delta < 0 ? "cms-amount-negative" : ""}`}
        >
          Δ {totals.delta > 0 ? "+" : ""}{formatNumberSpaces(totals.delta)}
        </Badge>
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2 text-left">When</th>
              <th className="px-2 py-2 text-left">Dir</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-left">Counterparty</th>
              <th className="px-2 py-2 text-left">Pair</th>
              <th className="px-2 py-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t: any) => {
              const isIn = t.direction === "in";
              const cp = playerById.get(t.counterparty_player_id);
              const cpLabel = cp
                ? `${cp.first_name} ${cp.last_name}${cp.nickname ? ` "${cp.nickname}"` : ""}`
                : "Unknown player";
              return (
                <tr key={t.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-1.5 font-mono text-[11px] whitespace-nowrap">
                    {fmtDateTime(t.created_at)}
                  </td>
                  <td className="px-2 py-1.5">
                    {isIn ? (
                      <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15 text-[10px] gap-1">
                        <ArrowDownToLine className="w-3 h-3" /> IN
                      </Badge>
                    ) : (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15 text-[10px] gap-1">
                        <ArrowUpFromLine className="w-3 h-3" /> OUT
                      </Badge>
                    )}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono font-semibold ${isIn ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {isIn ? "+" : "−"}{formatNumberSpaces(Number(t.amount))}
                  </td>
                  <td className="px-2 py-1.5">
                    {cp ? (
                      <Link
                        to={`/players/${cp.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        title={isIn ? "Donor — click to view" : "Recipient — click to view"}
                      >
                        {cpLabel}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unknown player</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] gap-1"
                      title={`Pair ID: ${t.pair_id}\nLinks the matching ${isIn ? "OUT" : "IN"} record on ${cpLabel}`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      {shortPair(t.pair_id)}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-muted-foreground truncate max-w-[240px]">
                    {t.note || <span className="text-muted-foreground/60">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {limit && transfers.length > limit && (
        <p className="text-[10px] text-muted-foreground text-center">
          Showing latest {limit} of {transfers.length}
        </p>
      )}
    </div>
  );
};

export default PlayerChipTransfersLog;
