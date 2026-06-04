import { useQuery } from "@tanstack/react-query";
import { fetchLotteries } from "@/lib/club-api";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";

export default function ClubTickets() {
  const { data: lotteries = [], isLoading } = useQuery({ queryKey: ["club-lotteries"], queryFn: fetchLotteries });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Open lotteries</h2>
      {lotteries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open draws right now.</p>
      ) : (
        <ul className="space-y-2">
          {lotteries.map((l: any) => (
            <li key={l.id} className="rounded-lg border border-border bg-card p-3">
              <p className="font-semibold">{l.name}</p>
              {l.description && <p className="text-xs text-muted-foreground mt-1">{l.description}</p>}
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">Draws {fmtDate(l.draw_date)}</span>
                <span className="font-mono font-semibold">
                  {formatNumberSpaces(l.ticket_price_credits)} credits / ticket
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground pt-4">
        Ticket purchase opens soon. Draw is offline — winners are contacted by the casino.
      </p>
    </div>
  );
}
