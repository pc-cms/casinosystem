import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export const AppLayout = () => (
  <div className="flex h-screen overflow-hidden">
    <AppSidebar />
    <main className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto animate-fade-in">
        <Outlet />
      </div>
    </main>
  </div>
);
