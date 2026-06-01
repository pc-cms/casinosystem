/**
 * CashlessReport — read-only Cashless analytics over an arbitrary business-day range.
 * Mirrors Expenses report integration: KPI cards, provider breakdown, sortable history.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";
import { ArrowUp, ArrowDown, ArrowUpDown, CheckCircle } from "lucide-react";

type Direction = "IN" | "OUT";
type Provider = "AIRTEL" | "MPESA" | "TIGO" | "HALOTEL";
type Source = "all" | "live_game" | "slots";

const PROVIDERS: Provider[] = ["AIRTEL", "MPESA", "TIGO", "HALOTEL"];
const PROVIDER_LABEL: Record<Provider, string> = {
  AIRTEL: "AirTel", MPESA: "M-Pesa", TIGO: "Tigo", HALOTEL: "Halotel",
};
const PROVIDER_COLORS: Record<Provider, string> = {
  AIRTEL: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  MPESA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  TIGO: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  HALOTEL: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

const resolveSource = (r: any): "live_game" | "slots" => {
  const m = String(r.source_module || "").toLowerCase();
  if (m === "cage_slots" || r.cage_slots_shift_id) return "slots";
  if ((r.cage_type || "").toLowerCase() === "slots") return "slots";
  return "live_game";
};

type SortKey = "date" | "source" | "provider" | "direction" | "player" | "amount" | "status";
type SortDir = "asc" | "desc";

const CashlessReport = ({ from, to }: { from: string; to: string }) => {
  const { casinoId } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cashless-report", casinoId, from, to],
    queryFn: async () => {
      if (!casinoId) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("cashless_transactions")
        .select("*, players(first_name, last_name)")
        .eq("casino_id", casinoId)
        .gte("business_date", from)
        .lte("business_date", to)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId,
    staleTime: 30_000,
  });

  // Filters
  const [source, setSource] = useState<Source>("all");
  const [provider, setProvider] = useState<"all" | Provider>("all");
  const [direction, setDirection] = useState<"all" | Direction>("all");
  const [status, setStatus] = useState<"all" | "pending" | "recorded" | "approved">("all");
  const [search, setSearch] = useState("");

  const resetFilters = () => {
    setSource("all"); setProvider("all"); setDirection("all");
    setStatus("all"); setSearch("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (source !== "all" && resolveSource(r) !== source) return false;
      if (provider !== "all" && r.provider !== provider) return false;
      if (direction !== "all" && r.direction !== direction) return false;
      if (status !== "all" && r.status !== status) return false;
      if (q) {
        const pname = r.players ? `${r.players.first_name} ${r.players.last_name}` : (r.player_name || "");
        const hay = `${pname} ${r.reference || ""} ${r.note || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, source, provider, direction, status, search]);

  // KPI totals
  const totals = useMemo(() => {
    let inAmt = 0, outAmt = 0, pendingCount = 0;
    const perProvider: Record<Provider, { in: number; out: number }> = {
      AIRTEL: { in: 0, out: 0 }, MPESA: { in: 0, out: 0 },
      TIGO: { in: 0, out: 0 }, HALOTEL: { in: 0, out: 0 },
    };
    filtered.forEach((r: any) => {
      const amt = Number(r.amount || 0);
      const p = r.provider as Provider;
      if (r.direction === "IN") { inAmt += amt; if (perProvider[p]) perProvider[p].in += amt; }
      else { outAmt += amt; if (perProvider[p]) perProvider[p].out += amt; }
      if (r.status === "pending") pendingCount += 1;
    });
    return { in: inAmt, out: outAmt, net: inAmt - outAmt, pendingCount, perProvider };
  }, [filtered]);

  // Sorting
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });
  const toggleSort = (k: SortKey) =>
    setSort(s => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  const SortTh = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" | "center" }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        onClick={() => toggleSort(k)}
        className={`text-[10px] uppercase tracking-wider px-3 py-2 cursor-pointer select-none hover:text-foreground ${active ? "text-foreground" : "text-muted-foreground"} ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {label}
          <Icon className="w-3 h-3 opacity-70" />
        </span>
      </th>
    );
  };

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const get = (r: any): string | number => {
      switch (sort.key) {
        case "date": return r.created_at || "";
        case "source": return resolveSource(r);
        case "provider": return r.provider || "";
        case "direction": return r.direction || "";
        case "player": return r.players ? `${r.players.first_name} ${r.players.last_name}` : (r.player_name || "");
        case "amount": return Number(r.amount || 0);
        case "status": return r.status || "";
      }
    };
    arr.sort((a: any, b: any) => {
      const va = get(a); const vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      return sort.dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sort]);

  const cls = (n: number) => n > 0 ? "cms-amount-positive" : n < 0 ? "cms-amount-negative" : "text-card-foreground";

  return (
    <div className="space-y-3">
      {/* KPI cards — clicking Total resets filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={resetFilters}
          className="cms-panel p-2 text-left hover:bg-muted/40 transition-colors"
        >
          <p className="uppercase text-muted-foreground tracking-wider text-[10px]">Total Records</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{filtered.length}</p>
        </button>
        <div className="cms-panel p-2">
          <p className="uppercase text-muted-foreground tracking-wider text-[10px]">Deposit</p>
          <p className="font-mono text-sm font-bold cms-amount-positive">{formatCurrency(totals.in)}</p>
        </div>
        <div className="cms-panel p-2">
          <p className="uppercase text-muted-foreground tracking-wider text-[10px]">Withdrawal</p>
          <p className="font-mono text-sm font-bold cms-amount-negative">{formatCurrency(totals.out)}</p>
        </div>
        <div className="cms-panel p-2">
          <p className="uppercase text-muted-foreground tracking-wider text-[10px]">Net</p>
          <p className={`font-mono text-sm font-bold ${cls(totals.net)}`}>{totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net)}</p>
        </div>
        <div className="cms-panel p-2">
          <p className="uppercase text-muted-foreground tracking-wider text-[10px]">Pending</p>
          <p className="font-mono text-sm font-bold text-warning">{totals.pendingCount}</p>
        </div>
      </div>

      {/* Per-provider breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {PROVIDERS.map(p => {
          const v = totals.perProvider[p];
          const net = v.in - v.out;
          return (
            <div key={p} className="cms-panel p-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${PROVIDER_COLORS[p]}`}>{PROVIDER_LABEL[p]}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">Deposit: <span className="cms-amount-positive">{formatCurrency(v.in)}</span></p>
              <p className="font-mono text-[10px] text-muted-foreground">Withdrawal: <span className="cms-amount-negative">{formatCurrency(v.out)}</span></p>
              <p className="font-mono text-[10px] text-muted-foreground">Net: <span className={cls(net)}>{net >= 0 ? "+" : ""}{formatCurrency(net)}</span></p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="cms-panel p-2 flex flex-wrap items-end gap-2">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Source</div>
          <Select value={source} onValueChange={(v) => setSource(v as Source)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="live_game">Live Game</SelectItem>
              <SelectItem value="slots">Slots</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Provider</div>
          <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {PROVIDERS.map(p => <SelectItem key={p} value={p}>{PROVIDER_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Direction</div>
          <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="IN">Deposit</SelectItem>
              <SelectItem value="OUT">Withdrawal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Status</div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="recorded">Recorded</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">Search</div>
          <Input
            placeholder="Player, reference, note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* History table */}
      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <SortTh k="date" label="Date" />
              <SortTh k="source" label="Source" />
              <SortTh k="direction" label="Direction" />
              <SortTh k="provider" label="Provider" />
              <SortTh k="player" label="Player" />
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Reference</th>
              <SortTh k="amount" label="Amount" align="right" />
              <SortTh k="status" label="Status" align="center" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground text-sm py-6">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground text-sm py-6">No cashless transactions in range</td></tr>
            ) : sorted.map((r: any) => {
              const src = resolveSource(r);
              return (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${src === "slots" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" : "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400"}`}>
                      {src === "slots" ? "Slots" : "Live"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant={r.direction === "IN" ? "default" : "secondary"} className="text-[10px]">
                      {r.direction === "IN" ? "Deposit" : "Withdrawal"}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${PROVIDER_COLORS[r.provider as Provider] || ""}`}>{r.provider}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-card-foreground">
                    {r.players ? `${r.players.first_name} ${r.players.last_name}` : (r.player_name || "—")}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground font-mono">{r.reference || "—"}</td>
                  <td className={`px-3 py-1.5 text-right font-mono text-xs ${r.direction === "IN" ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {formatCurrency(Number(r.amount))}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {r.status === "approved" ? (
                      <span className="cms-status-active text-xs inline-flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Approved</span>
                    ) : r.status === "pending" ? (
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Recorded</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length > 0 && (
              <tr className="border-t-2 border-primary/30 bg-muted/30">
                <td className="px-3 py-2 text-xs font-bold text-card-foreground uppercase" colSpan={6}>Totals ({sorted.length} records)</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${cls(totals.net)}`}>{totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashlessReport;
