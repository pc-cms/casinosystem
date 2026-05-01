import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { useTheme } from "@/lib/theme";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { LogoutButton } from "@/components/LogoutButton";
import {
  LayoutDashboard, Users, Landmark, Table2, ListChecks, CalendarDays,
  ClipboardCheck, ClipboardList, ShieldAlert, Eye, Sun, Moon, LogOut,
  Shield, Menu, X, BookOpen, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export type CctvSection =
  | "dashboard"
  | "guests"
  | "players"
  | "tables"
  | "breaklist"
  | "rota"
  | "attendance"
  | "cage"
  | "observations"
  | "blacklist";

const NAV_ITEMS: { id: CctvSection; icon: typeof LayoutDashboard; label: string; section: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", section: "OVERVIEW" },
  { id: "guests", icon: Users, label: "In Casino", section: "MONITORING" },
  { id: "players", icon: Users, label: "Players", section: "MONITORING" },
  { id: "blacklist", icon: ShieldAlert, label: "Blacklist", section: "MONITORING" },
  { id: "tables", icon: Table2, label: "Tables", section: "OPERATIONS" },
  { id: "breaklist", icon: ListChecks, label: "Breaklist", section: "OPERATIONS" },
  { id: "rota", icon: CalendarDays, label: "Rota", section: "OPERATIONS" },
  { id: "attendance", icon: ClipboardCheck, label: "Attendance", section: "OPERATIONS" },
  { id: "cage", icon: Landmark, label: "Cage Overview", section: "OPERATIONS" },
  { id: "observations", icon: BookOpen, label: "Pit Book", section: "JOURNAL" },
];

interface CctvLayoutProps {
  activeSection: CctvSection;
  onSectionChange: (s: CctvSection) => void;
  children: React.ReactNode;
}

export const CctvLayout = ({ activeSection, onSectionChange, children }: CctvLayoutProps) => {
  const { displayName, signOut } = useAuth();
  const { accessibleCasinos, activeCasinoId, switchCasino } = useCasino();
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CCTV</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">
          Surveillance Mode
        </p>
        <NetworkStatusIndicator />
      </div>

      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item, idx) => {
          const prevSection = idx > 0 ? NAV_ITEMS[idx - 1].section : "";
          const showLabel = item.section !== prevSection;
          return (
            <div key={item.id}>
              {showLabel && (
                <div className={`px-3 pt-3 pb-1 ${idx > 0 ? "mt-1 border-t border-sidebar-border" : ""}`}>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{item.section}</span>
                </div>
              )}
              <button
                onClick={() => { onSectionChange(item.id); onNav?.(); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full text-left ${
                  activeSection === item.id
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 shrink-0">
              Security
            </span>
          </div>
        </div>
        <button onClick={() => { toggle(); onNav?.(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <LogoutButton
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <LogOut className="w-3 h-3" /> Sign Out
        </LogoutButton>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
          <SidebarContent />
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        {isMobile && (
          <>
            <header className="h-12 flex items-center gap-2 px-3 border-b border-border bg-sidebar shrink-0">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setMobileOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <Eye className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold text-foreground truncate">CCTV</span>
              <NetworkStatusIndicator />
            </header>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar">
                <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
                <SidebarContent onNav={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* Casino tabs */}
        <div className="border-b border-border bg-card px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {accessibleCasinos.map(c => (
              <button
                key={c.id}
                onClick={() => switchCasino(c.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeCasinoId === c.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6 max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
