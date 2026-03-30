import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, BarChart3, Sun, Moon, Shield, Gamepad2, 
  UsersRound, Grid3X3, LogOut, Settings, FileBarChart,
  CalendarDays, ClipboardCheck, ListChecks, Eye, Target,
  Building2, UserCheck, ClipboardPen, Coins, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { toast } from "sonner";

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "security";

// Logical grouping: Operations → Analytics → Admin
const NAV_ITEMS: { to: string; icon: typeof LayoutDashboard; label: string; shortcut: string; roles: AppRole[] }[] = [
  // — Overview —
  { to: "/", icon: LayoutDashboard, label: "Dashboard", shortcut: "D", roles: ["manager", "pit", "reception", "finance_manager", "security"] },
  { to: "/pit?tab=breaklist", icon: ListChecks, label: "Breaklist", shortcut: "B", roles: ["manager", "pit", "finance_manager"] },
  // — Operations (alphabetical) —
  { to: "/cage", icon: Landmark, label: "Cage", shortcut: "C", roles: ["manager", "cashier", "finance_manager"] },
  { to: "/expenses", icon: Receipt, label: "Expenses", shortcut: "E", roles: ["manager", "cashier", "finance_manager"] },
  { to: "/groups", icon: UsersRound, label: "Groups", shortcut: "G", roles: ["manager", "finance_manager"] },
  { to: "/players", icon: Users, label: "Players", shortcut: "P", roles: ["manager", "cashier", "reception", "finance_manager", "security"] },
  { to: "/tables", icon: Table2, label: "Tables", shortcut: "T", roles: ["manager", "cashier", "pit", "finance_manager", "security"] },
  // — HR / Staff (alphabetical) —
  { to: "/staff", icon: Building2, label: "Floor", shortcut: "F", roles: ["manager", "pit", "finance_manager"] },
  { to: "/pit", icon: Gamepad2, label: "Live Game", shortcut: "L", roles: ["manager", "pit", "finance_manager"] },
  // — Analytics (alphabetical) —
  { to: "/logs", icon: ClipboardList, label: "Logs", shortcut: "O", roles: ["manager", "finance_manager", "security"] },
  { to: "/reports", icon: FileBarChart, label: "Reports", shortcut: "R", roles: ["manager", "finance_manager", "security"] },
  { to: "/stats", icon: BarChart3, label: "Stats", shortcut: "S", roles: ["manager", "finance_manager", "security"] },
];

const TABLE_SUBITEMS: typeof PIT_SUBITEMS = [];

const PIT_SUBITEMS = [
  { tab: "activeplayers", icon: Users, label: "Active Players" },
  { tab: "attendance", icon: ClipboardCheck, label: "Attendance" },
  { tab: "tracker", icon: Eye, label: "Client Tracker" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
  { tab: "tabletracker", icon: Target, label: "Table Tracker" },
];

const STAFF_SUBITEMS = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
];

// Section separators by index in visible items
const SECTION_LABELS: Record<string, string> = {
  "/": "OVERVIEW",
  "/cage": "OPERATIONS",
  "/staff": "HR",
  "/logs": "ANALYTICS",
};

// Breaklist is a direct link, not part of pit subitems for "end" matching
const BREAKLIST_PATH = "/pit?tab=breaklist";

export const AppSidebar = () => {
  const { theme, toggle } = useTheme();
  const { displayName, roles, signOut, isManager, managerOverride, activateManagerOverride, deactivateManagerOverride } = useAuth();
  const location = useLocation();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);

  const isPitActive = location.pathname === "/pit";
  const isStaffActive = location.pathname === "/staff";
  const isTablesActive = location.pathname === "/tables";
  const currentTab = new URLSearchParams(location.search).get("tab") || 
    (isPitActive ? "employee" : isTablesActive ? "tables" : "employee");

  const visibleItems = NAV_ITEMS.filter(item =>
    roles.some(r => item.roles.includes(r as AppRole))
  );

  // Determine which section labels to show
  const sectionBreaks = new Set<string>();
  visibleItems.forEach(item => {
    if (SECTION_LABELS[item.to]) sectionBreaks.add(item.to);
  });

  const nativeManager = roles.includes("manager" as AppRole);

  const handleManagerOverrideConfirm = (managerId: string) => {
    // Get manager name from the dialog response - we'll extract from the log
    activateManagerOverride(managerId, "Manager");
    setShowOverrideDialog(false);
    toast.success("Manager Access activated");
  };

  const handleDeactivate = () => {
    deactivateManagerOverride();
    toast.info("Manager Access deactivated");
  };

  const renderSubItems = (basePath: string, items: typeof TABLE_SUBITEMS) => (
    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
      {items.map(sub => (
        <NavLink
          key={sub.tab}
          to={`${basePath}?tab=${sub.tab}`}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
            currentTab === sub.tab
              ? "bg-sidebar-accent text-sidebar-primary font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          }`}
        >
          <sub.icon className="w-3.5 h-3.5 shrink-0" />
          <span>{sub.label}</span>
        </NavLink>
      ))}
    </div>
  );

  return (
    <>
      <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CMS</span>
            </div>
            <NetworkStatusIndicator />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">Casino Ops</p>

          {/* Manager Access - in header for non-manager users */}
          {!nativeManager && (
            <div className="mt-2">
              {managerOverride.active ? (
                <button
                  onClick={handleDeactivate}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="flex-1 text-left">Manager Active</span>
                  <ShieldOff className="w-3.5 h-3.5 opacity-60" />
                </button>
              ) : (
                <button
                  onClick={() => setShowOverrideDialog(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="flex-1 text-left">Manager Access</span>
                </button>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {visibleItems.map((item, idx) => {
            const sectionLabel = SECTION_LABELS[item.to];
            const showLabel = sectionLabel && sectionBreaks.has(item.to);
            return (
              <div key={item.to}>
                {showLabel && (
                  <div className={`px-3 pt-3 pb-1 ${idx > 0 ? "mt-1 border-t border-sidebar-border" : ""}`}>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{sectionLabel}</span>
                  </div>
                )}
                <NavLink to={item.to} end={item.to === "/" || item.to === "/pit" || item.to === "/staff" || item.to === "/tables" || item.to === BREAKLIST_PATH}
                  className={({ isActive }) => {
                    // For breaklist shortcut, check manually
                    const isBreaklistItem = item.to === BREAKLIST_PATH;
                    const isBreaklistActive = isBreaklistItem && location.pathname === "/pit" && currentTab === "breaklist";
                    const active = isBreaklistItem ? isBreaklistActive : isActive;
                    return `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      active ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`;
                  }}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="cms-kbd">{item.shortcut}</span>
                </NavLink>
                {item.to === "/tables" && isTablesActive && renderSubItems("/tables", TABLE_SUBITEMS)}
                {item.to === "/pit" && isPitActive && renderSubItems("/pit", PIT_SUBITEMS)}
                {item.to === "/staff" && isStaffActive && renderSubItems("/staff", STAFF_SUBITEMS)}
              </div>
            );
          })}

          {isManager && (
            <>
              <div className="px-3 pt-3 pb-1 mt-1 border-t border-sidebar-border">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">SYSTEM</span>
              </div>
              <NavLink to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`
                }>
                <Settings className="w-4 h-4 shrink-0" />
                <span className="flex-1">Admin</span>
                <span className="cms-kbd">A</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
          <div className="px-3 py-1">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {roles.map(r => (
                <span key={r} className="text-[9px] font-mono px-1 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground">{r}</span>
              ))}
              {managerOverride.active && !nativeManager && (
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/20 text-primary font-bold">manager ↑</span>
              )}
            </div>
          </div>
          <button onClick={toggle}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </aside>

      <ManagerOverrideDialog
        open={showOverrideDialog}
        onClose={() => setShowOverrideDialog(false)}
        onConfirm={handleManagerOverrideConfirm}
        title="Manager Access"
        description="Authenticate as a manager to unlock elevated permissions."
        actionType="MANAGER_ACCESS_ACTIVATE"
        actionDetails={{ activated_by: displayName }}
      />
    </>
  );
};
