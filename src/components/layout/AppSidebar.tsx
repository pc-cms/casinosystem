import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, BarChart3, Sun, Moon, Shield, Gamepad2, 
  UsersRound, Grid3X3, LogOut, Settings, FileBarChart,
  CalendarDays, ClipboardCheck, ListChecks, Eye, Target,
  Building2, UserCheck, ClipboardPen, Coins,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "security";

// Logical grouping: Operations → Analytics → Admin
const NAV_ITEMS: { to: string; icon: typeof LayoutDashboard; label: string; shortcut: string; roles: AppRole[] }[] = [
  // — Overview —
  { to: "/", icon: LayoutDashboard, label: "Dashboard", shortcut: "D", roles: ["manager", "cashier", "pit", "reception", "finance_manager", "security"] },
  // — Operations —
  { to: "/cage", icon: Landmark, label: "Cage", shortcut: "C", roles: ["manager", "cashier", "finance_manager"] },
  { to: "/tables", icon: Table2, label: "Tables", shortcut: "T", roles: ["manager", "cashier", "pit", "finance_manager", "security"] },
  { to: "/players", icon: Users, label: "Players", shortcut: "P", roles: ["manager", "cashier", "reception", "finance_manager", "security"] },
  { to: "/expenses", icon: Receipt, label: "Expenses", shortcut: "E", roles: ["manager", "cashier", "finance_manager"] },
  { to: "/groups", icon: UsersRound, label: "Groups", shortcut: "G", roles: ["manager", "finance_manager"] },
  // — HR / Staff —
  { to: "/pit", icon: Gamepad2, label: "Live Game", shortcut: "L", roles: ["manager", "pit", "finance_manager"] },
  { to: "/staff", icon: Building2, label: "Floor", shortcut: "F", roles: ["manager", "pit", "finance_manager"] },
  // — Analytics —
  { to: "/stats", icon: BarChart3, label: "Stats", shortcut: "S", roles: ["manager", "finance_manager", "security"] },
  { to: "/reports", icon: FileBarChart, label: "Reports", shortcut: "R", roles: ["manager", "finance_manager", "security"] },
  { to: "/logs", icon: ClipboardList, label: "Logs", shortcut: "O", roles: ["manager", "finance_manager", "security"] },
];

const TABLE_SUBITEMS = [
  { tab: "tables", icon: Coins, label: "Tables" },
  { tab: "tracker", icon: Grid3X3, label: "Tracker" },
  { tab: "players", icon: Eye, label: "Players" },
  { tab: "client-tracker", icon: Target, label: "Client Tracker" },
];

const PIT_SUBITEMS = [
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
  { tab: "attendance", icon: ClipboardCheck, label: "Attendance" },
  { tab: "breaklist", icon: ListChecks, label: "Breaklist" },
];

const STAFF_SUBITEMS = [
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
];

// Section separators by index in visible items
const SECTION_LABELS: Record<string, string> = {
  "/": "OVERVIEW",
  "/cage": "OPERATIONS",
  "/pit": "HR",
  "/stats": "ANALYTICS",
};

export const AppSidebar = () => {
  const { theme, toggle } = useTheme();
  const { displayName, roles, signOut, isManager } = useAuth();
  const location = useLocation();

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
    <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CMS</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">Casino Ops</p>
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
              <NavLink to={item.to} end={item.to === "/" || item.to === "/pit" || item.to === "/staff" || item.to === "/tables"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`
                }>
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
  );
};
