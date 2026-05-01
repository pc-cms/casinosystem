import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, Sun, Moon, Shield, Gamepad2,
  UsersRound, LogOut, Settings, FileBarChart,
  ListChecks, Eye, Target,
  Building2, UserCheck, ClipboardPen, ShieldCheck, ShieldOff,
  Wallet, DoorOpen, ShieldAlert, Menu, Upload, FileText,
  ChevronsLeft, ChevronsRight, CreditCard, CalendarDays, ChevronDown, ChevronRight, Coins, Briefcase,
  RefreshCw,
} from "lucide-react";
import { resetPWACache } from "@/lib/pwa-register";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { useMyModulePermissions } from "@/hooks/use-module-permissions";
import { moduleKeyForRoute } from "@/lib/route-module-map";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { VersionIndicator } from "@/components/VersionIndicator";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import arushaLogo from "@/assets/arusha-logo.png";

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

  // PIT — Break List, Live Tables, trackers, Attendance (parent), Rota (parent)
  { to: "/pit?tab=breaklist", icon: ListChecks, label: "Break List", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "/tables", icon: Table2, label: "Live Tables", roles: ["super_admin", "manager", "cashier", "pit", "finance_manager", "surveillance"], section: "PIT" },
  { to: "/active-players", icon: Users, label: "Active Players", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "/player-tracker", icon: Eye, label: "Player Tracker", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "/table-tracker", icon: Target, label: "Table Tracker", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "__attendance__", icon: ClipboardPen, label: "Attendance", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },
  { to: "__rota__", icon: CalendarDays, label: "Rota", roles: ["super_admin", "manager", "pit", "finance_manager"], section: "PIT" },

  // CASHIER — Cage operations
  { to: "/cage", icon: Landmark, label: "Cage", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "CASHIER" },
  { to: "/expenses", icon: Receipt, label: "Expenses", roles: ["super_admin", "manager", "cashier", "finance_manager"], section: "CASHIER" },

  // RECEPTION — Players & entry
  { to: "/reception", icon: DoorOpen, label: "Reception", roles: ["super_admin", "manager", "reception", "finance_manager"], section: "RECEPTION" },
  { to: "/in-casino", icon: UserCheck, label: "In Casino", roles: ["super_admin", "manager", "reception", "pit", "finance_manager", "surveillance"], section: "RECEPTION" },
  { to: "/players", icon: Users, label: "Players", roles: ["super_admin", "manager", "reception", "finance_manager"], section: "RECEPTION" },
  { to: "/blacklist", icon: ShieldAlert, label: "Blacklist", roles: ["super_admin", "manager", "reception", "finance_manager", "surveillance"], section: "RECEPTION" },

  // FINANCE — alphabetical, separate routes (no tabs)
  { to: "/bank-checks", icon: CreditCard, label: "Bank Checks", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance/budget", icon: Target, label: "Budget", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance/cash-count", icon: Coins, label: "Cash Count", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance/review", icon: ClipboardPen, label: "Daily Review", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance/dashboard", icon: Wallet, label: "Dashboard", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance/expenses", icon: Receipt, label: "Expenses", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/miss-chips", icon: Coins, label: "Miss Chips", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },
  { to: "/finance/summary", icon: FileBarChart, label: "Summary", roles: ["super_admin", "finance_manager"], section: "FINANCE" },
  { to: "/finance/transfers", icon: Upload, label: "Transfers", roles: ["super_admin", "finance_manager"], section: "FINANCE" },
  { to: "/finance/wallets", icon: Wallet, label: "Wallets", roles: ["super_admin", "manager", "finance_manager"], section: "FINANCE" },

  // HR — Personnel admin (Employee tab visible)
  { to: "/pit", icon: Gamepad2, label: "Live Game", roles: ["super_admin", "manager", "hr"], section: "HR" },
  { to: "/staff", icon: Building2, label: "Floor Staff", roles: ["super_admin", "manager", "hr"], section: "HR" },

  // ANALYTICS — shared
  { to: "/groups", icon: UsersRound, label: "Groups", roles: ["super_admin", "manager", "finance_manager"], section: "ANALYTICS" },
  { to: "/reports", icon: FileBarChart, label: "Reports", roles: ["super_admin", "manager", "finance_manager", "surveillance"], section: "ANALYTICS" },
  
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
  { tab: "rota_floor", icon: CalendarDays, label: "Floor Rota" },
];
const STAFF_SUBITEMS_HR = [
  { tab: "attendance", icon: ClipboardPen, label: "Attendance" },
  { tab: "employee", icon: UserCheck, label: "Employee" },
  { tab: "rota_floor", icon: CalendarDays, label: "Floor Rota" },
];

// Virtual parent groupings: Attendance / Rota each expand to Live + Floor + Security + Office
type VirtualSub = { to: string; icon: typeof ListChecks; label: string; matchPath: string; matchTab: string; matchGroup?: string };
const ATTENDANCE_SUBITEMS: VirtualSub[] = [
  { to: "/pit?tab=attendance", icon: Gamepad2, label: "Live", matchPath: "/pit", matchTab: "attendance" },
  { to: "/staff?tab=attendance&group=floor", icon: Building2, label: "Floor", matchPath: "/staff", matchTab: "attendance", matchGroup: "floor" },
  { to: "/staff?tab=attendance&group=security", icon: Shield, label: "Security", matchPath: "/staff", matchTab: "attendance", matchGroup: "security" },
  { to: "/staff?tab=attendance&group=office", icon: Briefcase, label: "Office", matchPath: "/staff", matchTab: "attendance", matchGroup: "office" },
];
const ROTA_SUBITEMS: VirtualSub[] = [
  { to: "/pit?tab=rota", icon: Gamepad2, label: "Live", matchPath: "/pit", matchTab: "rota" },
  { to: "/staff?tab=rota_floor", icon: Building2, label: "Floor", matchPath: "/staff", matchTab: "rota_floor" },
  { to: "/staff?tab=rota_security", icon: Shield, label: "Security", matchPath: "/staff", matchTab: "rota_security" },
  { to: "/staff?tab=rota_office", icon: Briefcase, label: "Office", matchPath: "/staff", matchTab: "rota_office" },
];

const BREAKLIST_PATH = "/pit?tab=breaklist";

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
  currentGroup: string;
  roles: AppRole[];
  onNavigate?: () => void;
  renderSubItems: (basePath: string, items: typeof TABLE_SUBITEMS) => JSX.Element;
};

const SidebarSections = ({
  visibleItems, isManager, isPitActive, isStaffActive, isTablesActive,
  currentTab, currentGroup, roles, onNavigate, renderSubItems,
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

  const renderVirtualGroup = (
    key: "attendance" | "rota",
    item: NavItem,
    sectionCtx: Section,
    subs: VirtualSub[],
  ) => {
    const groupKey = `__virtual:${key}`;
    const matchSub = (s: VirtualSub) =>
      location.pathname === s.matchPath && currentTab === s.matchTab && (!s.matchGroup || currentGroup === s.matchGroup);
    const isGroupActive = subs.some(matchSub);
    const isOpen = open[groupKey] ?? isGroupActive;
    return (
      <div key={`${sectionCtx}:${item.to}`}>
        <button
          type="button"
          onClick={() => toggle(groupKey)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            isGroupActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </button>
        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
            {subs.map(sub => {
              const active = matchSub(sub);
              return (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  end
                  onClick={onNavigate}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    active ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <sub.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{sub.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderItem = (item: NavItem, sectionCtx: Section) => {
    if (item.to === "__attendance__") return renderVirtualGroup("attendance", item, sectionCtx, ATTENDANCE_SUBITEMS);
    if (item.to === "__rota__") return renderVirtualGroup("rota", item, sectionCtx, ROTA_SUBITEMS);
    const { base: itemBase, tab: itemTab } = parseItemTo(item.to);
    const isTabAware = itemTab !== null;
    const isTabAwareActive =
      isTabAware && location.pathname === itemBase && currentTab === itemTab;
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
        {item.to === "/pit" && isPitActive && renderSubItems("/pit", pitSubs)}
        {item.to === "/staff" && isStaffActive && renderSubItems("/staff", staffSubs)}
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

        // OVERVIEW and PIT render flat (no collapse, no section label)
        if (section === FLAT_SECTION || section === "PIT") {
          return (
            <div key={section} className={idx > 0 ? "mt-1 border-t border-sidebar-border pt-1 space-y-0.5" : "mb-1 space-y-0.5"}>
              {items.map(it => renderItem(it, section))}
            </div>
          );
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
  const isArusha = (activeCasino?.slug ?? "").toLowerCase() === "arusha";
  const location = useLocation();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);

  const rawTab = new URLSearchParams(location.search).get("tab");
  const isPitActive = location.pathname === "/pit" && rawTab !== "breaklist";
  const isStaffActive = location.pathname === "/staff";
  const isTablesActive = location.pathname === "/tables";
  const currentTab = rawTab ||
    (location.pathname === "/pit" ? "employee" : isTablesActive ? "tables" : "employee");
  const currentGroup = new URLSearchParams(location.search).get("group") || "floor";

  const { data: allowedModules } = useMyModulePermissions();
  const isSuper = roles.includes("super_admin" as AppRole);
  const visibleItems = NAV_ITEMS.filter(item => {
    // Role gate
    if (!roles.some(r => item.roles.includes(r as AppRole))) return false;
    // Per-user module gate (super_admin bypass; null = role defaults)
    if (isSuper) return true;
    if (allowedModules == null) return true;
    const mk = moduleKeyForRoute(item.to, item.label);
    if (!mk) return true; // no mapping → not gated
    return allowedModules.has(mk);
  });

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
          {/* Nav icons start directly at the top (expand button moved to bottom) */}

          {/* Nav icons (only top-level items, no sub-tabs) */}
          <nav className="flex-1 flex flex-col items-center gap-0.5 w-full px-2 overflow-hidden">
            {visibleItems.map((item) => {
              const isVirtual = item.to === "__attendance__" || item.to === "__rota__";
              const subs = item.to === "__attendance__" ? ATTENDANCE_SUBITEMS : item.to === "__rota__" ? ROTA_SUBITEMS : null;
              const targetTo = subs ? subs[0].to : item.to;
              const { base: itemBase, tab: itemTab } = parseItemTo(targetTo);
              const isTabAware = itemTab !== null;
              const isPlainPitActive = item.to === "/pit" && location.pathname === "/pit" && currentTab !== "breaklist";
              const isActive = subs
                ? subs.some(s => location.pathname === s.matchPath && currentTab === s.matchTab)
                : isTabAware
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
                      to={targetTo}
                      end={targetTo === "/"}
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
                onClick={() => {
                  if (confirm("Reload app and clear cache?\n\nUse this if the app shows outdated data or behaves strangely after an update.")) {
                    void resetPWACache();
                  }
                }}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Force update</TooltipContent>
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

          <div className="w-8 border-t border-sidebar-border my-1" />

          {/* Expand sidebar — kept at the bottom in same position */}
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

          <div className="w-10 mt-1">
            <VersionIndicator collapsed />
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // ============ Expanded (full sidebar) ============
  return (
    <>
      <div
        className={cn("px-4 py-4 border-b", !isArusha && "border-sidebar-border")}
        style={isArusha ? { borderBottomColor: "#E8C688" } : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {isArusha ? (
              <>
                <img src={arushaLogo} alt="Arusha" className="w-7 h-7 shrink-0 object-contain" />
                <span className="font-faberge font-semibold text-sm uppercase tracking-wide" style={{ color: "#E8C688" }}>PREMIER</span>
              </>
            ) : (
              <>
                <Shield className="w-6 h-6 text-primary shrink-0" />
                <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CMS</span>
              </>
            )}
          </div>
          {isArusha ? (
            <span
              className="font-faberge font-semibold text-sm uppercase tracking-wide truncate text-right"
              style={{ color: "#E8C688" }}
              title={isSummaryMode ? "All Casinos" : activeCasino?.name ?? "Arusha"}
            >
              {isSummaryMode ? "All Casinos" : activeCasino?.name ?? "Arusha"}
            </span>
          ) : (
            <span
              className="text-sm font-semibold text-sidebar-foreground/90 truncate text-right"
              title={isSummaryMode ? "All Casinos" : activeCasino?.name ?? "Casino Ops"}
            >
              {isSummaryMode ? "All Casinos" : activeCasino?.name ?? "Casino Ops"}
            </span>
          )}
        </div>

      </div>

      <SidebarSections
        visibleItems={visibleItems}
        isManager={isManager}
        isPitActive={isPitActive}
        isStaffActive={isStaffActive}
        isTablesActive={isTablesActive}
        currentTab={currentTab}
        currentGroup={currentGroup}
        roles={roles as AppRole[]}
        onNavigate={onNavigate}
        renderSubItems={renderSubItems}
      />

      <div className="px-3 py-2 border-t border-sidebar-border space-y-2">
        {(!nativeManager || onToggle) && (
          <div className="flex items-center gap-2">
            {!nativeManager && (
              managerOverride.active ? (
                <button
                  onClick={handleDeactivate}
                  className="flex items-center gap-2 flex-1 h-8 px-3 rounded-md text-xs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="flex-1 text-left">Manager Active</span>
                  <ShieldOff className="w-3.5 h-3.5 opacity-60" />
                </button>
              ) : (
                <button
                  onClick={() => setShowOverrideDialog(true)}
                  className="flex items-center gap-2 flex-1 h-8 px-3 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="flex-1 text-left">Manager</span>
                </button>
              )
            )}
            {onToggle && (
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                className={cn(
                  "h-8 px-3 flex items-center justify-center rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border transition-colors",
                  nativeManager && "flex-1 gap-2"
                )}
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
                {nativeManager && <span className="flex-1 text-left">Hide sidebar</span>}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 px-1">
          <p className="text-xs font-medium text-sidebar-foreground truncate flex-1" title={displayName ?? undefined}>
            {displayName}
          </p>
          <NetworkStatusIndicator compact />
          <button
            onClick={() => { toggle(); onNavigate?.(); }}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              if (confirm("Reload app and clear cache?\n\nUse this if the app shows outdated data or behaves strangely after an update.")) {
                void resetPWACache();
              }
            }}
            title="Force update"
            className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
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
        <div className="mt-1 pt-1 border-t border-sidebar-border/50">
          <VersionIndicator />
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
          <span className="text-sm font-bold text-foreground truncate">{pageTitle}</span>
        </div>
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
