/**
 * G3 · Marketing — Campaign detail page.
 * KPI strip + expenses tab + attributed players tab.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Megaphone, Plus, X, ArrowLeft } from "lucide-react";
import {
  usePromoCampaign, usePromoKPI, usePromoExpenses, usePromoPlayers,
  useAddPromoExpense, useAttributePromoPlayer, useRemovePromoPlayer,
  useUpdatePromoCampaign,
  type PromoCampaignStatus,
} from "@/hooks/use-promo-campaigns";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PlayerNameAutocomplete } from "@/components/PlayerNameAutocomplete";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateOnly } from "@/lib/format-date";
import { toast } from "@/hooks/use-toast";

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export default function MarketingCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: campaign } = usePromoCampaign(id ?? null);
  const { data: kpi } = usePromoKPI(id ?? null);
  const update = useUpdatePromoCampaign();

  if (!id) return null;
  if (!campaign) {
    return (
      <PageShell>
        <PageHeader icon={Megaphone} title="Campaign" subtitle="Loading…" />
      </PageShell>
    );
  }

  const setStatus = (s: PromoCampaignStatus) =>
    update.mutate({ id, patch: { status: s } });

  const roiColor = (kpi?.roi_pct ?? 0) >= 0 ? "text-cms-amount-positive" : "text-cms-amount-negative";

  return (
    <PageShell>
      <PageHeader
        icon={Megaphone}
        title={campaign.name}
        subtitle={`${fmtDateOnly(campaign.starts_on)}${campaign.ends_on ? ` – ${fmtDateOnly(campaign.ends_on)}` : " – …"}`}
      >
        <Button variant="outline" size="sm" onClick={() => nav("/marketing/campaigns")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Select value={campaign.status} onValueChange={(v) => setStatus(v as PromoCampaignStatus)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Budget" value={formatNumberSpaces(campaign.budget_tzs)} />
        <Kpi label="Spent" value={formatNumberSpaces(kpi?.spent_tzs ?? 0)}
             hint={`${kpi?.utilization_pct ?? 0}% used`} />
        <Kpi label="Players" value={String(kpi?.players_count ?? 0)} />
        <Kpi label="Drop" value={formatNumberSpaces(kpi?.drop_total_tzs ?? 0)} />
        <Kpi label="NEP" value={formatNumberSpaces(kpi?.nep_total_tzs ?? 0)} />
        <Kpi label="ROI" value={`${kpi?.roi_pct ?? 0}%`} valueClass={roiColor}
             hint={kpi?.cac_per_player_tzs ? `CAC ${formatNumberSpaces(kpi.cac_per_player_tzs)}` : undefined} />
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-3">
          <ExpensesTab campaignId={id} casinoId={campaign.casino_id} />
        </TabsContent>
        <TabsContent value="players" className="mt-3">
          <PlayersTab campaignId={id} casinoId={campaign.casino_id} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Kpi({ label, value, hint, valueClass }: {
  label: string; value: string; hint?: string; valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono tabular-nums font-semibold ${valueClass ?? ""}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ExpensesTab({ campaignId, casinoId }: { campaignId: string; casinoId: string }) {
  const { data = [], isLoading } = usePromoExpenses(campaignId);
  const add = useAddPromoExpense();
  const [open, setOpen] = useState(false);
  const [spentOn, setSpentOn] = useState(today());
  const [amount, setAmount] = useState("0");
  const [vendor, setVendor] = useState("");
  const [desc, setDesc] = useState("");

  const submit = async () => {
    const amt = Number(amount.replace(/\s/g, "")) || 0;
    if (amt <= 0) {
      toast({ title: "Amount must be > 0", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync({
        campaign_id: campaignId,
        casino_id: casinoId,
        spent_on: spentOn,
        amount_tzs: amt,
        vendor: vendor.trim() || undefined,
        description: desc.trim() || undefined,
      });
      toast({ title: "Expense added" });
      setOpen(false);
      setAmount("0"); setVendor(""); setDesc("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const total = data.reduce((s, e) => s + e.amount_tzs, 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {data.length} entries · Total: <span className="font-mono">{formatNumberSpaces(total)}</span>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add expense
        </Button>
      </div>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount (TZS)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No expenses yet.</TableCell></TableRow>}
            {data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{fmtDateOnly(e.spent_on)}</TableCell>
                <TableCell>{e.vendor || "·"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.description || "·"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatNumberSpaces(e.amount_tzs)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input inputMode="numeric" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ""))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={add.isPending}>{add.isPending ? "Adding…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayersTab({ campaignId, casinoId }: { campaignId: string; casinoId: string }) {
  const { data = [], isLoading } = usePromoPlayers(campaignId);
  const attribute = useAttributePromoPlayer();
  const remove = useRemovePromoPlayer();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const add = async () => {
    if (!playerId) {
      toast({ title: "Select a player", variant: "destructive" });
      return;
    }
    try {
      await attribute.mutateAsync({
        campaign_id: campaignId,
        casino_id: casinoId,
        player_id: playerId,
        note: note.trim() || undefined,
      });
      toast({ title: "Player attributed" });
      setPlayerId(null); setNote("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-md border border-border bg-card">
        <div className="space-y-1 flex-1 min-w-[220px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Player</Label>
          <PlayerNameAutocomplete
            value={playerId}
            onChange={(id) => setPlayerId(id)}
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button onClick={add} disabled={attribute.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Attribute
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Attributed</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No players attributed yet.</TableCell></TableRow>}
            {data.map((p) => {
              const pl = p.player;
              const name = pl ? `${pl.first_name} ${pl.last_name}${pl.nickname ? ` (${pl.nickname})` : ""}` : p.player_id;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.note || "·"}</TableCell>
                  <TableCell className="font-mono text-xs">{fmtDateOnly(p.attributed_on)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: p.id, campaign_id: campaignId })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
