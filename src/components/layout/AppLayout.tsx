import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useRealtimeSubscriptions } from "@/hooks/use-realtime";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHeader } from "./AppSidebar";

export const AppLayout = () => {
  useRealtimeSubscriptions();
  useKeyboardNavigation();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <AppSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && <MobileHeader />}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
