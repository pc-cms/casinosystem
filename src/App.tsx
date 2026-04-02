import { lazy, Suspense, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { createIDBPersister } from "@/lib/query-persister";
import { usePrefetchCriticalData } from "@/hooks/use-prefetch";
import { useRealtimeSubscriptions } from "@/hooks/use-realtime";
import { initSyncEngine } from "@/lib/sync-engine";
import Login from "@/pages/Login";

// Lazy-loaded pages — each becomes a separate chunk
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Players = lazy(() => import("@/pages/Players"));
const Cage = lazy(() => import("@/pages/Cage"));
const Tables = lazy(() => import("@/pages/Tables"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Logs = lazy(() => import("@/pages/Logs"));
const Stats = lazy(() => import("@/pages/Stats"));
const Pit = lazy(() => import("@/pages/Pit"));
const Groups = lazy(() => import("@/pages/Groups"));
const Reports = lazy(() => import("@/pages/Reports"));
const Admin = lazy(() => import("@/pages/Admin"));
const Staff = lazy(() => import("@/pages/Staff"));
const Finance = lazy(() => import("@/pages/Finance"));
const Reception = lazy(() => import("@/pages/Reception"));
const InCasino = lazy(() => import("@/pages/InCasino"));
const Blacklist = lazy(() => import("@/pages/Blacklist"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min — better for slow connections
      gcTime: 1000 * 60 * 60 * 24, // 24h — keep in cache for offline
      refetchOnWindowFocus: false, // avoid refetch storms on tab switch
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
    },
  },
});

const persister = createIDBPersister();

// Loading spinner for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Role-based route access map
const ROUTE_ROLES: Record<string, string[]> = {
  "/": ["manager", "pit", "reception", "finance_manager", "security"],
  "/players": ["manager", "cashier", "finance_manager", "security"],
  "/guests": ["manager", "reception", "pit", "finance_manager", "security"],
  "/blacklist": ["manager", "reception", "finance_manager", "security"],
  "/reception": ["manager", "reception", "finance_manager"],
  "/cage": ["manager", "cashier", "finance_manager"],
  "/tables": ["manager", "cashier", "pit", "finance_manager", "security"],
  "/expenses": ["manager", "cashier", "finance_manager"],
  "/pit": ["manager", "pit", "finance_manager"],
  "/floor": ["manager", "pit", "finance_manager"],
  "/groups": ["manager", "finance_manager"],
  "/finance": ["manager", "finance_manager"],
  "/reports": ["manager", "finance_manager", "security"],
  "/stats": ["manager", "finance_manager", "security"],
  "/logs": ["manager", "finance_manager", "security"],
  "/admin": ["manager"],
};

const RoleGuard = ({ path, children }: { path: string; children: React.ReactNode }) => {
  const { roles } = useAuth();
  const allowed = ROUTE_ROLES[path];
  if (allowed && !roles.some(r => allowed.includes(r))) {
    const fallback = roles.includes("cashier") ? "/cage" : "/";
    return <Navigate to={path === "/" ? fallback : "/"} replace />;
  }
  return <>{children}</>;
};

const getDefaultRoute = (roles: string[]) => {
  if (roles.includes("reception") && !roles.some(r => ["manager", "pit", "cashier", "finance_manager", "security"].includes(r))) {
    return "/reception";
  }
  if (roles.includes("cashier") && !roles.some(r => ["manager", "pit", "reception", "finance_manager", "security"].includes(r))) {
    return "/cage";
  }
  return "/";
};

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  // Prefetch critical data in background
  usePrefetchCriticalData();

  // Adaptive realtime subscriptions (full/polling/off based on connection quality)
  useRealtimeSubscriptions();

  // Initialize offline sync engine on mount
  useEffect(() => { initSyncEngine(); }, []);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground font-mono text-sm">Loading CMS...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<RoleGuard path="/"><Dashboard /></RoleGuard>} />
            <Route path="/players" element={<RoleGuard path="/players"><Players /></RoleGuard>} />
            <Route path="/cage" element={<RoleGuard path="/cage"><Cage /></RoleGuard>} />
            <Route path="/reception" element={<RoleGuard path="/reception"><Reception /></RoleGuard>} />
            <Route path="/guests" element={<RoleGuard path="/guests"><InCasino /></RoleGuard>} />
            <Route path="/blacklist" element={<RoleGuard path="/blacklist"><Blacklist /></RoleGuard>} />
            <Route path="/tables" element={<RoleGuard path="/tables"><Tables /></RoleGuard>} />
            <Route path="/expenses" element={<RoleGuard path="/expenses"><Expenses /></RoleGuard>} />
            <Route path="/pit" element={<RoleGuard path="/pit"><Pit /></RoleGuard>} />
            <Route path="/staff" element={<RoleGuard path="/floor"><Staff /></RoleGuard>} />
            <Route path="/floor" element={<RoleGuard path="/floor"><Staff /></RoleGuard>} />
            <Route path="/groups" element={<RoleGuard path="/groups"><Groups /></RoleGuard>} />
            <Route path="/finance" element={<RoleGuard path="/finance"><Finance /></RoleGuard>} />
            <Route path="/reports" element={<RoleGuard path="/reports"><Reports /></RoleGuard>} />
            <Route path="/stats" element={<RoleGuard path="/stats"><Stats /></RoleGuard>} />
            <Route path="/logs" element={<RoleGuard path="/logs"><Logs /></RoleGuard>} />
            <Route path="/admin" element={<RoleGuard path="/admin"><Admin /></RoleGuard>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

const AppRoutes = () => {
  const { user, loading, roles } = useAuth();
  if (loading) return null;
  const defaultRoute = user ? getDefaultRoute(roles) : "/";
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute} replace /> : <Login />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h
        buster: "v1",
      }}
    >
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  </ThemeProvider>
);

export default App;
