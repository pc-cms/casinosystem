/**
 * /admin/sync-queue — Pending offline mutation queue.
 *
 * Manager / super_admin can:
 *  - see what's waiting to sync (table, op, age, retries, last error)
 *  - retry sync now
 *  - permanently delete a stuck entry (super_admin only, with confirm)
 *
 * The queue lives in IndexedDB (`offline-queue.ts`); this page is a window
 * into it.
 */
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, RotateCw, Database } from "lucide-react";
import {
  getPendingActions,
  removeAction,
  type QueuedAction,
} from "@/lib/offline-queue";
import { syncPendingActions } from "@/lib/sync-engine";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format-date";

const STATUS_COLOR: Record<QueuedAction["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  syncing: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  failed: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  permanently_failed: "bg-red-500/15 text-red-400 border-red-500/40",
};

const ageString = (ms: number) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const SyncQueuePage = () => {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin" as any);
  const canView = isSuperAdmin || roles.includes("manager" as any);

  const [items, setItems] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await getPendingActions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  const onRetryAll = async () => {
    setSyncing(true);
    try {
      const res = await syncPendingActions();
      toast.success(`Sync: ${res.synced} synced, ${res.failed} failed`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!isSuperAdmin) return;
    if (!confirm("Permanently remove this queued action? This cannot be undone.")) return;
    await removeAction(id);
    await refresh();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, syncing: 0, failed: 0, permanently_failed: 0 };
    for (const a of items) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [items]);

  if (!canView) {
    return (
      <PageShell>
        <PageHeader icon={Database} title="Sync Queue" />
        <p className="text-sm text-muted-foreground">Restricted to Manager and Super Admin.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={Database}
        title="Sync Queue"
        subtitle="Mutations waiting to reach the server. Stays empty when the network is healthy."
      >
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button size="sm" onClick={onRetryAll} disabled={syncing || items.length === 0} className="gap-1.5">
          <RotateCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Retry All
        </Button>
      </PageHeader>

      <div className="cms-panel p-2 mb-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          {(["pending", "syncing", "failed", "permanently_failed"] as const).map((s) => (
            <div key={s}>
              <p className="uppercase text-muted-foreground tracking-wider text-[10px] font-medium">
                {s.replace("_", " ")}
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{counts[s] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="cms-panel">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Queue is empty. All changes are synced.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-2">Table</th>
                <th className="text-left p-2">Op</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Retries</th>
                <th className="text-right p-2">Age</th>
                <th className="text-left p-2">Queued</th>
                <th className="text-right p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-border/40">
                  <td className="p-2 font-mono">{a.table}</td>
                  <td className="p-2 font-mono">{a.operation}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={STATUS_COLOR[a.status]}>{a.status}</Badge>
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">{a.retries}</td>
                  <td className="p-2 text-right font-mono tabular-nums text-muted-foreground">
                    {ageString(Date.now() - a.timestamp)}
                  </td>
                  <td className="p-2 font-mono text-xs text-muted-foreground">
                    {fmtDateTime(new Date(a.timestamp).toISOString())}
                  </td>
                  <td className="p-2 text-right">
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(a.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="Delete (super admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
};

export default SyncQueuePage;
