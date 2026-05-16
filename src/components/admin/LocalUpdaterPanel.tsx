/**
 * LocalUpdaterPanel — admin UI for the on-prem cms-updater.
 * Shows current vs available version, lets super_admin trigger an immediate
 * GitHub check, or apply (pull + restart cms-frontend) a specific version.
 * Hidden in Cloud mode (localMode flag in runtime-config).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Download, Rocket, AlertTriangle } from "lucide-react";
import {
  isLocalServer,
  useLocalUpdaterStatus,
  useLocalUpdaterCheck,
  useLocalUpdaterApply,
} from "@/hooks/use-local-updater";

export const LocalUpdaterPanel = () => {
  if (!isLocalServer()) return null;

  const { data, isLoading, error } = useLocalUpdaterStatus();
  const check = useLocalUpdaterCheck();
  const apply = useLocalUpdaterApply();
  const [version, setVersion] = useState("");
  const [autoApply, setAutoApply] = useState(true);

  const current = data?.current_version ?? "—";
  const avail = data?.available_version;
  const newer = !!avail && avail !== current;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Local Updater
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Polls GitHub Releases, pulls the new image, restarts frontend with rollback on failure.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${check.isPending ? "animate-spin" : ""}`} />
          Check now
        </Button>
      </div>

      {error && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {String((error as Error).message)}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
              <div className="font-mono text-base mt-0.5">{current}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Previous</div>
              <div className="font-mono text-base mt-0.5">{data?.previous_version ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</div>
              <div className="font-mono text-base mt-0.5 flex items-center gap-2">
                {avail ?? "—"}
                {newer && <Badge variant="default" className="text-[9px]">NEW</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-2 pt-2 border-t border-border">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Apply specific version (blank = latest available)
              </label>
              <Input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder={avail ?? "e.g. 1.4.2"}
                className="font-mono mt-1 h-9"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-2">
              <Checkbox checked={autoApply} onCheckedChange={c => setAutoApply(!!c)} />
              <span>Auto-apply</span>
            </label>
            <Button
              onClick={() => apply.mutate({ version: version.trim() || avail || undefined, auto_apply: autoApply })}
              disabled={apply.isPending || (!version.trim() && !avail)}
            >
              <Rocket className="w-4 h-4 mr-1" /> Apply
            </Button>
          </div>

          {data?.push_ack && (
            <div className="text-xs bg-muted/40 rounded p-2 font-mono">
              <span className="text-muted-foreground">Last apply:</span>{" "}
              <Badge variant={data.push_ack.status === "applied" ? "default" : data.push_ack.status === "failed" ? "destructive" : "secondary"} className="text-[9px]">
                {data.push_ack.status}
              </Badge>{" "}
              {data.push_ack.message ?? ""}
            </div>
          )}

          {data?.log_tail && data.log_tail.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Recent log ({data.log_tail.length} lines)
              </summary>
              <pre className="mt-2 bg-muted/40 rounded p-2 max-h-48 overflow-auto font-mono text-[10px] leading-relaxed">
                {data.log_tail.join("\n")}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
};
