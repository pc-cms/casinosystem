import { useState, useEffect } from "react";
import { onSyncStatusChange, getSyncStatus, type SyncStatus } from "@/lib/sync-engine";

export function useNetworkStatus() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus().status);
  const [pendingCount, setPendingCount] = useState(getSyncStatus().pendingCount);

  useEffect(() => {
    const unsub = onSyncStatusChange((s, p) => {
      setStatus(s);
      setPendingCount(p);
    });
    return unsub;
  }, []);

  return { status, pendingCount };
}
