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
import { CasinoProvider, useCasino, getSlugFromHostname } from "@/lib/casino-context";
import { BrandingProvider } from "@/lib/branding";
import { AppLayout } from "@/components/layout/AppLayout";
import { createIDBPersister } from "@/lib/query-persister";
import { usePrefetchCriticalData } from "@/hooks/use-prefetch";
import { useRealtimeSubscriptions } from "@/hooks/use-realtime";
import { initSyncEngine } from "@/lib/sync-engine";
import Login from "@/pages/Login";
const Landing = lazy(() => import("@/pages/Landing"));
const CctvView = lazy(() => import("@/pages/CctvView"));

// Lazy-loaded pages — each becomes a separate chunk
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Players = lazy(() => import("@/pages/Players"));
const PlayerProfile = lazy(() => import("@/pages/PlayerProfile"));
const Cage = lazy(() => import("@/pages/Cage"));
const Tables = lazy(() => import("@/pages/Tables"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Logs = lazy(() => import("@/pages/Logs"));

const Pit = lazy(() => import("@/pages/Pit"));
const Groups = lazy(() => import("@/pages/Groups"));
const Reports = lazy(() => import("@/pages/Reports"));
const Admin = lazy(() => import("@/pages/Admin"));
const Staff = lazy(() => import("@/pages/Staff"));
const FinanceWalletsPage = lazy(() => import("@/pages/finance/FinanceWalletsPage"));
const FinanceDashboardPage = lazy(() => import("@/pages/finance/FinanceDashboardPage"));
const FinanceReviewPage = lazy(() => import("@/pages/finance/FinanceReviewPage"));
const FinanceExpensesPage = lazy(() => import("@/pages/finance/FinanceExpensesPage"));
const FinanceBudgetPage = lazy(() => import("@/pages/finance/FinanceBudgetPage"));
const FinanceCashCountPage = lazy(() => import("@/pages/finance/FinanceCashCountPage"));
const FinanceSummaryPage = lazy(() => import("@/pages/finance/FinanceSummaryPage"));
const FinanceTransfersPage = lazy(() => import("@/pages/finance/FinanceTransfersPage"));
const Reception = lazy(() => import("@/pages/Reception"));
const InCasino = lazy(() => import("@/pages/InCasino"));
const Blacklist = lazy(() => import("@/pages/Blacklist"));
const ImportReports = lazy(() => import("@/pages/ImportReports"));
const TableResults = lazy(() => import("@/pages/TableResults"));
const BankChecks = lazy(() => import("@/pages/BankChecks"));
const MissChips = lazy(() => import("@/pages/MissChips"));
const TableTracker = lazy(() => import("@/pages/TableTracker"));
const TablesAnalytics = lazy(() => import("@/pages/TablesAnalytics"));
const PlayerStatistics = lazy(() => import("@/pages/PlayerStatistics"));
const Cashless = lazy(() => import("@/pages/Cashless"));
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

const FullScreenLoader = ({ label = "Loading CMS..." }: { label?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-muted-foreground font-mono text-sm">{label}</p>
    </div>
  </div>
);

// Role-based route access map
const ROUTE_ROLES: Record<string, string[]> = {
  "/": ["super_admin", "manager", "pit", "reception", "finance_manager", "surveillance"],
  "/players": ["super_admin", "manager", "finance_manager", "surveillance"],
  "/players/:id": ["super_admin", "manager", "pit", "reception", "finance_manager", "surveillance"],
  "/in-casino": ["super_admin", "manager", "reception", "finance_manager", "surveillance"],
  "/blacklist": ["super_admin", "manager", "reception", "finance_manager", "surveillance"],
  "/reception": ["super_admin", "manager", "reception", "finance_manager"],
  "/cage": ["super_admin", "manager", "cashier", "finance_manager"],
  "/tables": ["super_admin", "manager", "cashier", "pit", "finance_manager", "surveillance"],
  "/active-players": ["super_admin", "manager", "pit", "finance_manager"],
  "/player-statistics": ["super_admin", "manager", "pit", "finance_manager"],
  "/table-tracker": ["super_admin", "manager", "pit", "finance_manager"],
  "/tables/analytics": ["super_admin", "manager", "finance_manager", "pit"],
  "/expenses": ["super_admin", "manager", "cashier", "finance_manager"],
  "/cashless": ["super_admin", "manager", "cashier", "finance_manager"],
  "/pit": ["super_admin", "manager", "pit", "finance_manager", "hr"],
  "/floor": ["super_admin", "manager", "pit", "finance_manager", "hr"],
  "/groups": ["super_admin", "manager", "finance_manager"],
  "/finance": ["super_admin", "manager", "finance_manager"],
  "/finance/wallets": ["super_admin", "manager", "finance_manager"],
  "/finance/dashboard": ["super_admin", "manager", "finance_manager"],
  "/finance/review": ["super_admin", "manager", "finance_manager"],
  "/finance/expenses": ["super_admin", "manager", "finance_manager"],
  "/finance/budget": ["super_admin", "manager", "finance_manager"],
  "/finance/cash-count": ["super_admin", "manager", "finance_manager"],
  "/finance/summary": ["super_admin", "finance_manager"],
  "/finance/transfers": ["super_admin", "finance_manager"],
  "/reports": ["super_admin", "manager", "finance_manager", "surveillance"],
  
  "/logs": ["super_admin", "manager", "finance_manager", "surveillance"],
  "/admin": ["super_admin", "manager"],
  "/import-reports": ["super_admin", "manager"],
  "/table-results": ["super_admin", "manager", "finance_manager", "surveillance"],
  "/staff": ["super_admin", "manager", "pit", "finance_manager", "hr"],
  "/bank-checks": ["super_admin", "manager", "finance_manager"],
  "/miss-chips": ["super_admin", "manager", "finance_manager", "surveillance"],
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
  if (roles.includes("super_admin")) return "/admin";
  // Security-only users on premier will be handled by CCTV mode, but default route still needed
  if (roles.includes("surveillance") && !roles.some(r => ["manager", "pit", "cashier", "reception", "finance_manager", "super_admin", "hr"].includes(r))) {
    return "/";
  }
  if (roles.includes("hr") && !roles.some(r => ["manager", "pit", "cashier", "reception", "finance_manager", "surveillance", "super_admin"].includes(r))) {
    return "/staff";
  }
  if (roles.includes("reception") && !roles.some(r => ["manager", "pit", "cashier", "finance_manager", "surveillance", "super_admin", "hr"].includes(r))) {
    return "/reception";
  }
  if (roles.includes("cashier") && !roles.some(r => ["manager", "pit", "reception", "finance_manager", "surveillance", "super_admin", "hr"].includes(r))) {
    return "/cage";
  }
  return "/";
};

const ProtectedRoutes = () => {
  const { user, loading, roles } = useAuth();
  const detectedSlug = getSlugFromHostname();

  // Prefetch critical data in background
  usePrefetchCriticalData();

  // Adaptive realtime subscriptions (full/polling/off based on connection quality)
  useRealtimeSubscriptions();

  // Initialize offline sync engine on mount
  useEffect(() => { initSyncEngine(); }, []);
  if (loading) {
    return <FullScreenLoader />;
  }
  if (!user) return <Navigate to="/login" replace />;

  // CCTV mode: surveillance role on premier subdomain gets dedicated interface
  const isCctvMode = detectedSlug === "__premier__" && roles.includes("surveillance") &&
    !roles.includes("super_admin") && !roles.includes("finance_manager");

  if (isCctvMode) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="*" element={<CctvView />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleGuard path="/"><Dashboard /></RoleGuard>} />
          <Route path="/players" element={<RoleGuard path="/players"><Players /></RoleGuard>} />
          <Route path="/players/:id" element={<RoleGuard path="/players/:id"><PlayerProfile /></RoleGuard>} />
          <Route path="/cage" element={<RoleGuard path="/cage"><ErrorBoundary><Cage /></ErrorBoundary></RoleGuard>} />
          <Route path="/reception" element={<RoleGuard path="/reception"><Reception /></RoleGuard>} />
          <Route path="/in-casino" element={<RoleGuard path="/in-casino"><InCasino /></RoleGuard>} />
          <Route path="/blacklist" element={<RoleGuard path="/blacklist"><Blacklist /></RoleGuard>} />
          <Route path="/tables" element={<RoleGuard path="/tables"><Tables /></RoleGuard>} />
          <Route path="/active-players" element={<Navigate to="/player-statistics" replace />} />
          <Route path="/player-statistics" element={<RoleGuard path="/player-statistics"><PlayerStatistics /></RoleGuard>} />
          <Route path="/player-tracker" element={<Navigate to="/player-statistics" replace />} />
          <Route path="/table-tracker" element={<RoleGuard path="/table-tracker"><TableTracker /></RoleGuard>} />
          <Route path="/tables/analytics" element={<RoleGuard path="/tables/analytics"><TablesAnalytics /></RoleGuard>} />
          <Route path="/expenses" element={<RoleGuard path="/expenses"><Expenses /></RoleGuard>} />
          <Route path="/cashless" element={<RoleGuard path="/cashless"><Cashless /></RoleGuard>} />
          <Route path="/pit" element={<RoleGuard path="/pit"><ErrorBoundary><Pit /></ErrorBoundary></RoleGuard>} />
          <Route path="/staff" element={<RoleGuard path="/floor"><Staff /></RoleGuard>} />
          <Route path="/floor" element={<RoleGuard path="/floor"><Staff /></RoleGuard>} />
          <Route path="/groups" element={<RoleGuard path="/groups"><Groups /></RoleGuard>} />
          <Route path="/finance" element={<Navigate to="/finance/wallets" replace />} />
          <Route path="/finance/wallets" element={<RoleGuard path="/finance/wallets"><ErrorBoundary><FinanceWalletsPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/dashboard" element={<RoleGuard path="/finance/dashboard"><ErrorBoundary><FinanceDashboardPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/review" element={<RoleGuard path="/finance/review"><ErrorBoundary><FinanceReviewPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/expenses" element={<RoleGuard path="/finance/expenses"><ErrorBoundary><FinanceExpensesPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/budget" element={<RoleGuard path="/finance/budget"><ErrorBoundary><FinanceBudgetPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/cash-count" element={<RoleGuard path="/finance/cash-count"><ErrorBoundary><FinanceCashCountPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/summary" element={<RoleGuard path="/finance/summary"><ErrorBoundary><FinanceSummaryPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/finance/transfers" element={<RoleGuard path="/finance/transfers"><ErrorBoundary><FinanceTransfersPage /></ErrorBoundary></RoleGuard>} />
          <Route path="/reports" element={<RoleGuard path="/reports"><Reports /></RoleGuard>} />
          <Route path="/stats" element={<Navigate to="/players" replace />} />
          <Route path="/logs" element={<RoleGuard path="/logs"><Logs /></RoleGuard>} />
          <Route path="/admin" element={<RoleGuard path="/admin"><Admin /></RoleGuard>} />
          <Route path="/import-reports" element={<RoleGuard path="/import-reports"><ImportReports /></RoleGuard>} />
          <Route path="/table-results" element={<RoleGuard path="/table-results"><TableResults /></RoleGuard>} />
          <Route path="/bank-checks" element={<RoleGuard path="/bank-checks"><BankChecks /></RoleGuard>} />
          <Route path="/miss-chips" element={<RoleGuard path="/miss-chips"><MissChips /></RoleGuard>} />
          <Route path="/reports/miss-chips" element={<Navigate to="/miss-chips" replace />} />
        </Route>
        <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
      </Routes>
    </ErrorBoundary>
  );
};

const AppRoutes = () => {
  const { user, loading, roles } = useAuth();
  const detectedSlug = getSlugFromHostname();

  // Root domain → landing page (no auth required)
  if (detectedSlug === "__landing__") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    );
  }

  if (loading) return <FullScreenLoader label="Restoring session..." />;
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
          <CasinoProvider>
            <BrandingProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </BrandingProvider>
          </CasinoProvider>
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  </ThemeProvider>
);

export default App;
