/**
 * CutoverWizardPanel — Super-Admin-only.
 *
 * Drives a zero-downtime cutover from Cloud-Primary to Local-Primary for a
 * single casino, using the Sprint B primitives:
 *
 *   1) Begin session
 *   2) Seed (operator runs install --seed externally, then confirms)
 *   3) Catch-up (live outbox lag must reach 0)
 *   4) Freeze Cloud (cutover_freeze_cloud)
 *   5) Drain (auto, until lag = 0 or 30s timeout)
 *   6) Promote local + DNS swap instructions
 *   7) Done — 1-hour rollback window
 *
 * All shared-identity tables (players/blacklist/tags/notes) continue to flow
 * during freeze/archive — the DB trigger lets them through.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format-date";

type CutoverState =
  | "seeding" | "catching_up" | "freezing" | "draining"
  | "promoting" | "dns_swap" | "done" | "rolled_back" | "failed";

const STATE_ORDER: CutoverState[] = [
  "seeding", "catching_up", "freezing", "draining", "promoting", "dns_swap", "done",
];

const useOutboxLag = (casinoId: string | null) =>
  useQuery({
    queryKey: ["cutover-outbox-lag", casinoId],
    queryFn: async () => {
      if (!casinoId) return 0;
      const { count } = await supabase
        .from("sync_outbox")
        .select("*", { count: "exact", head: true })
        .eq("casino_id", casinoId);
      return count ?? 0;
    },
    enabled: !!casinoId,
    refetchInterval: 2000,
  });

export function CutoverWizardPanel() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isSuper = roles.includes("super_admin");

  const [casinoId, setCasinoId] = useState<string>("");
  const [targetNode, setTargetNode] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: casinos = [] } = useQuery({
    queryKey: ["cutover-casinos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("casinos").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuper,
  });

  const { data: session } = useQuery({
    queryKey: ["cutover-session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data } = await supabase.from("cutover_sessions").select("*").eq("id", sessionId).maybeSingle();
      return data;
    },
    enabled: !!sessionId,
    refetchInterval: 3000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["cutover-history", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data } = await supabase
        .from("cutover_sessions")
        .select("*")
        .eq("casino_id", casinoId)
        .order("started_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: isSuper && !!casinoId,
  });

  const lagQ = useOutboxLag(casinoId);
  const lag = lagQ.data ?? 0;

  const state = (session?.state ?? "seeding") as CutoverState;
  const stepIdx = STATE_ORDER.indexOf(state);

  const begin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("cutover_begin", {
        p_casino: casinoId,
        p_target_node: targetNode || "unknown",
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => { setSessionId(id); toast.success("Cutover session started"); qc.invalidateQueries({ queryKey: ["cutover-history"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setState = useMutation({
    mutationFn: async (s: CutoverState) => {
      if (!sessionId) throw new Error("no session");
      const { error } = await supabase.rpc("cutover_set_state", { p_session: sessionId, p_state: s, p_notes: null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cutover-session"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const freeze = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("cutover_freeze_cloud", { p_casino: casinoId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: async (lagAtFreeze) => {
      toast.success(`Cloud frozen. Drain lag: ${lagAtFreeze} rows.`);
      await setState.mutateAsync("draining");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cutover_promote_local", { p_casino: casinoId });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Local promoted. Cloud is now ARCHIVE.");
      await setState.mutateAsync("dns_swap");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rollback = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("no session");
      const { error } = await supabase.rpc("cutover_rollback", { p_session: sessionId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rolled back to Cloud-Primary"); qc.invalidateQueries({ queryKey: ["cutover-session"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-advance from draining→promoting once lag hits 0
  useEffect(() => {
    if (state === "draining" && lag === 0 && sessionId) {
      setState.mutate("promoting");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lag]);

  const rollbackOpen = useMemo(() => {
    if (!session?.rollback_window_until) return false;
    return new Date(session.rollback_window_until).getTime() > Date.now();
  }, [session]);

  if (!isSuper) return null;

  const selectedCasinoName = casinos.find((c: any) => c.id === casinoId)?.name ?? "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Cutover Wizard
          <Badge variant="outline">super_admin · Premier</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-xs">
            Zero-downtime cutover from Cloud-Primary to Local-Primary. Shared-identity tables (players, blacklist, tags, notes) keep flowing during freeze/archive.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Casino</label>
            <Select value={casinoId} onValueChange={setCasinoId} disabled={!!sessionId}>
              <SelectTrigger><SelectValue placeholder="Pick casino" /></SelectTrigger>
              <SelectContent>
                {casinos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Target node_id</label>
            <Input value={targetNode} onChange={(e) => setTargetNode(e.target.value)} placeholder="e.g. arusha-local-01" disabled={!!sessionId} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Outbox lag (live)</label>
            <div className="h-9 flex items-center font-mono text-lg">
              <Badge variant={lag === 0 ? "default" : "secondary"}>{lag} rows</Badge>
            </div>
          </div>
        </div>

        {!sessionId && (
          <Button onClick={() => begin.mutate()} disabled={!casinoId || begin.isPending}>
            Step 1 · Begin Session
          </Button>
        )}

        {sessionId && session && (
          <div className="space-y-3 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                Session <span className="font-mono text-xs">{sessionId.slice(0, 8)}</span> · {selectedCasinoName}
              </div>
              <Badge variant={state === "done" ? "default" : state === "failed" || state === "rolled_back" ? "destructive" : "secondary"}>
                {state}
              </Badge>
            </div>

            <ol className="text-xs space-y-1">
              {STATE_ORDER.map((s, i) => (
                <li key={s} className={i <= stepIdx ? "text-foreground" : "text-muted-foreground"}>
                  {i <= stepIdx ? "✓" : "○"} Step {i + 1}: {s}
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              {state === "seeding" && (
                <>
                  <div className="text-xs text-muted-foreground w-full">
                    Run on target: <code>curl -fsSL https://casinosystem.app/install | sudo bash -s -- --role primary-staging --seed</code>
                  </div>
                  <Button size="sm" onClick={() => setState.mutate("catching_up")}>Step 2 done · Catch up</Button>
                </>
              )}
              {state === "catching_up" && (
                <>
                  <div className="text-xs text-muted-foreground w-full">Waiting for outbox lag to reach 0 (current: {lag}).</div>
                  <Button size="sm" disabled={lag !== 0} onClick={() => setState.mutate("freezing")}>
                    Step 3 done · Ready to freeze
                  </Button>
                </>
              )}
              {state === "freezing" && (
                <Button size="sm" variant="destructive" onClick={() => freeze.mutate()} disabled={freeze.isPending}>
                  Step 4 · Freeze Cloud
                </Button>
              )}
              {state === "draining" && (
                <div className="text-xs text-muted-foreground">Draining… lag {lag}. Auto-advances when 0.</div>
              )}
              {state === "promoting" && (
                <Button size="sm" onClick={() => promote.mutate()} disabled={promote.isPending}>
                  Step 6 · Promote local + archive Cloud
                </Button>
              )}
              {state === "dns_swap" && (
                <>
                  <div className="text-xs text-muted-foreground w-full">
                    Swap DNS in Cloudflare so the casino subdomain points at the local node, then mark done.
                  </div>
                  <Button size="sm" onClick={() => setState.mutate("done")}>Step 7 · Mark done (start 1h rollback window)</Button>
                </>
              )}
              {state === "done" && (
                <>
                  <div className="text-xs text-muted-foreground w-full">
                    Rollback window: until {session.rollback_window_until ? fmtDateTime(session.rollback_window_until) : "—"}
                  </div>
                  {rollbackOpen && (
                    <Button size="sm" variant="destructive" onClick={() => rollback.mutate()} disabled={rollback.isPending}>
                      Roll back to Cloud-Primary
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Recent sessions</div>
            <div className="text-xs space-y-1 font-mono">
              {history.map((h: any) => (
                <div key={h.id} className="flex justify-between border-b py-1">
                  <span>{fmtDateTime(h.started_at)}</span>
                  <span>{h.state}</span>
                  <span>{h.target_node_id ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
