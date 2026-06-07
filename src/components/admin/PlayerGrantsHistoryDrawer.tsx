import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { fmtDateTime, fmtDateOnly } from "@/lib/format-date";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: { id: string; full_name: string } | null;
}

const fmt = (n: number) => (n ?? 0).toLocaleString("fr-FR").replace(/,/g, " ");

const PlayerGrantsHistoryDrawer = ({ open, onOpenChange, player }: Props) => {
  const playerId = player?.id ?? null;

  const { data: grants = [], isLoading: gLoading } = useQuery({
    queryKey: ["player_grants_history", playerId],
    enabled: open && !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_grants")
        .select("id, amount, remaining, source, funding_pool, expires_business_date, status, created_at, casino_id, casinos(name)")
        .eq("player_id", playerId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: redemptions = [], isLoading: rLoading } = useQuery({
    queryKey: ["player_redemptions_history", playerId],
    enabled: open && !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_redemptions")
        .select("id, amount, payout_type, created_at, casino_id, casinos(name)")
        .eq("player_id", playerId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const totalGranted = grants.reduce((s, g) => s + Number(g.amount ?? 0), 0);
  const totalRedeemed = redemptions.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const activeBalance = grants
    .filter((g) => g.status === "active")
    .reduce((s, g) => s + Number(g.remaining ?? 0), 0);
  const cutoff = Date.now() - 30 * 86400000;
  const grants30 = grants.filter((g) => new Date(g.created_at).getTime() > cutoff).length;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={player ? `Promo history — ${player.full_name}` : "Promo history"}
      description="Last 20 grants and redemptions"
      size="xl"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Stat label="Total granted" value={fmt(totalGranted)} />
        <Stat label="Total redeemed" value={fmt(totalRedeemed)} />
        <Stat label="Active balance" value={fmt(activeBalance)} />
        <Stat label="Grants (30d)" value={String(grants30)} />
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <section>
          <h3 className="text-xs uppercase font-semibold text-muted-foreground mb-1.5">Grants</h3>
          <DataTable>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase">
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Casino</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-right p-2">Remaining</th>
                  <th className="text-left p-2">Source</th>
                  <th className="text-left p-2">Pool</th>
                  <th className="text-left p-2">Expires</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {gLoading && <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">Loading…</td></tr>}
                {!gLoading && grants.length === 0 && <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">No grants</td></tr>}
                {grants.map((g) => (
                  <tr key={g.id} className="border-b border-border/40">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(g.created_at)}</td>
                    <td className="p-2">{g.casinos?.name ?? "—"}</td>
                    <td className="p-2 text-right font-mono">{fmt(g.amount)}</td>
                    <td className="p-2 text-right font-mono">{fmt(g.remaining)}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{g.source}</Badge></td>
                    <td className="p-2">{g.funding_pool}</td>
                    <td className="p-2">{g.expires_business_date ? fmtDateOnly(g.expires_business_date) : "·"}</td>
                    <td className="p-2"><Badge variant={g.status === "active" ? "default" : "secondary"} className="text-[10px]">{g.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </section>

        <section>
          <h3 className="text-xs uppercase font-semibold text-muted-foreground mb-1.5">Redemptions</h3>
          <DataTable>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase">
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Casino</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-left p-2">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rLoading && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Loading…</td></tr>}
                {!rLoading && redemptions.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No redemptions</td></tr>}
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                    <td className="p-2">{r.casinos?.name ?? "—"}</td>
                    <td className="p-2 text-right font-mono">{fmt(r.amount)}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.payout_type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </section>
      </div>

      <ResponsiveDialogFooter>
        {player && (
          <Button variant="outline" asChild>
            <Link to={`/players/${player.id}`}>
              Open profile <ExternalLink className="size-3.5 ml-1" />
            </Link>
          </Button>
        )}
        <Button onClick={() => onOpenChange(false)}>Close</Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-card p-2">
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    <div className="font-mono text-sm">{value}</div>
  </div>
);

export default PlayerGrantsHistoryDrawer;
