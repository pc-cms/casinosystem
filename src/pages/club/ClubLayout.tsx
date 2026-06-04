import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Wallet, ShoppingBag, Ticket, LogOut } from "lucide-react";
import { clearClubSession, getClubToken } from "@/lib/club-api";
import { useEffect } from "react";

// Routes that render their own full-bleed layout (no chrome from ClubLayout).
const STANDALONE = ["/", "/club/login", "/club/register"];

export default function ClubLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const path = loc.pathname;
  const isStandalone = STANDALONE.includes(path);
  const isLogin = path === "/club/login" || path === "/club/register" || path === "/";

  useEffect(() => {
    if (!isLogin && !getClubToken()) navigate("/club/login", { replace: true });
  }, [isLogin, path, navigate]);

  const handleLogout = () => {
    clearClubSession();
    navigate("/", { replace: true });
  };

  const nav = [
    { to: "/club/wallet", label: "Wallet", icon: Wallet },
    { to: "/club/shop", label: "Shop", icon: ShoppingBag },
    { to: "/club/tickets", label: "Tickets", icon: Ticket },
  ];

  if (isStandalone) {
    // Landing / login / register render their own brand canvas.
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight">Premier Club</Link>
        <button onClick={handleLogout} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-20 max-w-xl mx-auto w-full">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card flex">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center py-2 text-xs ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
