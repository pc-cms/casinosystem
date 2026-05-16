/**
 * LocalServerWizard — one-click bootstrap + health check for the on-prem
 * local server. Walks through every stage that previously required SSH
 * commands and shows live progress.
 *
 * Stages:
 *   1. Server Identity     — CASINO_ID / SLUG / NAME present in .env
 *   2. cms-sync API        — /api/node/status reachable, schema_version
 *   3. Updater             — current vs available; offers Apply when newer
 *   4. Cloud Peer          — peer_links has an active Cloud peer
 *   5. Initial Clone       — if local has no data yet, prompts to clone
 *   6. Live Heartbeat      — sync_exchange_logs has a fresh heartbeat row
 *
 * Hidden in Cloud mode.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, Play, RotateCcw,
  ShieldCheck, Network, Download, CloudDownload, Activity, Server,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isLocalServer, useServerIdentity } from "@/hooks/use-server-identity";
import {
  useLocalUpdaterStatus, useLocalUpdaterCheck, useLocalUpdaterApply,
} from "@/hooks/use-local-updater";
import { useCloneFromCloud, useCloneStatus } from "@/hooks/use-server-identity";
import { toast } from "sonner";

type Status = "pending" | "running" | "ok" | "warn" | "error";

interface Stage {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: Status;
  message?: string;
  detail?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}

const StatusIcon = ({ s }: { s: Status }) => {
  if (s === "running") return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
  if (s === "ok") return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (s === "warn") return <AlertTriangle className="w-4 h-4 text-warning" />;
  if (s === "error") return <XCircle className="w-4 h-4 text-destructive" />;
  return <div className="w-4 h-4 rounded-full border border-border" />;
};

async function authedFetch(path: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not authenticated");
  const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export const LocalServerWizard = () => {
  if (!isLocalServer()) return null;

  const { data: identity, refetch: refetchIdentity } = useServerIdentity();
  const updater = useLocalUpdaterStatus();
  const updaterCheck = useLocalUpdaterCheck();
  const updaterApply = useLocalUpdaterApply();
  const cloneMut = useCloneFromCloud();
  const cloneStatus = useCloneStatus(true);

  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<string, { status: Status; message?: string; detail?: string }>>({
    identity:  { status: "pending" },
    sync:      { status: "pending" },
    updater:   { status: "pending" },
    peer:      { status: "pending" },
    data:      { status: "pending" },
    heartbeat: { status: "pending" },
  });

  const setStage = (key: string, patch: { status: Status; message?: string; detail?: string }) =>
    setStages(prev => ({ ...prev, [key]: patch }));

  // ── Stage runners ─────────────────────────────────────────────────────
  const runIdentity = async () => {
    setStage("identity", { status: "running" });
    const id = await refetchIdentity().then(r => r.data);
    if (!id || id.unconfigured || !id.casino_id) {
      setStage("identity", {
        status: "error",
        message: "Server Identity not configured",
        detail: "Open Server Identity above and set Casino + Slug + Name.",
      });
      return false;
    }
    setStage("identity", {
      status: "ok",
      message: id.casino_name || id.casino_slug,
      detail: `casino_id: ${id.casino_id.slice(0, 8)}… · slug: ${id.casino_slug}`,
    });
    return true;
  };

  const runSync = async () => {
    setStage("sync", { status: "running" });
    try {
      const r = await authedFetch("/api/node/status");
      setStage("sync", {
        status: "ok",
        message: `cms-sync v${r.schema_version ?? "?"}`,
        detail: `node: ${r.display_name ?? "—"} · ${r.peers_count ?? 0} peer(s)`,
      });
      return true;
    } catch (e: any) {
      setStage("sync", {
        status: "error",
        message: "cms-sync unreachable",
        detail: String(e?.message ?? e),
      });
      return false;
    }
  };

  const runUpdater = async () => {
    setStage("updater", { status: "running" });
    try {
      await updaterCheck.mutateAsync();
      // wait briefly for updater to fetch GitHub
      await new Promise(r => setTimeout(r, 2500));
      const fresh = await updater.refetch().then(r => r.data);
      const cur = fresh?.current_version ?? "?";
      const avail = fresh?.available_version;
      if (avail && avail !== cur) {
        setStage("updater", {
          status: "warn",
          message: `Update available: ${avail}`,
          detail: `Current: ${cur}. Click Apply to install (~2 min downtime).`,
        });
      } else {
        setStage("updater", {
          status: "ok",
          message: `Up to date (v${cur})`,
          detail: avail ? `Available: ${avail}` : "No newer release on GitHub.",
        });
      }
      return true;
    } catch (e: any) {
      setStage("updater", {
        status: "warn",
        message: "Updater check failed",
        detail: String(e?.message ?? e),
      });
      return true; // non-blocking
    }
  };

  const runPeer = async () => {
    setStage("peer", { status: "running" });
    try {
      const r = await authedFetch("/api/node/status");
      const peers = Array.isArray(r.peers) ? r.peers : [];
      const cloud = peers.find((p: any) => /cloud/i.test(p.display_name)) ?? peers[0];
      if (!cloud) {
        setStage("peer", {
          status: "error",
          message: "No Cloud peer paired",
          detail: "Open Peer Links below and pair this server with Cloud.",
        });
        return false;
      }
      const lastSeen = cloud.last_seen_at ? new Date(cloud.last_seen_at) : null;
      const ageSec = lastSeen ? (Date.now() - lastSeen.getTime()) / 1000 : Infinity;
      if (cloud.status === "active" && ageSec < 120) {
        setStage("peer", {
          status: "ok",
          message: `Connected to ${cloud.display_name}`,
          detail: `Last seen ${Math.round(ageSec)}s ago.`,
        });
        return true;
      }
      setStage("peer", {
        status: "warn",
        message: `${cloud.display_name} stale`,
        detail: lastSeen ? `Last seen ${Math.round(ageSec)}s ago.` : "No handshake yet.",
      });
      return true;
    } catch (e: any) {
      setStage("peer", { status: "error", message: "Peer check failed", detail: String(e?.message ?? e) });
      return false;
    }
  };

  const runData = async () => {
    setStage("data", { status: "running" });
    try {
      const { count: players } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true });
      const { count: shifts } = await supabase
        .from("shifts")
        .select("*", { count: "exact", head: true });
      const totalRows = (players ?? 0) + (shifts ?? 0);
      if (totalRows === 0) {
        setStage("data", {
          status: "warn",
          message: "No data yet — clone needed",
          detail: "Click Clone from Cloud to mirror the Cloud database.",
        });
      } else {
        setStage("data", {
          status: "ok",
          message: `${(players ?? 0).toLocaleString()} players · ${(shifts ?? 0).toLocaleString()} shifts`,
          detail: "Local DB has data — clone not required.",
        });
      }
      return true;
    } catch (e: any) {
      setStage("data", { status: "error", message: "DB query failed", detail: String(e?.message ?? e) });
      return false;
    }
  };

  const runHeartbeat = async () => {
    setStage("heartbeat", { status: "running" });
    try {
      const { data, error } = await supabase
        .from("sync_exchange_logs")
        .select("kind, created_at, peer_name")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const hb = (data ?? []).find(r => r.kind === "heartbeat");
      if (!hb) {
        setStage("heartbeat", {
          status: "warn",
          message: "No heartbeat seen yet",
          detail: "Wait ~30s after pairing or check cms-sync logs.",
        });
        return true;
      }
      const ageSec = (Date.now() - new Date(hb.created_at).getTime()) / 1000;
      if (ageSec < 90) {
        setStage("heartbeat", {
          status: "ok",
          message: `Live (${Math.round(ageSec)}s ago)`,
          detail: `Last 20 events include ${(data ?? []).length} from ${hb.peer_name ?? "Cloud"}.`,
        });
      } else {
        setStage("heartbeat", {
          status: "warn",
          message: `Stale (${Math.round(ageSec / 60)}m ago)`,
          detail: "Heartbeat not arriving — check Cloud peer connectivity.",
        });
      }
      return true;
    } catch (e: any) {
      setStage("heartbeat", { status: "warn", message: "Log query failed", detail: String(e?.message ?? e) });
      return true;
    }
  };

  // ── Run-all orchestrator ─────────────────────────────────────────────
  const runAll = async () => {
    setRunning(true);
    setStages({
      identity:  { status: "pending" },
      sync:      { status: "pending" },
      updater:   { status: "pending" },
      peer:      { status: "pending" },
      data:      { status: "pending" },
      heartbeat: { status: "pending" },
    });
    try {
      const ok1 = await runIdentity();         if (!ok1) return;
      const ok2 = await runSync();             if (!ok2) return;
      await runUpdater();
      await runPeer();
      await runData();
      await runHeartbeat();
      toast.success("Health check complete");
    } finally {
      setRunning(false);
    }
  };

  // Re-poll heartbeat periodically once green
  useEffect(() => {
    if (stages.heartbeat.status !== "ok") return;
    const t = setInterval(() => { runHeartbeat(); }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.heartbeat.status]);

  const stageList: Stage[] = useMemo(() => [
    { key: "identity",  label: "Server Identity",         icon: ShieldCheck,  ...stages.identity  },
    { key: "sync",      label: "cms-sync API",            icon: Server,       ...stages.sync      },
    {
      key: "updater", label: "Frontend Updater", icon: Download, ...stages.updater,
      action: stages.updater.status === "warn" && updater.data?.available_version
        ? {
            label: `Apply ${updater.data.available_version}`,
            disabled: updaterApply.isPending,
            onClick: () => updaterApply.mutate({ version: updater.data!.available_version, auto_apply: true }),
          }
        : undefined,
    },
    { key: "peer",      label: "Cloud Peer Connection",   icon: Network,      ...stages.peer      },
    {
      key: "data", label: "Local Database", icon: CloudDownload, ...stages.data,
      action: stages.data.status === "warn"
        ? {
            label: cloneStatus.data?.status === "running" ? "Cloning…" : "Clone from Cloud",
            disabled: cloneStatus.data?.status === "running" || cloneMut.isPending,
            onClick: () => cloneMut.mutate(),
          }
        : undefined,
    },
    { key: "heartbeat", label: "Live Sync Heartbeat",     icon: Activity,     ...stages.heartbeat },
  ], [stages, updater.data, updaterApply.isPending, cloneStatus.data, cloneMut.isPending]);

  const done = stageList.filter(s => s.status === "ok" || s.status === "warn" || s.status === "error").length;
  const total = stageList.length;
  const pct = Math.round((done / total) * 100);
  const errorCount = stageList.filter(s => s.status === "error").length;
  const warnCount  = stageList.filter(s => s.status === "warn").length;

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Local Server — Full Health Check
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            One click runs the entire bootstrap & verification cycle: identity → cms-sync → updater →
            Cloud peer → database → live heartbeat. No SSH required.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {running ? (
            <Button disabled size="sm" variant="outline">
              <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Running…
            </Button>
          ) : done === 0 ? (
            <Button onClick={runAll} size="sm">
              <Play className="w-4 h-4 mr-1" /> Run Full Check
            </Button>
          ) : (
            <Button onClick={runAll} size="sm" variant="outline">
              <RotateCcw className="w-4 h-4 mr-1" /> Re-run
            </Button>
          )}
        </div>
      </div>

      {(done > 0 || running) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{done} / {total} checks complete</span>
            <span className="flex items-center gap-2">
              {errorCount > 0 && <Badge variant="destructive" className="text-[9px]">{errorCount} error</Badge>}
              {warnCount  > 0 && <Badge variant="secondary"    className="text-[9px]">{warnCount} warn</Badge>}
              {errorCount === 0 && warnCount === 0 && done === total && (
                <Badge variant="default" className="text-[9px] bg-success text-success-foreground">All good</Badge>
              )}
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      )}

      <div className="divide-y divide-border border-y border-border">
        {stageList.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="py-2.5 flex items-center gap-3">
              <div className="w-5 text-[10px] text-muted-foreground font-mono text-right">{i + 1}.</div>
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {s.label}
                  {s.message && (
                    <span className={
                      s.status === "ok"    ? "text-success text-xs font-normal" :
                      s.status === "warn"  ? "text-warning text-xs font-normal" :
                      s.status === "error" ? "text-destructive text-xs font-normal" :
                                             "text-muted-foreground text-xs font-normal"
                    }>
                      — {s.message}
                    </span>
                  )}
                </div>
                {s.detail && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.detail}</div>
                )}
              </div>
              {s.action && (
                <Button size="sm" variant="outline" onClick={s.action.onClick} disabled={s.action.disabled}>
                  {s.action.label}
                </Button>
              )}
              <StatusIcon s={s.status} />
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Tip: Save this page to favourites — re-running this check daily is the only operational task left.
      </p>
    </div>
  );
};
