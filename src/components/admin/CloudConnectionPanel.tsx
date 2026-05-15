/**
 * CloudConnectionPanel — appears in Admin → Network on LOCAL on-prem servers.
 * Lets a super_admin pair the local server with the central Cloud and trigger
 * the initial data sync, all from the UI (no CLI required).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, Link2, Unlink, RefreshCw, Download, Loader2 } from "lucide-react";
import {
  useCloudConnection,
  useStartPairing,
  usePollPairing,
  useDisconnectCloud,
  useTriggerInitialSync,
} from "@/hooks/use-cloud-connection";
import { getRuntimeConfig, isLocalMode } from "@/lib/runtime-config";

const DEFAULT_CLOUD_URL = "https://rpehngjvwcnipvkouluu.supabase.co";

function isLikelyOnPremHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function CloudConnectionPanel() {
  const [shouldShow, setShouldShow] = useState(() => isLocalMode() || isLikelyOnPremHost());

  useEffect(() => {
    let active = true;
    getRuntimeConfig()
      .then((cfg) => {
        if (active) setShouldShow(cfg.localMode || isLikelyOnPremHost());
      })
      .catch(() => {
        if (active) setShouldShow(isLikelyOnPremHost());
      });
    return () => {
      active = false;
    };
  }, []);

  if (!shouldShow) return null;
  return <CloudConnectionPanelInner />;
}

function CloudConnectionPanelInner() {
  const { data: conn, isLoading, error } = useCloudConnection();
  const startPairing = useStartPairing();
  const pollPairing = usePollPairing();
  const disconnect = useDisconnectCloud();
  const triggerSync = useTriggerInitialSync();

  const [cloudUrl, setCloudUrl] = useState(DEFAULT_CLOUD_URL);

  // Auto-poll while pairing
  useEffect(() => {
    if (conn?.status !== "pairing") return;
    const t = setInterval(() => pollPairing.mutate(), 5_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.status]);

  if (isLoading) {
    return (
      <div className="cms-panel p-4 text-sm text-muted-foreground">
        Loading cloud connection...
      </div>
    );
  }
  if (error) {
    return (
      <div className="cms-panel p-4 text-sm text-destructive">
        Cloud API unavailable: {String((error as Error).message)}
      </div>
    );
  }

  const status = conn?.status ?? "disconnected";

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "connected" ? (
            <Cloud className="w-4 h-4 text-emerald-500" />
          ) : (
            <CloudOff className="w-4 h-4 text-muted-foreground" />
          )}
          <h3 className="text-sm font-semibold text-card-foreground">Cloud Connection</h3>
          <StatusBadge status={status} />
        </div>
      </div>

      {status === "disconnected" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Link this local server to a central Cloud server to enable two-way data sync.
          </p>
          <div className="flex gap-2">
            <Input
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              placeholder="https://your-cloud.example.com"
              className="font-mono text-xs"
            />
            <Button
              onClick={() => startPairing.mutate(cloudUrl, {
                onError: (e) => toast.error((e as Error).message),
              })}
              disabled={!cloudUrl || startPairing.isPending}
              className="gap-1.5"
            >
              <Link2 className="w-4 h-4" />
              Start pairing
            </Button>
          </div>
        </div>
      )}

      {status === "pairing" && conn?.pairing_code && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Awaiting approval on the Cloud server. A super_admin must approve this server in
            Cloud → Admin → Network → Pending.
          </p>
          <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Pairing code
              </div>
              <div className="font-mono text-2xl font-bold tracking-widest">
                {conn.pairing_code.slice(0, 4)}–{conn.pairing_code.slice(4, 8)}
              </div>
              {conn.pairing_expires_at && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Expires {new Date(conn.pairing_expires_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pollPairing.mutate()}
                disabled={pollPairing.isPending}
                className="gap-1.5"
              >
                {pollPairing.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Check now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect.mutate()}
                className="gap-1.5"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {status === "connected" && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Connected to <span className="font-mono">{conn?.cloud_url}</span>
            {conn?.casino_id && (
              <> · casino <span className="font-mono">{conn.casino_id.slice(0, 8)}</span></>
            )}
            {conn?.connected_at && (
              <> · since {new Date(conn.connected_at).toLocaleString()}</>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                triggerSync.mutate(undefined, {
                  onSuccess: () => toast.success("Initial sync queued"),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={triggerSync.isPending}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              {triggerSync.isPending ? "Queueing..." : "Sync Data from Cloud"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Disconnect this server from the Cloud? Local data is kept.")) {
                  disconnect.mutate();
                }
              }}
              className="gap-1.5"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {conn?.last_error && (
        <div className="text-[10px] text-destructive">Last error: {conn.last_error}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    disconnected: { label: "Not connected", cls: "bg-muted text-muted-foreground" },
    pairing: { label: "Awaiting approval", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    connected: { label: "Connected", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  };
  const m = map[status] ?? map.disconnected;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
