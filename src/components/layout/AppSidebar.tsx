import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Landmark, Table2, Receipt,
  ClipboardList, BarChart3, Sun, Moon, Shield, Gamepad2, UsersRound, Grid3X3, LogOut,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", shortcut: "D" },
  { to: "/players", icon: Users, label: "Players", shortcut: "P" },
  { to: "/cage", icon: Landmark, label: "Cage", shortcut: "C" },
  { to: "/tables", icon: Table2, label: "Tables", shortcut: "T" },
  { to: "/expenses", icon: Receipt, label: "Expenses", shortcut: "E" },
  { to: "/pit", icon: Gamepad2, label: "Pit", shortcut: "I" },
  { to: "/groups", icon: UsersRound, label: "Groups", shortcut: "G" },
  { to: "/tracker", icon: Grid3X3, label: "Tracker", shortcut: "K" },
  { to: "/stats", icon: BarChart3, label: "Stats", shortcut: "S" },
  { to: "/logs", icon: ClipboardList, label: "Logs", shortcut: "L" },
];

export const AppSidebar = () => {
  const { theme, toggle } = useTheme();
  const { displayName, roles, signOut } = useAuth();

  return (
    <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight text-sidebar-foreground">CMS</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">Casino Ops</p>
      </div>

      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`
            }>
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            <span className="cms-kbd">{item.shortcut}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-1">
          <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{roles.join(", ") || "no role"}</p>
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
