/**
 * BuildSnapshotButton — invokes cloud-snapshot-build edge function to bake
 * a fresh NDJSON snapshot for the active casino into the public
 * installer-snapshots bucket. New local installs download latest.ndjson.gz
 * from this bucket on first boot (Variant B baked seed).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import { toast } from "sonner";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export const BuildSnapshotButton = () => {
  const { activeCasinoId, activeCasino } = useCasino();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ size: number; latest: string; counts: Record<string, number> } | null>(null);

  const slug = activeCasino?.slug ?? null;
  const publicUrl = slug
    ? `https://${PROJECT_ID}.supabase.co/storage/v1/object/public/installer-snapshots/${slug}/latest.ndjson.gz`
    : null;

  const run = async () => {
    if (!activeCasinoId) {
      toast.error("Pick a casino first");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloud-snapshot-build", {
        body: { casino_id: activeCasinoId, tag: "manual" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "snapshot build failed");
      setLast({ size: data.size_bytes, latest: data.latest, counts: data.counts });
      const rows = Object.values(data.counts as Record<string, number>).reduce((a: number, n: number) => a + Math.max(0, n), 0);
      toast.success(`Snapshot baked · ${rows.toLocaleString("en-US").replace(/,/g, " ")} rows · ${(data.size_bytes / 1024 / 1024).toFixed(2)} MB`);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-card-foreground">Installer snapshot</h3>
          <p className="text-xs text-muted-foreground">
            Bake the current casino's data into <span className="font-mono">latest.ndjson.gz</span> so new local servers
            seed from it during <span className="font-mono">install.sh</span>.
          </p>
        </div>
        <Button onClick={run} disabled={busy || !activeCasinoId} className="gap-1.5 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {busy ? "Building…" : "Build Snapshot"}
        </Button>
      </div>

      {last && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Size: <span className="font-mono text-foreground">{(last.size / 1024 / 1024).toFixed(2)} MB</span></span>
            <span>Object: <span className="font-mono text-foreground">{last.latest}</span></span>
          </div>
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Public download URL
            </a>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Row counts ({Object.keys(last.counts).length} tables)</summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 font-mono">
              {Object.entries(last.counts).map(([t, n]) => (
                <div key={t} className="flex justify-between">
                  <span className="text-muted-foreground">{t}</span>
                  <span className={n < 0 ? "text-destructive" : "text-foreground"}>{n}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};
