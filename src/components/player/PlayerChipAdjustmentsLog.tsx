/**
 * PlayerChipAdjustmentsLog — chronological audit log of manual chip in/out
 * adjustments recorded from the Player Preview header.
 */
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { usePlayerChipAdjustments } from "@/hooks/use-player-chip-adjustments";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";

interface Props {
  playerId: string;
  limit?: number;
}

const PlayerChipAdjustmentsLog = ({ playerId, limit }: Props) => {
  const { data: rows = [], isLoading } = usePlayerChipAdjustments(playerId);
  const list = limit ? rows.slice(0, limit) : rows;

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-2">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No chip adjustments recorded.</p>;
  }

  let inSum = 0, outSum = 0;
  for (const r of rows) { inSum += Number(r.chip_in) || 0; outSum += Number(r.chip_out) || 0; }
  const delta = inSum - outSum;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge variant="outline" className="font-mono">{rows.length} entr{rows.length === 1 ? "y" : "ies"}</Badge>
        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15 font-mono">+ In: {formatNumberSpaces(inSum)}</Badge>
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15 font-mono">− Out: {formatNumberSpaces(outSum)}</Badge>
        <Badge variant="outline" className={`font-mono ${delta > 0 ? "cms-amount-positive" : delta < 0 ? "cms-amount-negative" : ""}`}>
          Δ {delta > 0 ? "+" : ""}{formatNumberSpaces(delta)}
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2 text-left">When</th>
              <th className="px-2 py-2 text-right">Chip IN</th>
              <th className="px-2 py-2 text-right">Chip OUT</th>
              <th className="px-2 py-2 text-left">Comment</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                <td className="px-2 py-1.5 font-mono text-[11px] whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {r.chip_in > 0 ? (
                    <span className="inline-flex items-center gap-1 cms-amount-positive font-semibold">
                      <ArrowDownToLine className="w-3 h-3" />+{formatNumberSpaces(r.chip_in)}
                    </span>
                  ) : <span className="text-muted-foreground/60">·</span>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {r.chip_out > 0 ? (
                    <span className="inline-flex items-center gap-1 cms-amount-negative font-semibold">
                      <ArrowUpFromLine className="w-3 h-3" />−{formatNumberSpaces(r.chip_out)}
                    </span>
                  ) : <span className="text-muted-foreground/60">·</span>}
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground truncate max-w-[320px]">
                  {r.note || <span className="text-muted-foreground/60">·</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit && rows.length > limit && (
        <p className="text-[10px] text-muted-foreground text-center">Showing latest {limit} of {rows.length}</p>
      )}
    </div>
  );
};

export default PlayerChipAdjustmentsLog;
