import { Link } from "react-router-dom";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export default function ClubFooter() {
  return (
    <footer className="pt-10 pb-6 text-center space-y-4">
      <p
        className="text-[11px] leading-relaxed max-w-md mx-auto px-4"
        style={{ color: "rgba(232,198,136,0.75)" }}
      >
        Premier Club is operated by Joker Casino LTD, trading as Premier Casino.
        Membership is subject to verification, responsible gaming rules and applicable laws of Tanzania.
      </p>
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
      <p
        className="font-faberge text-[10px] tracking-[0.4em] uppercase pt-2"
        style={{ color: GOLD_DEEP }}
      >
        Premier Casino · Tanzania · © 2025
      </p>
    </footer>
  );
}
