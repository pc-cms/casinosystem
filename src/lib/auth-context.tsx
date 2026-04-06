import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "security" | "super_admin" | "hr";

type ManagerOverride = {
  active: boolean;
  managerId: string | null;
  managerName: string | null;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  casinoId: string | null;
  displayName: string | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  managerOverride: ManagerOverride;
  activateManagerOverride: (managerId: string, managerName: string) => void;
  deactivateManagerOverride: () => void;
  /** Override casinoId (used by CasinoProvider for subdomain routing) */
  overrideCasinoId: (id: string | null) => void;
  /** The profile's original casino_id (before any override) */
  primaryCasinoId: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profileCasinoId, setProfileCasinoId] = useState<string | null>(null);
  const [casinoIdOverride, setCasinoIdOverride] = useState<string | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [managerOverride, setManagerOverride] = useState<ManagerOverride>({
    active: false,
    managerId: null,
    managerName: null,
  });

  const clearDerivedState = useCallback(() => {
    setRoles([]);
    setProfileCasinoId(null);
    setCasinoIdOverride(undefined);
    setDisplayName(null);
    setManagerOverride({ active: false, managerId: null, managerName: null });
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const [{ data: profile, error: profileError }, { data: userRoles, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("casino_id, display_name").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileError) console.error("fetchProfile profile error", profileError);
    if (rolesError) console.error("fetchProfile roles error", rolesError);

    return {
      profileCasinoId: profile?.casino_id ?? null,
      displayName: profile?.display_name ?? null,
      roles: (userRoles ?? []).map(r => r.role as AppRole),
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setProfileLoading(!!session?.user);
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) clearDerivedState();
      })
      .catch((error) => {
        console.error("getSession error", error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        clearDerivedState();
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;

        setProfileLoading(!!nextSession?.user);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (!nextSession?.user) {
          clearDerivedState();
          setProfileLoading(false);
        }

        setAuthReady(true);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearDerivedState]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    clearDerivedState();
    setProfileLoading(true);

    void fetchProfile(user.id)
      .then((profile) => {
        if (cancelled) return;
        setProfileCasinoId(profile.profileCasinoId);
        setDisplayName(profile.displayName);
        setRoles(profile.roles);
      })
      .catch((error) => {
        console.error("fetchProfile error", error);
        if (!cancelled) clearDerivedState();
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, clearDerivedState, fetchProfile, user?.id]);

  const loading = !authReady || (!!user && profileLoading);

  const hasRole = useCallback(
    (role: AppRole) => roles.includes(role) || (role === "manager" && managerOverride.active),
    [roles, managerOverride.active]
  );

  const isManager = roles.includes("manager") || managerOverride.active;

  const activateManagerOverride = useCallback((managerId: string, managerName: string) => {
    setManagerOverride({ active: true, managerId, managerName });
  }, []);

  const deactivateManagerOverride = useCallback(() => {
    setManagerOverride({ active: false, managerId: null, managerName: null });
  }, []);

  const overrideCasinoId = useCallback((id: string | null) => {
    setCasinoIdOverride(id);
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    clearDerivedState();
    await supabase.auth.signOut();
  };

  // casinoId: use override if set, otherwise profile's casino
  const casinoId = casinoIdOverride !== undefined ? casinoIdOverride : profileCasinoId;

  return (
    <AuthContext.Provider value={{
      user, session, roles, casinoId, displayName, loading,
      hasRole, isManager, signIn, signOut,
      managerOverride, activateManagerOverride, deactivateManagerOverride,
      overrideCasinoId, primaryCasinoId: profileCasinoId,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
