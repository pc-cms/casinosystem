import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import Cage from "@/pages/Cage";
import Tables from "@/pages/Tables";
import Expenses from "@/pages/Expenses";
import Logs from "@/pages/Logs";
import Stats from "@/pages/Stats";
import Pit from "@/pages/Pit";
import Groups from "@/pages/Groups";
// TableTracker is now embedded in Tables page
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import Staff from "@/pages/Staff";
import Finance from "@/pages/Finance";
import Reception from "@/pages/Reception";
import InCasino from "@/pages/InCasino";
import Blacklist from "@/pages/Blacklist";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// Role-based route access map
const ROUTE_ROLES: Record<string, string[]> = {
  "/": ["manager", "pit", "reception", "finance_manager", "security"],
  "/players": ["manager", "cashier", "reception", "finance_manager", "security"],
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
    // Cashiers blocked from dashboard → send to cage
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
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<RoleGuard path="/"><Dashboard /></RoleGuard>} />
        <Route path="/players" element={<RoleGuard path="/players"><Players /></RoleGuard>} />
        <Route path="/cage" element={<RoleGuard path="/cage"><Cage /></RoleGuard>} />
        <Route path="/reception" element={<RoleGuard path="/reception"><Reception /></RoleGuard>} />
        <Route path="/tables" element={<RoleGuard path="/tables"><Tables /></RoleGuard>} />
        <Route path="/expenses" element={<RoleGuard path="/expenses"><Expenses /></RoleGuard>} />
        <Route path="/pit" element={<RoleGuard path="/pit"><Pit /></RoleGuard>} />
        <Route path="/staff" element={<RoleGuard path="/floor"><Staff /></RoleGuard>} />
        <Route path="/floor" element={<RoleGuard path="/floor"><Staff /></RoleGuard>} />
        <Route path="/groups" element={<RoleGuard path="/groups"><Groups /></RoleGuard>} />
        <Route path="/finance" element={<RoleGuard path="/finance"><Finance /></RoleGuard>} />
        {/* tracker is now under /tables?tab=tracker */}
        <Route path="/reports" element={<RoleGuard path="/reports"><Reports /></RoleGuard>} />
        <Route path="/stats" element={<RoleGuard path="/stats"><Stats /></RoleGuard>} />
        <Route path="/logs" element={<RoleGuard path="/logs"><Logs /></RoleGuard>} />
        <Route path="/admin" element={<RoleGuard path="/admin"><Admin /></RoleGuard>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
