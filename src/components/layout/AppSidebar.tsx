import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, BarChart3, Sun, Moon, Shield, Gamepad2,
  UsersRound, LogOut, Settings, FileBarChart,
  ListChecks, Eye, Target,
  Building2, UserCheck, ClipboardPen, ShieldCheck, ShieldOff,
  Wallet, DoorOpen, ShieldAlert, Menu, Upload, FileText,
  ChevronsLeft, ChevronsRight, CreditCard, CalendarDays, ChevronDown, ChevronRight,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "surveillance" | "super_admin" | "hr";

// Section labels for the hybrid grouping (roles + shared ANALYTICS)
type Section = "OVERVIEW" | "PIT" | "CASHIER" | "RECEPTION" | "FINANCE" | "HR" | "ANALYTICS" | "SYSTEM";

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles: AppRole[];
  section: Section;
};

const NAV_ITEMS: NavItem[] = [
  // OVERVIEW
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["super_admin", "manager", "pit", "reception", "finance_manager", "surveillance"], section: "OVERVIEW" },

  // PIT — Live game floor
  { to: "/pit", icon: Gamepad2, label: "Live Game", roles: ["super_admin", "manager", "pit", "finance_manager", "hr"], section: "PIT" },
  { to: "/pit?tab=breaklist", icon: ListChecks, label: "Breaklist", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "/tables", icon: Table2, label: "Tables", roles: ["super_admin", "manager", "cashier", "pit", "finance_manager", "surveillance"], section: "PIT" },

  // CASHIER — Cage operations
  { to: "/cage", icon: Landmark, label: "Cage", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "CASHIER" },
  { to: "/bank-checks", icon: CreditCard, label: "Bank Checks", roles: ["super_admin", "manager", "finance_manager"], section: "CASHIER" },
  { to: "/expenses", icon: Receipt, label: "Expenses", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "CASHIER" },

  // RECEPTION — Players & entry
  { to: "/reception", icon: DoorOpen, label: "Reception", roles: ["super_admin", "manager", "reception", "finance_manager"], section: "RECEPTION" },
  { to: "/players", icon: Users, label: "Players", roles: ["super_admin", "manager", "cashier", "finance_manager", "surveillance"], section: "RECEPTION" },
  { to: "/in-casino", icon: Eye, label: "In Casino", roles: ["super_admin", "manager", "reception", "pit", "finance_manager", "surveillance"], section: "RECEPTION" },
  { to: "/blacklist", icon: ShieldAlert, label: "Blacklist", roles: ["super_admin", "manager", "reception", "finance_manager", "surveillance"], section: "RECEPTION" },

  // FINANCE
  { to: "/finance", icon: Wallet, label: "Finance", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/groups", icon: UsersRound, label: "Groups", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/import-reports", icon: Upload, label: "Import Reports", roles: ["super_admin", "manager"], section: "FINANCE" },

  // HR
  { to: "/staff", icon: Building2, label: "Floor Staff", roles: ["super_admin", "manager", "pit", "finance_manager", "hr"], section: "HR" },

  // ANALYTICS — shared
  { to: "/table-results", icon: FileText, label: "Table Results", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/reports", icon: FileBarChart, label: "Reports", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/stats", icon: BarChart3, label: "Stats", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/logs", icon: ClipboardList, label: "Logs", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
];

const TABLE_SUBITEMS = [
  { tab: "activeplayers", icon: Users, label: "Active Players" },
  { tab: "tracker", icon: Eye, label: "Player Tracker" },
  { tab: "tabletracker", icon: Target, label: "Table Tracker" },
];

const PIT_SUBITEMS = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
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

// ============ Shared sidebar inner ============
type InnerProps = {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
};

const SidebarInner = ({ onNavigate, collapsed = false, onToggle }: InnerProps) => {
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

  // ============ Collapsed (icon rail) — desktop only ============
  if (collapsed && !onNavigate) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center py-3 gap-1 h-full">
          {/* Logo + expand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>

          <div className="w-8 border-t border-sidebar-border my-1" />

          {/* Nav icons (only top-level items, no sub-tabs) */}
          <nav className="flex-1 flex flex-col items-center gap-0.5 w-full px-2 overflow-hidden">
            {visibleItems.map((item) => {
              const isBreaklistItem = item.to === BREAKLIST_PATH;
              const isBreaklistActive = isBreaklistItem && location.pathname === "/pit" && currentTab === "breaklist";
              const isPlainPitActive = item.to === "/pit" && location.pathname === "/pit" && currentTab !== "breaklist";
              const isActive = isBreaklistItem
                ? isBreaklistActive
                : item.to === "/pit"
                  ? isPlainPitActive
                  : item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to.split("?")[0]);
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}

            {isManager && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cn(
                        "w-10 h-10 flex items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )
                    }
                  >
                    <Settings className="w-4 h-4" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">Admin</TooltipContent>
              </Tooltip>
            )}
          </nav>

          <div className="w-8 border-t border-sidebar-border my-1" />

          {/* Theme + sign out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // ============ Expanded (full sidebar) ============
  return (
    <>
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CMS</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <NetworkStatusIndicator />
            {onToggle && (
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                className="h-5 px-2 flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-sidebar-border"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
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

      <SidebarSections
        visibleItems={visibleItems}
        isManager={isManager}
        isPitActive={isPitActive}
        isStaffActive={isStaffActive}
        isTablesActive={isTablesActive}
        currentTab={currentTab}
        roles={roles as AppRole[]}
        onNavigate={onNavigate}
        renderSubItems={renderSubItems}
      />

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
        <button onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <LogOut className="w-3 h-3" /> Sign Out
        </button>
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
export const AppSidebar = ({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void } = {}) => (
  <aside
    className={cn(
      "h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 transition-[width] duration-150",
      collapsed ? "w-14" : "w-56"
    )}
  >
    <SidebarInner collapsed={collapsed} onToggle={onToggle} />
  </aside>
);

// ============ Mobile header + hamburger sheet ============
export const MobileHeader = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

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
