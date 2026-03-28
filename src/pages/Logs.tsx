import { useActivityLogs } from "@/hooks/use-casino-data";

const CATEGORY_STYLES: Record<string, string> = {
  transaction: "bg-primary/10 text-primary", edit: "bg-accent/10 text-accent",
  lock: "bg-destructive/10 text-destructive", expense: "bg-info/10 text-info",
  player: "bg-success/10 text-success", system: "bg-muted text-muted-foreground",
  breaklist: "bg-warning/10 text-warning", pit: "bg-primary/10 text-primary",
};

const Logs = () => {
  const { data: logs = [], isLoading } = useActivityLogs(200);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Immutable audit trail · 60+ day retention</p>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Time", "Category", "Action", "Details", "Operator"].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">No logs yet</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${CATEGORY_STYLES[log.category] || ""}`}>{log.category}</span>
                </td>
                <td className="px-4 py-2 text-sm font-medium text-card-foreground font-mono">{log.action}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">{typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details)}</td>
                <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{log.operator_id.slice(0, 8)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Logs;
