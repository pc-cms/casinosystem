import { useState, useMemo } from "react";
import { useActivityLogs } from "@/hooks/use-casino-data";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { Search } from "lucide-react";

const CATEGORY_STYLES: Record<string, string> = {
  transaction: "bg-primary/10 text-primary", edit: "bg-accent/10 text-accent",
  lock: "bg-destructive/10 text-destructive", expense: "bg-info/10 text-info",
  player: "bg-success/10 text-success", system: "bg-muted text-muted-foreground",
  breaklist: "bg-warning/10 text-warning", pit: "bg-primary/10 text-primary",
};

const Logs = () => {
  const { data: logs = [], isLoading } = useActivityLogs(500);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = logs;
    if (catFilter !== "all") {
      result = result.filter(l => l.category === catFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => {
        const details = typeof l.details === "object" ? JSON.stringify(l.details) : String(l.details);
        return l.action.toLowerCase().includes(q) || details.toLowerCase().includes(q) || l.operator_id.includes(q);
      });
    }
    return result;
  }, [logs, search, catFilter]);

  const categories = useMemo(() => {
    const cats = new Set(logs.map(l => l.category));
    return Array.from(cats).sort();
  }, [logs]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-xs text-muted-foreground">Immutable trail · searchable · {filtered.length} entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search action, details, operator…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 font-mono text-xs h-8"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="cms-panel overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {["Time", "Category", "Action", "Details", "Operator"].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">No logs found</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${CATEGORY_STYLES[log.category] || ""}`}>{log.category}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs font-medium text-card-foreground font-mono">{log.action}</td>
                  <td className="px-3 py-1.5 text-[10px] text-muted-foreground max-w-xs truncate font-mono">
                    {typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details)}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">{log.operator_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Logs;
