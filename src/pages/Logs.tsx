import { useCMS } from "@/lib/cms-context";
import { Badge } from "@/components/ui/badge";

const CATEGORY_STYLES: Record<string, string> = {
  transaction: "bg-primary/10 text-primary",
  edit: "bg-accent/10 text-accent",
  lock: "bg-destructive/10 text-destructive",
  expense: "bg-info/10 text-info",
  player: "bg-success/10 text-success",
  system: "bg-muted text-muted-foreground",
};

const Logs = () => {
  const { logs } = useCMS();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground">All system actions (60+ day retention)</p>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Time</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Category</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Action</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Details</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Operator</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">No logs yet — actions will appear here</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${CATEGORY_STYLES[log.category] || ""}`}>
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-card-foreground font-mono">{log.action}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{log.details}</td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{log.operator}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Logs;
