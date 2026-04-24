import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, BarChart3, Sun, Moon, Shield, Gamepad2, 
  UsersRound, Grid3X3, LogOut, Settings, FileBarChart,
  CalendarDays, ClipboardCheck, ListChecks, Eye, Target,
  Building2, UserCheck, ClipboardPen, Coins, ShieldCheck, ShieldOff,
  Wallet, DoorOpen, ShieldAlert, Menu, X, Upload, FileText, PanelLeftClose,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "surveillance" | "super_admin" | "hr";

const NAV_ITEMS: { to: string; icon: typeof LayoutDashboard; label: string; shortcut: string; roles: AppRole[]; section: string }[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", shortcut: "D", roles: ["super_admin", "manager", "pit", "reception", "finance_manager", "surveillance"], section: "OVERVIEW" },
  { to: "/blacklist", icon: ShieldAlert, label: "Blacklist", shortcut: "B", roles: ["super_admin", "manager", "reception", "finance_manager", "surveillance"], section: "OPERATIONS" },
  { to: "/pit?tab=breaklist", icon: ListChecks, label: "Breaklist", shortcut: "Alt+B", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "OPERATIONS" },
  { to: "/cage", icon: Landmark, label: "Cage", shortcut: "C", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "OPERATIONS" },
  { to: "/expenses", icon: Receipt, label: "Expenses", shortcut: "E", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "OPERATIONS" },
  { to: "/finance", icon: Wallet, label: "Finance", shortcut: "F", roles: ["super_admin", "manager", "finance_manager"], section: "OPERATIONS" },
  { to: "/groups", icon: UsersRound, label: "Groups", shortcut: "G", roles: ["super_admin", "manager", "finance_manager"], section: "OPERATIONS" },
  { to: "/in-casino", icon: Users, label: "In Casino", shortcut: "Alt+G", roles: ["super_admin", "manager", "reception", "pit", "finance_manager", "surveillance"], section: "OPERATIONS" },
  { to: "/pit", icon: Gamepad2, label: "Live Game", shortcut: "L", roles: ["super_admin", "manager", "pit", "finance_manager", "hr"], section: "OPERATIONS" },
  { to: "/players", icon: Users, label: "Players", shortcut: "P", roles: ["super_admin", "manager", "cashier", "finance_manager", "surveillance"], section: "OPERATIONS" },
  { to: "/reception", icon: DoorOpen, label: "Reception", shortcut: "R", roles: ["super_admin", "manager", "reception", "finance_manager"], section: "OPERATIONS" },
  { to: "/tables", icon: Table2, label: "Tables", shortcut: "T", roles: ["super_admin", "manager", "cashier", "pit", "finance_manager", "surveillance"], section: "OPERATIONS" },
  { to: "/staff", icon: Building2, label: "Floor Staff", shortcut: "Alt+F", roles: ["super_admin", "manager", "pit", "finance_manager", "hr"], section: "HR" },
  { to: "/logs", icon: ClipboardList, label: "Logs", shortcut: "Alt+L", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/reports", icon: FileBarChart, label: "Reports", shortcut: "Alt+R", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/stats", icon: BarChart3, label: "Stats", shortcut: "S", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/table-results", icon: FileText, label: "Table Results", shortcut: "Alt+T", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/import-reports", icon: Upload, label: "Import Reports", shortcut: "Alt+I", roles: ["super_admin", "manager"], section: "ANALYTICS" },
];

const TABLE_SUBITEMS = [
  { tab: "activeplayers", icon: Users, label: "Active Players" },
  { tab: "tracker", icon: Eye, label: "Player Tracker" },
  { tab: "tabletracker", icon: Target, label: "Table Tracker" },
];

const PIT_SUBITEMS = [
  { tab: "attendance", icon: ClipboardCheck, label: "Attendance" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
];

const STAFF_SUBITEMS = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota_office", icon: CalendarDays, label: "Office Rota" },
  { tab: "rota_floor", icon: CalendarDays, label: "Floor Rota" },
  { tab: "rota_security", icon: ShieldCheck, label: "Security Rota" },
];

const BREAKLIST_PATH = "/pit?tab=breaklist";

// ============ Shared sidebar content ============
const SidebarInner = ({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) => {
  const { theme, toggle } = useTheme();
  const { displayName, roles, signOut, isManager, managerOverride, activateManagerOverride, deactivateManagerOverride } = useAuth();
  const { activeCasino, isSummaryMode } = useCasino();
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

  const nativeManager = roles.includes("manager" as AppRole);

  const handleManagerOverrideConfirm = (managerId: string) => {
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
          onClick={onNavigate}
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
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CMS</span>
          </div>
          <div className="flex flex-col items-stretch gap-1">
            <NetworkStatusIndicator />
            {onCollapse && (
              <button
                onClick={onCollapse}
                title="Hide sidebar (Ctrl+B)"
                className="h-6 w-full flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-sidebar-border"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">
          {isSummaryMode ? "All Casinos" : activeCasino?.name ?? "Casino Ops"}
        </p>

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
          const prevSection = idx > 0 ? visibleItems[idx - 1].section : "";
          const showLabel = item.section !== prevSection;
          return (
            <div key={item.to}>
              {showLabel && (
                <div className={`px-3 pt-3 pb-1 ${idx > 0 ? "mt-1 border-t border-sidebar-border" : ""}`}>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{item.section}</span>
                </div>
              )}
              <NavLink to={item.to} end={item.to === "/" || item.to === "/pit" || item.to === "/staff" || item.to === "/tables" || item.to === BREAKLIST_PATH}
                onClick={onNavigate}
                className={({ isActive }) => {
                  const isBreaklistItem = item.to === BREAKLIST_PATH;
                  const isBreaklistActive = isBreaklistItem && location.pathname === "/pit" && currentTab === "breaklist";
                  const active = isBreaklistItem ? isBreaklistActive : isActive;
                  return `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    active ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`;
                }}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {!onNavigate && <span className="cms-kbd">{item.shortcut}</span>}
              </NavLink>
              {item.to === "/tables" && isTablesActive && (roles.includes("pit" as AppRole) || roles.includes("manager" as AppRole) || roles.includes("finance_manager" as AppRole)) && renderSubItems("/tables", TABLE_SUBITEMS)}
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
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`
              }>
              <Settings className="w-4 h-4 shrink-0" />
              <span className="flex-1">Admin</span>
              {!onNavigate && <span className="cms-kbd">Alt+A</span>}
            </NavLink>
          </>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
              roles.includes("manager") ? "bg-primary/20 text-primary" :
              roles.includes("finance_manager") ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
              roles.includes("hr") ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" :
              roles.includes("pit") ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400" :
              roles.includes("cashier") ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
              roles.includes("reception") ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400" :
              roles.includes("surveillance") ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" :
              "bg-sidebar-accent text-sidebar-accent-foreground"
            }`}>
              {(() => {
                const priority: AppRole[] = ["manager", "finance_manager", "hr", "pit", "cashier", "reception", "surveillance"];
                const primary = priority.find(r => roles.includes(r)) || roles[0] || "user";
                const labels: Record<string, string> = {
                  manager: "Manager", finance_manager: "Finance", hr: "HR", pit: "Pit",
                  cashier: "Cashier", reception: "Reception", surveillance: "Surveillance",
                };
                return labels[primary] || primary.charAt(0).toUpperCase() + primary.slice(1);
              })()}
            </span>
          </div>
          {managerOverride.active && !nativeManager && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/20 text-primary font-bold mt-1 inline-block">Manager ↑</span>
          )}
        </div>
        <button onClick={() => { toggle(); onNavigate?.(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={signOut}
            className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              title="Hide sidebar (Ctrl+B)"
              className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

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

// ============ Desktop sidebar ============
export const AppSidebar = ({ onCollapse }: { onCollapse?: () => void } = {}) => (
  <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
    <SidebarInner onCollapse={onCollapse} />
  </aside>
);

// ============ Mobile header + hamburger sheet ============
export const MobileHeader = () => {
  const [open, setOpen] = useState(false);
  const { displayName } = useAuth();
  const location = useLocation();

  // Get current page title
  const currentItem = NAV_ITEMS.find(item => {
    if (item.to === "/") return location.pathname === "/";
    return location.pathname.startsWith(item.to.split("?")[0]);
  });
  const pageTitle = currentItem?.label || "CMS";

  return (
    <>
      <header className="h-12 flex items-center gap-2 px-3 border-b border-border bg-sidebar shrink-0">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Shield className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">{pageTitle}</span>
        </div>
        <NetworkStatusIndicator />
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarInner onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
};
