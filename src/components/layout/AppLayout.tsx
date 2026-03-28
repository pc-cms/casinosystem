import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useRealtimeSubscriptions } from "@/hooks/use-realtime";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-nav";

export const AppLayout = () => {
  useRealtimeSubscriptions();
  useKeyboardNavigation();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
