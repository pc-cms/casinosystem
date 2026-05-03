/**
 * Hooks for the Users & Roles admin tab.
 *
 * Why these live in their own file:
 *   The Admin page used to be a 1000-line file with role-specific UI (super_admin
 *   vs manager) tangled inside the same JSX. Editing a "manager view" feature
 *   would unintentionally affect "super_admin view" because both branches shared
 *   the same component tree. Splitting per-feature data hooks + UI keeps each
 *   role's view physically separate.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { toast } from "sonner";

export const ALL_ROLES = [
  "super_admin",
  "manager",
  "cashier",
  "pit",
  "reception",
  "finance_manager",
  "surveillance",
  "hr",
] as const;

export const NON_SUPER_ROLES = ALL_ROLES.filter(r => r !== "super_admin") as readonly string[];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  cashier: "Cashier",
  pit: "Pit Boss",
  reception: "Reception",
  finance_manager: "Finance",
  surveillance: "Surveillance",
  hr: "HR",
};

export type Profile = {
  user_id: string;
  display_name: string | null;
  casino_id: string | null;
  created_at?: string;
};

/** Profiles visible to the current user (own casino, or all for super/FM). */
export const useUsersProfiles = () => {
  const { roles } = useAuth();
  const { activeCasinoId } = useCasino();
  const isSuperOrFM = roles.includes("super_admin") || roles.includes("finance_manager");

  return useQuery({
    queryKey: ["admin-users:profiles", isSuperOrFM ? "all" : activeCasinoId],
    queryFn: async () => {
      let q = supabase.from("profiles").select("user_id, display_name, casino_id, created_at");
      if (!isSuperOrFM && activeCasinoId) q = q.eq("casino_id", activeCasinoId);
      const { data, error } = await q.order("display_name");
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: isSuperOrFM || !!activeCasinoId,
  });
};

/**
 * Fetches all (user_id, role) rows in ONE query, scoped by RLS.
 * Replaces the old N×R rpc('has_role') loop.
 */
export const useUsersRoles = (userIds: string[]) => {
  return useQuery({
    queryKey: ["admin-users:roles", userIds.slice().sort().join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, string[]>;
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data || []).forEach(r => {
        const uid = (r as any).user_id as string;
        const role = (r as any).role as string;
        if (!map[uid]) map[uid] = [];
        map[uid].push(role);
      });
      return map;
    },
    enabled: userIds.length > 0,
  });
};

export const useAllCasinos = () =>
  useQuery({
    queryKey: ["admin-users:casinos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("casinos").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

/** Atomic role-set update via SECURITY DEFINER RPC (manager scoped to own casino). */
export const useUpdateUserRoles = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      const { error } = await supabase.rpc("update_user_roles", {
        _user_id: userId,
        _roles: roles as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users:roles"] });
      toast.success("Roles updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Create a brand-new user via the create-user edge function. */
export const useCreateUser = () => {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  return useMutation({
    mutationFn: async (input: {
      login: string;
      password: string;
      display_name: string;
      roles: string[];
      casino_id?: string;
    }) => {
      const body: any = {
        login: input.login,
        password: input.password,
        display_name: input.display_name,
        roles: input.roles,
      };
      if (isSuperAdmin && input.casino_id) body.casino_id = input.casino_id;
      const { data, error } = await supabase.functions.invoke("create-user", { body });
      if (error) {
        // invoke() swallows the response body on non-2xx; pull it out of FunctionsHttpError.
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const parsed = await ctx.json();
            if (parsed?.error) detail = parsed.error;
          }
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users:profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-users:roles"] });
      toast.success(`User "${vars.login}" created`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
