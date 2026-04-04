import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "security" | "super_admin";

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
  const [casinoId, setCasinoId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [managerOverride, setManagerOverride] = useState<ManagerOverride>({
    active: false,
    managerId: null,
    managerName: null,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("casino_id, display_name")
      .eq("user_id", userId)
      .single();
    
    if (profile) {
      setCasinoId(profile.casino_id);
      setDisplayName(profile.display_name);
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (userRoles) {
      setRoles(userRoles.map(r => r.role as AppRole));
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setRoles([]);
          setCasinoId(null);
          setDisplayName(null);
          setManagerOverride({ active: false, managerId: null, managerName: null });
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    setManagerOverride({ active: false, managerId: null, managerName: null });
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, roles, casinoId, displayName, loading,
      hasRole, isManager, signIn, signOut,
      managerOverride, activateManagerOverride, deactivateManagerOverride,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
