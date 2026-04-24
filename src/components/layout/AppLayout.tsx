import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useRealtimeSubscriptions } from "@/hooks/use-realtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHeader } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Routes that need full-bleed width (no max-w container)
const FULL_WIDTH_ROUTES = ["/table-results"];

const STORAGE_KEY = "cms.sidebar.collapsed";

export const AppLayout = () => {
  useRealtimeSubscriptions();
  const isMobile = useIsMobile();
  const location = useLocation();
  const isFullWidth = FULL_WIDTH_ROUTES.some((p) => location.pathname.startsWith(p));

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Keyboard shortcut: Ctrl/Cmd + B
  useEffect(() => {
    if (isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && !collapsed && (
        <div className="no-print">
          <AppSidebar onCollapse={() => setCollapsed(true)} />
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!isMobile && collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Show sidebar (Ctrl+B)"
            className="no-print absolute top-4 left-2 h-5 px-2 flex items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent transition-colors z-30 shadow-sm"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        )}
        {isMobile && <div className="no-print"><MobileHeader /></div>}
        <main className="flex-1 overflow-y-auto">
          {isFullWidth ? (
            <div className={cn("p-3 sm:p-4 animate-fade-in h-full", !isMobile && collapsed && "pl-12 sm:pl-12")}>
              <Outlet />
            </div>
          ) : (
            <div className={cn("p-3 sm:p-6 max-w-7xl mx-auto animate-fade-in", !isMobile && collapsed && "pl-12 sm:pl-14")}>
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
