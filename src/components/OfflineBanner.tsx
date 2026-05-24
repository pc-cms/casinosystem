import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * Top-of-screen banner that surfaces network outages and pending sync state
 * to every operator. Stays out of the way when fully online with no queue.
 *
 * - red    : offline (writes are queued, reads come from cache)
 * - amber  : online but draining the sync queue
 * - amber  : chunk missing while offline (route never visited online)
 */
export const OfflineBanner = () => {
  const { status, pendingCount } = useNetworkStatus();
  const [chunkMissing, setChunkMissing] = useState(false);

  useEffect(() => {
    const onChunk = () => setChunkMissing(true);
    const onOnline = () => setChunkMissing(false);
    window.addEventListener("cms:offline-chunk-missing", onChunk);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("cms:offline-chunk-missing", onChunk);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (status === "online" && pendingCount === 0 && !chunkMissing) return null;

  const isOffline = status === "offline";
  const isSyncing = status === "syncing" || (status === "online" && pendingCount > 0);

  const tone = isOffline
    ? "bg-destructive text-destructive-foreground"
    : "bg-amber-500 text-black";

  const Icon = isOffline ? WifiOff : isSyncing ? RefreshCw : AlertTriangle;
  const label = isOffline
    ? "Offline — actions are saved locally and will sync when connection returns"
    : chunkMissing
    ? "This screen was never loaded online — go back and try another page until you're back online"
    : `Syncing ${pendingCount} pending action${pendingCount === 1 ? "" : "s"}…`;

  return (
    <div
      className={cn(
        "no-print flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider",
        tone,
      )}
      role="status"
    >
      <Icon className={cn("w-3.5 h-3.5 shrink-0", isSyncing && "animate-spin")} />
      <span className="truncate">{label}</span>
    </div>
  );
};
