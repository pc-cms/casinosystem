import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useRealtimeSubscriptions } from "@/hooks/use-realtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHeader } from "./AppSidebar";

// Routes that need full-bleed width (no max-w container)
const FULL_WIDTH_ROUTES = ["/table-results"];

export const AppLayout = () => {
  useRealtimeSubscriptions();
  const isMobile = useIsMobile();
  const location = useLocation();
  const isFullWidth = FULL_WIDTH_ROUTES.some((p) => location.pathname.startsWith(p));

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <div className="no-print"><AppSidebar /></div>}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && <div className="no-print"><MobileHeader /></div>}
        <main className="flex-1 overflow-y-auto">
          {isFullWidth ? (
            <div className="p-3 sm:p-4 animate-fade-in h-full">
              <Outlet />
            </div>
          ) : (
            <div className="p-3 sm:p-6 max-w-7xl mx-auto animate-fade-in">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
