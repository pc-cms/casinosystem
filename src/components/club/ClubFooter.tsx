import { Link } from "react-router-dom";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export default function ClubFooter() {
  return (
    <footer className="pt-10 pb-6 text-center space-y-4">
      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-faberge text-[10px] tracking-[0.25em] uppercase"
        style={{ color: GOLD }}
      >
        <Link to="/club/privacy" className="hover:opacity-80 transition-opacity">
          Privacy Policy
        </Link>
        <span style={{ color: GOLD_DEEP }}>·</span>
        <Link to="/club/data-protection" className="hover:opacity-80 transition-opacity">
          Personal Data Protection
        </Link>
        <span style={{ color: GOLD_DEEP }}>·</span>
        <Link to="/club/responsible-gaming" className="hover:opacity-80 transition-opacity">
          Responsible Gaming
        </Link>
      </nav>
      <div className="pt-4 space-y-1">
        <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
          18+ · PLAY RESPONSIBLY
        </p>
        <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
          PREMIER CASINO · TANZANIA
        </p>
        <p className="font-faberge text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD_DEEP }}>
          © 2025
        </p>
      </div>
    </footer>
  );
}

