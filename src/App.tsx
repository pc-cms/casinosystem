import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { CMSProvider } from "@/lib/cms-context";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import Cage from "@/pages/Cage";
import Tables from "@/pages/Tables";
import Expenses from "@/pages/Expenses";
import Logs from "@/pages/Logs";
import Stats from "@/pages/Stats";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CMSProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/players" element={<Players />} />
                <Route path="/cage" element={<Cage />} />
                <Route path="/tables" element={<Tables />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/stats" element={<Stats />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CMSProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
