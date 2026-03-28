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
import TableTracker from "@/pages/TableTracker";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
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
  "/": ["manager", "cashier", "pit", "reception", "finance_manager", "security"],
  "/players": ["manager", "cashier", "reception", "finance_manager", "security"],
  "/cage": ["manager", "cashier", "finance_manager"],
  "/tables": ["manager", "cashier", "pit", "finance_manager", "security"],
  "/expenses": ["manager", "cashier", "finance_manager"],
  "/pit": ["manager", "pit", "finance_manager"],
  "/groups": ["manager", "finance_manager"],
  "/tracker": ["manager", "pit"],
  "/reports": ["manager", "finance_manager", "security"],
  "/stats": ["manager", "finance_manager", "security"],
  "/logs": ["manager", "finance_manager", "security"],
  "/admin": ["manager"],
};

const RoleGuard = ({ path, children }: { path: string; children: React.ReactNode }) => {
  const { roles } = useAuth();
  const allowed = ROUTE_ROLES[path];
  if (allowed && !roles.some(r => allowed.includes(r))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/players" element={<RoleGuard path="/players"><Players /></RoleGuard>} />
        <Route path="/cage" element={<RoleGuard path="/cage"><Cage /></RoleGuard>} />
        <Route path="/tables" element={<RoleGuard path="/tables"><Tables /></RoleGuard>} />
        <Route path="/expenses" element={<RoleGuard path="/expenses"><Expenses /></RoleGuard>} />
        <Route path="/pit" element={<RoleGuard path="/pit"><Pit /></RoleGuard>} />
        <Route path="/groups" element={<RoleGuard path="/groups"><Groups /></RoleGuard>} />
        <Route path="/tracker" element={<RoleGuard path="/tracker"><TableTracker /></RoleGuard>} />
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
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
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
