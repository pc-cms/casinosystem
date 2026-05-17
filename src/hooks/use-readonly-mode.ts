/**
 * Read-only mode.
 *
 * Returns true when ANY of:
 *   - Surveillance user without manager / super_admin / override
 *   - Replication mode says this node is currently REPLICA
 *     (e.g. local node when Cloud is primary, or Cloud when local was promoted)
 *
 * Surveillance has explicit allow-listed write actions handled by their own
 * components. The replica check is global — direct writes here would be
 * rejected server-side by the `_enforce_replication_mode` trigger anyway,
 * so we surface read-only UI to avoid confusing errors.
 *
 * super_admin bypasses the replica block (emergency override).
 */
import { useAuth } from "@/lib/auth-context";
import { useReplicationMode } from "@/hooks/use-replication-mode";

export const useReadOnlyMode = () => {
  const { roles, managerOverride } = useAuth();
  const { isReplica } = useReplicationMode();

  const isSurveillance = roles.includes("surveillance");
  const hasMgr = roles.includes("manager") || roles.includes("super_admin");
  const isSuper = roles.includes("super_admin");

  if (isSurveillance && !hasMgr && !managerOverride) return true;
  if (isReplica && !isSuper) return true;
  return false;
};

export const useIsSurveillance = () => {
  const { roles } = useAuth();
  return roles.includes("surveillance");
};
