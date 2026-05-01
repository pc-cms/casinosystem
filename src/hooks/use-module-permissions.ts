/**
 * Module permissions hooks.
 *
 * Allow-list semantics:
 *   - super_admin always sees everything (bypass).
 *   - If user has zero rows in user_module_permissions → role defaults apply (no UI restriction).
 *   - If user has ≥ 1 row → only modules with can_view=true are visible.
 *
 * RLS is the real security boundary; this hook only hides nav items.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { ModuleKey } from "@/lib/modules";
import { toast } from "sonner";

interface PermissionRow {
  module_key: string;
  can_view: boolean;
}

/** Fetch current user's allowed modules. Returns null if no overrides set. */
export const useMyModulePermissions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-module-permissions", user?.id],
    queryFn: async (): Promise<Set<string> | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("module_key, can_view")
        .eq("user_id", user.id);
      if (error) throw error;
      if (!data || data.length === 0) return null; // no overrides → role defaults
      return new Set((data as PermissionRow[]).filter(r => r.can_view).map(r => r.module_key));
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
};

/**
 * Hook: returns true if the current user can see the given module.
 * super_admin always true. No overrides → true (role defaults). Otherwise allow-list.
 */
export const useModuleAccess = (moduleKey: ModuleKey): boolean => {
  const { roles } = useAuth();
  const { data: allowed } = useMyModulePermissions();
  if (roles.includes("super_admin")) return true;
  if (allowed === null || allowed === undefined) return true;
  return allowed.has(moduleKey);
};

/** Admin: read another user's permissions. */
export const useUserModulePermissions = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-module-permissions", userId],
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();
      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("module_key, can_view")
        .eq("user_id", userId);
      if (error) throw error;
      return new Set((data as PermissionRow[] | null ?? []).filter(r => r.can_view).map(r => r.module_key));
    },
    enabled: !!userId,
  });
};

/** Admin: replace the full set of allowed modules for a user. */
export const useSetUserModulePermissions = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ userId, allowed }: { userId: string; allowed: ModuleKey[] }) => {
      // Strategy: delete existing rows, then insert new allow-list.
      // If allowed is empty → all rows removed → reverts to "no overrides" (role defaults).
      const { error: delErr } = await supabase
        .from("user_module_permissions")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;

      if (allowed.length === 0) return;

      const rows = allowed.map(module_key => ({
        user_id: userId,
        module_key,
        can_view: true,
        granted_by: user?.id ?? null,
      }));
      const { error: insErr } = await supabase
        .from("user_module_permissions")
        .insert(rows);
      if (insErr) throw insErr;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user-module-permissions", vars.userId] });
      qc.invalidateQueries({ queryKey: ["my-module-permissions"] });
      toast.success("Permissions updated");
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
};
