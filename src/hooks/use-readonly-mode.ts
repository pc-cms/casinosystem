/**
 * Read-only mode for the Surveillance role.
 *
 * Returns true when the current user is a pure "surveillance" user
 * (no manager / super_admin role and no active manager-override).
 * Surveillance has explicit allow-listed write actions handled by their own
 * components (post note, set tag, blacklist a player, create chip transfer);
 * everything else (Pit, Cage, Tables) must render in read-only mode.
 */
import { useAuth } from "@/lib/auth-context";

export const useReadOnlyMode = () => {
  const { roles, managerOverride } = useAuth();
  const isSurveillance = roles.includes("surveillance");
  const hasMgr = roles.includes("manager") || roles.includes("super_admin");
  return isSurveillance && !hasMgr && !managerOverride;
};

export const useIsSurveillance = () => {
  const { roles } = useAuth();
  return roles.includes("surveillance");
};
