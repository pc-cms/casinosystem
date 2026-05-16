/**
 * SyncMirrorPanel — full-mirror initial sync controls.
 *
 * Case 1 (Local → Cloud): "Upload to Cloud" backfills sync_outbox with all
 *   existing local rows for this casino so cms-sync pushes them up.
 *
 * Case 2 (Cloud → Local): "Clone from Cloud" wipes casino-scoped local data
 *   and re-streams it from cloud-seed-export. Destructive — requires the
 *   casino name typed for confirmation.
 *
 * After either operation completes the peer mesh keeps both nodes in
 * bidirectional sync as before.
 *
 * Hidden in Cloud mode.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { CloudUpload, CloudDownload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  isLocalServer,
  useServerIdentity,
  useSeedPush, useSeedPushStatus,
  useCloneFromCloud, useCloneStatus,
} from "@/hooks/use-server-identity";

export const SyncMirrorPanel = () => {
  if (!isLocalServer()) return null;

  const { data: identity } = useServerIdentity();
  const seedPush = useSeedPush();
  const cloneMut = useCloneFromCloud();
  const seedStatus = useSeedPushStatus(true);
  const cloneStatus = useCloneStatus(true);

  const [showClone, setShowClone] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const casinoConfigured = !!identity?.casino_id && !identity?.unconfigured;
  const cloning = cloneStatus.data?.status === "running";

  const seedMarks = seedStatus.data?.marks ?? [];
  const seedRowsTotal = seedMarks.reduce((s, m) => s + (m.row_count || 0), 0);
  const peer = seedStatus.data?.peers?.find(p => p.status === "active");
  const outboxMax = seedStatus.data?.outbox?.max_id ?? 0;
  const pushCursor = peer?.last_push_cursor ?? 0;
  const uploadRemaining = Math.max(0, outboxMax - pushCursor);

  const cloneCounts = cloneStatus.data?.counts ?? {};
  const cloneTotal = Object.values(cloneCounts).reduce((s, n) => s + n, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Full Mirror Sync</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          One-time bulk operations between this local server and Cloud.
          Day-to-day changes flow automatically via the peer mesh.
        </p>
      </div>

      {!casinoConfigured && (
        <div className="text-xs rounded border border-dashed border-border p-3 text-muted-foreground">
          Configure Server Identity (casino) above before using these controls.
        </div>
      )}

      {casinoConfigured && (
        <>
          {/* ── Case 1: Upload local → Cloud ── */}
          <div className="rounded border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <CloudUpload className="w-4 h-4" /> Upload local data to Cloud
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Use after pairing a fresh Cloud peer to mirror every existing row.
                  Idempotent — already-uploaded tables are skipped.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => seedPush.mutate(undefined)}
                disabled={seedPush.isPending}
              >
                {seedPush.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5 mr-1" />}
                Upload
              </Button>
            </div>
            {seedMarks.length > 0 && (
              <div className="text-[11px] text-muted-foreground font-mono space-y-1 pt-2 border-t border-border">
                <div>Queued: {seedRowsTotal.toLocaleString()} rows · {seedMarks.length} tables</div>
                {peer ? (
                  <div>
                    Uploaded to <span className="text-foreground">{peer.display_name}</span>:
                    {" "}push cursor {pushCursor.toLocaleString()} / outbox max {outboxMax.toLocaleString()}
                    {uploadRemaining > 0
                      ? <span className="text-warning"> · {uploadRemaining.toLocaleString()} remaining</span>
                      : <span className="text-success inline-flex items-center gap-1"> <CheckCircle2 className="w-3 h-3" /> caught up</span>}
                  </div>
                ) : (
                  <div className="text-warning">No active peer — pair a Cloud peer first.</div>
                )}
                {peer?.last_push_error && (
                  <div className="text-destructive break-words">{peer.last_push_error}</div>
                )}
              </div>
            )}
          </div>

          {/* ── Case 2: Clone Cloud → local ── */}
          <div className="rounded border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <CloudDownload className="w-4 h-4" /> Clone from Cloud
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="text-destructive font-medium">Destructive.</span>
                  {" "}Wipes all local casino data and replaces it with the Cloud copy.
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => { setConfirmName(""); setShowClone(true); }}
                disabled={cloning}
              >
                {cloning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5 mr-1" />}
                Clone
              </Button>
            </div>
            {(cloneStatus.data?.status && cloneStatus.data.status !== "idle") && (
              <div className="text-[11px] text-muted-foreground font-mono space-y-1 pt-2 border-t border-border">
                <div>
                  Status: <span className={
                    cloneStatus.data.status === "done" ? "text-success" :
                    cloneStatus.data.status === "error" ? "text-destructive" :
                    "text-warning"
                  }>{cloneStatus.data.status}</span>
                  {cloneStatus.data.current_table && ` · current: ${cloneStatus.data.current_table}`}
                </div>
                <div>Imported: {cloneTotal.toLocaleString()} rows across {Object.keys(cloneCounts).length} tables</div>
                {cloneStatus.data.error && (
                  <div className="text-destructive break-words">{cloneStatus.data.error}</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm clone dialog */}
      <Dialog open={showClone} onOpenChange={setShowClone}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Clone from Cloud — destructive
            </DialogTitle>
            <DialogDescription className="text-xs">
              All local data will be deleted and replaced with the Cloud copy. Takes about
              3–5 minutes; local users may see brief inconsistencies until it finishes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded border border-border bg-muted/40 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Source (Cloud casino):</span>
                <span className="font-mono font-semibold">{identity?.casino_name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Casino ID:</span>
                <span className="font-mono text-[10px]">{identity?.casino_id ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Slug:</span>
                <span className="font-mono">{identity?.casino_slug ?? "—"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                The Cloud casino is bound by <span className="font-mono">CASINO_ID</span> in Server Identity above.
                Wrong casino? Cancel and update Server Identity first.
              </p>
            </div>

            <div>
              <Label className="text-xs">
                Type <span className="font-mono font-semibold">{identity?.casino_name}</span> to confirm
              </Label>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={identity?.casino_name ?? ""}
                autoFocus
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClone(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={confirmName.trim() !== (identity?.casino_name ?? "").trim() || cloneMut.isPending}
              onClick={() => { cloneMut.mutate(); setShowClone(false); }}
            >
              Wipe and Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
