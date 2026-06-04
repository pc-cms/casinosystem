import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Wallet, ShoppingBag, Ticket, LogOut, User } from "lucide-react";
import { clearClubSession, getClubToken } from "@/lib/club-api";
import { useEffect } from "react";
import ClubBackdrop from "@/components/club/ClubBackdrop";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

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
    { to: "/club/profile", label: "Profile", icon: User },
  ];

  if (isStandalone) {
    return <Outlet />;
  }

  return (
    <div
      className="relative min-h-screen flex flex-col text-white"
      style={{ backgroundColor: "#A0000D" }}
    >
      <ClubBackdrop />

      <header
        className="relative px-5 py-4 flex items-center justify-between border-b"
        style={{ borderColor: `${GOLD}33`, backgroundColor: "rgba(0,0,0,0.35)" }}
      >
        <Link to="/club/wallet" className="flex items-center gap-2">
          <img src="/premier-club-logo.svg" alt="" className="h-7 w-7" />
          <span className="font-faberge text-xs tracking-[0.3em]" style={{ color: GOLD }}>
            PREMIER CLUB
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-[10px] tracking-[0.25em] uppercase flex items-center gap-1.5"
          style={{ color: GOLD_DEEP }}
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      <main className="relative flex-1 overflow-y-auto p-5 pb-24 max-w-xl mx-auto w-full">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 border-t flex backdrop-blur-md z-50"
        style={{
          borderColor: `${GOLD}33`,
          backgroundColor: "rgba(10,0,0,0.85)",
        }}
      >
        {nav.map(({ to, label, icon: Icon }) => {
          const active = path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center py-2.5 text-[10px] tracking-[0.25em] uppercase font-faberge transition-colors"
              style={{ color: active ? GOLD : GOLD_DEEP }}
            >
              <Icon className="w-5 h-5 mb-1" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
