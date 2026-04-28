import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, BarChart3, Sun, Moon, Shield, Gamepad2,
  UsersRound, LogOut, Settings, FileBarChart,
  ListChecks, Eye, Target,
  Building2, UserCheck, ClipboardPen, ShieldCheck, ShieldOff,
  Wallet, DoorOpen, ShieldAlert, Menu, Upload, FileText,
  ChevronsLeft, ChevronsRight, CreditCard, CalendarDays, ChevronDown, ChevronRight, Coins,
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

  // PIT — Live game floor (no Employee tab here)
  { to: "/pit", icon: Gamepad2, label: "Live Game", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "/pit?tab=breaklist", icon: ListChecks, label: "Breaklist", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "/tables", icon: Table2, label: "Tables", roles: ["super_admin", "manager", "cashier", "pit", "finance_manager", "surveillance"], section: "PIT" },
  { to: "/staff", icon: Building2, label: "Floor Staff", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },

  // CASHIER — Cage operations
  { to: "/cage", icon: Landmark, label: "Cage", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "CASHIER" },
  { to: "/expenses", icon: Receipt, label: "Expenses", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "CASHIER" },

  // RECEPTION — Players & entry
  { to: "/reception", icon: DoorOpen, label: "Reception", roles: ["super_admin", "manager", "reception", "finance_manager"], section: "RECEPTION" },
  { to: "/players", icon: Users, label: "Players", roles: ["super_admin", "manager", "finance_manager"], section: "RECEPTION" },
  { to: "/in-casino", icon: Eye, label: "In Casino", roles: ["super_admin", "manager", "reception", "pit", "finance_manager", "surveillance"], section: "RECEPTION" },
  { to: "/blacklist", icon: ShieldAlert, label: "Blacklist", roles: ["super_admin", "manager", "reception", "finance_manager", "surveillance"], section: "RECEPTION" },

  // FINANCE — alphabetical
  { to: "/bank-checks", icon: CreditCard, label: "Bank Checks", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=budget", icon: Target, label: "Budget", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=review", icon: ClipboardPen, label: "Daily Review", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=dashboard", icon: Wallet, label: "Dashboard", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=expenses", icon: Receipt, label: "Expenses", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/miss-chips", icon: Coins, label: "Miss Chips", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=summary", icon: FileBarChart, label: "Summary", roles: ["super_admin", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=transfers", icon: Upload, label: "Transfers", roles: ["super_admin", "finance_manager"], section: "FINANCE" },
  { to: "/finance?tab=wallets", icon: Wallet, label: "Wallets", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },

  // HR — Personnel admin (Employee tab visible)
  { to: "/pit", icon: Gamepad2, label: "Live Game", roles: ["super_admin", "manager", "hr"], section: "HR" },
  { to: "/staff", icon: Building2, label: "Floor Staff", roles: ["super_admin", "manager", "hr"], section: "HR" },

  // ANALYTICS — shared
  { to: "/groups", icon: UsersRound, label: "Groups", roles: ["super_admin", "manager", "finance_manager"], section: "ANALYTICS" },
  { to: "/reports", icon: FileBarChart, label: "Reports", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/stats", icon: BarChart3, label: "Stats", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  { to: "/table-results", icon: FileText, label: "Table Results", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },

  // SYSTEM — admin/system tools
  { to: "/import-reports", icon: Upload, label: "Import Reports", roles: ["super_admin", "manager"], section: "SYSTEM" },
  { to: "/logs", icon: ClipboardList, label: "Logs", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "SYSTEM" },


];

const TABLE_SUBITEMS = [
  { tab: "activeplayers", icon: Users, label: "Active Players" },
  { tab: "tracker", icon: Eye, label: "Player Tracker" },
  { tab: "tabletracker", icon: Target, label: "Table Tracker" },
];

// PIT-section variant (no Employee — Personnel admin lives in HR)
const PIT_SUBITEMS_OPS = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
];
// HR-section variant (with Employee)
const PIT_SUBITEMS_HR = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota", icon: CalendarDays, label: "Rota" },
];

const STAFF_SUBITEMS_OPS = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "rota_office", icon: CalendarDays, label: "Office Rota" },
  { tab: "rota_floor", icon: CalendarDays, label: "Floor Rota" },
  { tab: "rota_security", icon: ShieldCheck, label: "Security Rota" },
];
const STAFF_SUBITEMS_HR = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota_office", icon: CalendarDays, label: "Office Rota" },
  { tab: "rota_floor", icon: CalendarDays, label: "Floor Rota" },
  { tab: "rota_security", icon: ShieldCheck, label: "Security Rota" },
];

const WALLETS_SUBITEMS = [
  { tab: "cashcount", icon: Coins, label: "Cash Count" },
];

const BREAKLIST_PATH = "/pit?tab=breaklist";
const WALLETS_PATH = "/finance?tab=wallets";

// Helper: parse "/path?tab=foo" into { base, tab }
const parseItemTo = (to: string) => {
  const [base, q = ""] = to.split("?");
  const tab = new URLSearchParams(q).get("tab");
  return { base, tab };
};

// ============ Collapsible sections (expanded sidebar) ============
const SECTIONS_STORAGE_KEY = "cms.sidebar.openSections";
const FLAT_SECTION: Section = "OVERVIEW";

type SectionsProps = {
  visibleItems: NavItem[];
  isManager: boolean;
  isPitActive: boolean;
  isStaffActive: boolean;
  isTablesActive: boolean;
  currentTab: string;
  roles: AppRole[];
  onNavigate?: () => void;
  renderSubItems: (basePath: string, items: typeof TABLE_SUBITEMS) => JSX.Element;
};

const SidebarSections = ({
  visibleItems, isManager, isPitActive, isStaffActive, isTablesActive,
  currentTab, roles, onNavigate, renderSubItems,
}: SectionsProps) => {
  const location = useLocation();

  // Group items by section, preserving order
  const grouped = visibleItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.section] ||= []).push(item);
    return acc;
  }, {});
  const sectionOrder: Section[] = ["OVERVIEW", "PIT", "CASHIER", "RECEPTION", "FINANCE", "HR", "ANALYTICS", "SYSTEM"];
  const sections = sectionOrder.filter(s => grouped[s]?.length || (s === "SYSTEM" && isManager));

  // Find which section contains the active route
  const activeSection: Section | null = (() => {
    for (const s of sections) {
      const items = s === "SYSTEM"
        ? [...(grouped[s] || []), ...(isManager ? [{ to: "/admin" } as NavItem] : [])]
        : grouped[s] || [];
      const hit = items.some(it => {
        const base = it.to.split("?")[0];
        if (base === "/") return location.pathname === "/";
        return location.pathname.startsWith(base);
      });
      if (hit) return s;
    }
    return null;
  })();

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(SECTIONS_STORAGE_KEY) : null;
      if (stored) Object.assign(initial, JSON.parse(stored));
    } catch { /* ignore */ }
    if (activeSection) initial[activeSection] = true;
    return initial;
  });

  // Auto-open the section that contains the active route
  if (activeSection && !open[activeSection]) {
    // schedule update to avoid setState-in-render
    setTimeout(() => setOpen(o => ({ ...o, [activeSection]: true })), 0);
  }

  const toggle = (s: string) => {
    setOpen(prev => {
      const next = { ...prev, [s]: !prev[s] };
      try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const renderItem = (item: NavItem, sectionCtx: Section) => {
    const { base: itemBase, tab: itemTab } = parseItemTo(item.to);
    const isTabAware = itemTab !== null;
    const isTabAwareActive =
      isTabAware && location.pathname === itemBase && currentTab === itemTab;
    const isWalletsItem = item.to === WALLETS_PATH;
    const showWalletsSubs = isWalletsItem && isTabAwareActive;
    // Section-aware sub-items: HR section gets Employee tab, PIT section does not
    const pitSubs = sectionCtx === "HR" ? PIT_SUBITEMS_HR : PIT_SUBITEMS_OPS;
    const staffSubs = sectionCtx === "HR" ? STAFF_SUBITEMS_HR : STAFF_SUBITEMS_OPS;
    return (
      <div key={`${sectionCtx}:${item.to}`}>
        <NavLink
          to={item.to}
          end={item.to === "/" || item.to === "/pit" || item.to === "/staff" || item.to === "/tables" || isTabAware}
          onClick={onNavigate}
          className={({ isActive }) => {
            const active = isTabAware ? isTabAwareActive : isActive;
            return `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              active ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`;
          }}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
        </NavLink>
        {item.to === "/tables" && isTablesActive && (roles.includes("pit") || roles.includes("manager") || roles.includes("finance_manager")) && renderSubItems("/tables", TABLE_SUBITEMS)}
        {item.to === "/pit" && isPitActive && renderSubItems("/pit", pitSubs)}
        {item.to === "/staff" && isStaffActive && renderSubItems("/staff", staffSubs)}
        {showWalletsSubs && renderSubItems("/finance", WALLETS_SUBITEMS)}
      </div>
    );
  };

  return (
    <nav className="flex-1 py-2 px-2 overflow-y-auto">
      {sections.map((section, idx) => {
        const items: NavItem[] = section === "SYSTEM"
          ? [
              ...(grouped[section] || []),
              ...(isManager ? [{ to: "/admin", icon: Settings, label: "Admin", roles: ["manager"] as AppRole[], section: "SYSTEM" as Section }] : []),
            ]
          : grouped[section] || [];
        if (!items.length) return null;

        // OVERVIEW renders flat (no collapse) — single Dashboard item
        if (section === FLAT_SECTION) {
          return <div key={section} className="mb-1">{items.map(it => renderItem(it, section))}</div>;
        }

        const isOpen = !!open[section];
        return (
          <div key={section} className={idx > 0 ? "mt-1 border-t border-sidebar-border pt-1" : ""}>
            <button
              type="button"
              onClick={() => toggle(section)}
              className="w-full flex items-center gap-1 px-3 pt-2 pb-1 text-left hover:bg-sidebar-accent/50 rounded-md transition-colors"
            >
              {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{section}</span>
            </button>
            {isOpen && <div className="space-y-0.5">{items.map(it => renderItem(it, section))}</div>}
          </div>
        );
      })}
    </nav>
  );
};

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
              const { base: itemBase, tab: itemTab } = parseItemTo(item.to);
              const isTabAware = itemTab !== null;
              const isPlainPitActive = item.to === "/pit" && location.pathname === "/pit" && currentTab !== "breaklist";
              const isActive = isTabAware
                ? location.pathname === itemBase && currentTab === itemTab
                : item.to === "/pit"
                  ? isPlainPitActive
                  : item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(itemBase);
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

      <div className="px-3 py-2 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1">
          <p className="text-xs font-medium text-sidebar-foreground truncate flex-1" title={displayName ?? undefined}>
            {displayName}
          </p>
          <button
            onClick={() => { toggle(); onNavigate?.(); }}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={signOut}
            title="Sign out"
            className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        {managerOverride.active && !nativeManager && (
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/20 text-primary font-bold mt-1 ml-1 inline-block">
            Manager ↑
          </span>
        )}
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

  const currentTab = new URLSearchParams(location.search).get("tab");
  const currentItem =
    NAV_ITEMS.find(item => {
      const { base, tab } = parseItemTo(item.to);
      if (tab === null) return false;
      return location.pathname === base && currentTab === tab;
    }) ||
    NAV_ITEMS.find(item => {
      const { base, tab } = parseItemTo(item.to);
      if (tab !== null) return false;
      if (base === "/") return location.pathname === "/";
      return location.pathname.startsWith(base);
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
