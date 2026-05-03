/**
 * Surveillance Cage view — strictly read-only history with 4 tabs:
 *  · IN/OUT       — transactions for the picked business date
 *  · Cashless     — cashless_transactions for the date
 *  · Cage Transfers — Add Float / Collection / Fill / Credit
 *  · Chip Transfers — paired player↔player chip moves (with "New Transfer" button)
 *
 * Date selector spans up to 90 days back.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, ArrowDownToLine, ArrowUpFromLine, CreditCard, ArrowLeftRight, Coins, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { useCashless } from "@/hooks/use-cashless";
import { useChipTransfers } from "@/hooks/use-chip-transfers";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { getBusinessDate } from "@/lib/business-day";
import ChipTransferDialog from "@/components/player/ChipTransferDialog";

const MAX_DAYS_BACK = 90;

const subDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const CageHistoryView = () => {
  const today = getBusinessDate();
  const minDate = subDays(today, -MAX_DAYS_BACK);
  const [date, setDate] = useState(today);
  const { casinoId } = useAuth();
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const tableMap = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables]);

  // Transactions for the date (IN/OUT)
  const { data: transactions = [] } = useQuery({
    queryKey: ["surv-transactions", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [] as any[];
      const { data, error } = await supabase
        .from("transactions")
        .select("*, players(first_name,last_name)")
        .eq("casino_id", casinoId)
        .gte("created_at", `${date}T00:00:00`)
        .lte("created_at", `${date}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId,
  });

  // Cashless for the date
  const { data: cashless = [] } = useCashless(date);

  // Cage transfers for the date
  const { data: cageTransfers = [] } = useQuery({
    queryKey: ["surv-cage-transfers", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [] as any[];
      const { data, error } = await supabase
        .from("cage_transfers")
        .select("*")
        .eq("casino_id", casinoId)
        .gte("created_at", `${date}T00:00:00`)
        .lte("created_at", `${date}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId,
  });

  // Chip transfers for the date (uses existing hook scoped by day)
  const { data: chipTransfers = [] } = useChipTransfers(date);

  // Chip Transfer dialog — surveillance can create new ones
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPlayer, setTransferPlayer] = useState<any>(null);

  const isInTx = (t: string) => t === "buy" || t === "in";
  const ins = transactions.filter((t: any) => isInTx(t.type));
  const outs = transactions.filter((t: any) => !isInTx(t.type));

  const shiftDate = (delta: number) => {
    const next = subDays(date, delta);
    if (next < minDate) return;
    if (next > today) return;
    setDate(next);
  };

  const dateControl = (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="icon-sm" onClick={() => shiftDate(-1)} disabled={date <= minDate}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Input
        type="date"
        value={date}
        min={minDate}
        max={today}
        onChange={e => e.target.value && setDate(e.target.value)}
        className="w-44 font-mono h-9"
      />
      <Button variant="ghost" size="icon-sm" onClick={() => shiftDate(1)} disabled={date >= today}>
        <ChevronRight className="w-4 h-4" />
      </Button>
      {date !== today && (
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setDate(today)}>
          Today
        </Button>
      )}
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        icon={Landmark}
        title="Cage"
        subtitle="Surveillance · Read-only history"
        centerSlot={dateControl}
      >
        <Badge variant="outline" className="text-[10px]">View only</Badge>
      </PageHeader>

      <Tabs defaultValue="inout" className="space-y-3">
        <TabsList className="w-full grid grid-cols-4 h-11">
          <TabsTrigger value="inout" className="gap-1.5 text-sm font-semibold">
            <ArrowDownToLine className="w-4 h-4" /> IN / OUT
          </TabsTrigger>
          <TabsTrigger value="cashless" className="gap-1.5 text-sm font-semibold">
            <CreditCard className="w-4 h-4" /> Cashless
          </TabsTrigger>
          <TabsTrigger value="cage" className="gap-1.5 text-sm font-semibold">
            <ArrowLeftRight className="w-4 h-4" /> Cage Transfers
          </TabsTrigger>
          <TabsTrigger value="chip" className="gap-1.5 text-sm font-semibold">
            <Coins className="w-4 h-4" /> Chip Transfers
          </TabsTrigger>
        </TabsList>

        {/* IN / OUT */}
        <TabsContent value="inout" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TxTable title={`IN (${ins.length})`} rows={ins} tableMap={tableMap} variant="in" />
            <TxTable title={`OUT (${outs.length})`} rows={outs} tableMap={tableMap} variant="out" />
          </div>
        </TabsContent>

        {/* Cashless */}
        <TabsContent value="cashless" className="space-y-3">
          <div className="cms-panel">
            <div className="cms-header">Cashless ({cashless.length})</div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {["Dir", "Provider", "Player", "Amount", "Ref", "Status", "Time"].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashless.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-6">No cashless transactions</td></tr>
                  ) : cashless.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${c.direction === "IN" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                          {c.direction}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono">{c.provider}</td>
                      <td className="px-3 py-1.5">{c.players ? `${c.players.first_name} ${c.players.last_name}` : c.player_name || "—"}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${c.direction === "IN" ? "cms-amount-positive" : "cms-amount-negative"}`}>
                        {formatCurrency(Number(c.amount))}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono">{c.reference || "—"}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-[9px] py-0 h-4">{c.status}</Badge>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Cage transfers */}
        <TabsContent value="cage" className="space-y-3">
          <div className="cms-panel">
            <div className="cms-header">Cage Transfers ({cageTransfers.length})</div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {["Type", "Direction", "Table", "Amount", "Note", "Time"].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cageTransfers.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No cage transfers</td></tr>
                  ) : cageTransfers.map((t: any) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 font-mono uppercase text-[10px]">{t.transfer_type}</td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono text-[10px]">{t.direction}</td>
                      <td className="px-3 py-1.5 font-mono">{t.table_id ? tableMap.get(t.table_id)?.name || "—" : "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">{formatCurrency(Number(t.amount))}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-xs">{t.note || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Chip transfers — pairs only; surveillance can create new ones */}
        <TabsContent value="chip" className="space-y-3">
          <div className="cms-panel">
            <div className="cms-header flex items-center justify-between gap-2">
              <span>Chip Transfers ({chipTransfers.length})</span>
              <Button size="sm" className="h-7 gap-1.5" onClick={() => {
                // Open dialog with first present player as anchor — surveillance can pick both sides.
                setTransferPlayer({ id: "__pick__", first_name: "Select", last_name: "player", nickname: null });
                setTransferOpen(true);
              }}>
                <Plus className="w-3.5 h-3.5" /> New Chip Transfer
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {["Dir", "From → To", "Table", "Amount", "Note", "Time"].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chipTransfers.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No chip transfers</td></tr>
                  ) : chipTransfers
                    // Show only one row per pair to avoid double-counting (the OUT side)
                    .filter(t => t.direction === "out")
                    .map((t) => {
                      const from = playerMap.get(t.player_id);
                      const to = playerMap.get(t.counterparty_player_id);
                      return (
                        <tr key={t.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">PAIR</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="font-medium">{from ? `${from.first_name} ${from.last_name}` : "—"}</span>
                            <span className="text-muted-foreground mx-1.5">→</span>
                            <span className="font-medium">{to ? `${to.first_name} ${to.last_name}` : "—"}</span>
                          </td>
                          <td className="px-3 py-1.5 font-mono">{t.table_id ? tableMap.get(t.table_id)?.name || "—" : "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-medium">{formatCurrency(Number(t.amount))}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-xs">{t.note || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                            {new Date(t.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {transferOpen && (
        <ChipTransferPickerDialog
          open={transferOpen}
          onOpenChange={(v) => { setTransferOpen(v); if (!v) setTransferPlayer(null); }}
          players={players as any[]}
        />
      )}
    </PageShell>
  );
};

const TxTable = ({ title, rows, tableMap, variant }: {
  title: string; rows: any[]; tableMap: Map<string, any>; variant: "in" | "out";
}) => (
  <div className="cms-panel">
    <div className="cms-header">{title}</div>
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b border-border">
            {["Player", "Table", "Amount", "Time"].map(h => (
              <th key={h} className={`px-3 py-1.5 font-medium text-muted-foreground uppercase ${h === "Amount" || h === "Time" ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="text-center text-muted-foreground py-6">None</td></tr>
          ) : rows.map(tx => (
            <tr key={tx.id} className="border-b border-border last:border-0">
              <td className="px-3 py-1.5">{tx.players?.first_name} {tx.players?.last_name}</td>
              <td className="px-3 py-1.5 font-mono text-muted-foreground">{tx.table_id ? tableMap.get(tx.table_id)?.name || "—" : "—"}</td>
              <td className={`px-3 py-1.5 text-right font-mono font-medium ${variant === "in" ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {variant === "in" ? "+" : "−"}{formatCurrency(Number(tx.amount))}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                {new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/**
 * Surveillance variant of ChipTransferDialog: lets the user pick BOTH players
 * (the standard dialog locks one side to the player whose card it was opened from).
 * We model this by first picking a "donor" player, then handing off to ChipTransferDialog.
 */
const ChipTransferPickerDialog = ({
  open, onOpenChange, players,
}: { open: boolean; onOpenChange: (v: boolean) => void; players: any[] }) => {
  const [donor, setDonor] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players
      .filter(p => p.status !== "blacklist")
      .filter(p => !q || `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [players, search]);

  if (donor) {
    return (
      <ChipTransferDialog
        open={open}
        onOpenChange={(v) => { onOpenChange(v); if (!v) setDonor(null); }}
        player={donor}
        defaultDirection="out"
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
      <div className="bg-card rounded-md border border-border w-full max-w-md p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-sm">Pick the donor (Chip OUT side)</h3>
        <Input autoFocus placeholder="Search player…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No matches</div>
          ) : filtered.map(p => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
              onClick={() => setDonor(p)}
            >
              <span className="font-medium">{p.first_name} {p.last_name}</span>
              {p.nickname && <span className="text-muted-foreground"> "{p.nickname}"</span>}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};

export default CageHistoryView;
