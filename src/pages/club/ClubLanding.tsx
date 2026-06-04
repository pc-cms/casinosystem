import { Link } from "react-router-dom";
import { Coins, Ticket, ShoppingBag, Gift, ArrowRight } from "lucide-react";
import ClubBackdrop from "@/components/club/ClubBackdrop";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

const BENEFITS = [
  { icon: Coins, title: "Cashback", text: "Earn credits on every visit and play." },
  { icon: Gift, title: "Promo Codes", text: "Unlock exclusive bonuses sent right to you." },
  { icon: Ticket, title: "Lottery Tickets", text: "Buy tickets for weekly prize draws." },
  { icon: ShoppingBag, title: "Exclusive Shop", text: "Redeem credits for premium rewards." },
];

const BRANCHES = ["Arusha", "Mwanza", "Dodoma", "Mbeya"];

const STEPS = [
  { n: "01", t: "Register", d: "Sign up with your phone — it takes a minute." },
  { n: "02", t: "Play", d: "Visit any Premier Casino branch and enjoy the floor." },
  { n: "03", t: "Redeem", d: "Spend your credits on shop items or lottery tickets." },
];

export default function ClubLanding() {
  return (
    <div className="relative min-h-screen text-white" style={{ backgroundColor: "#A0000D" }}>
      <ClubBackdrop />

      <div className="relative max-w-xl mx-auto px-5 pb-24">
        {/* ======== HERO ======== */}
        <section className="min-h-[100svh] flex flex-col items-center justify-between py-10">
          <header className="w-full flex items-center justify-between">
            <span
              className="font-faberge text-xs tracking-[0.3em]"
              style={{ color: GOLD }}
            >
              EST · 2025
            </span>
            <Link
              to="/club/login"
              className="text-xs tracking-[0.25em] uppercase border-b pb-0.5 transition-opacity hover:opacity-80"
              style={{ color: GOLD, borderColor: `${GOLD}66` }}
            >
              Sign In
            </Link>
          </header>

          <div className="flex flex-col items-center text-center mt-8">
            <img
              src="/arusha-premier-logo.svg"
              alt="Premier Casino"
              className="h-32 w-auto mb-8 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            />
            <h1
              className="font-faberge text-5xl sm:text-6xl leading-none mb-3"
              style={{ color: GOLD }}
            >
              PREMIER<br />CLUB
            </h1>
            <p
              className="font-faberge text-sm tracking-[0.4em] uppercase mb-2"
              style={{ color: GOLD, opacity: 0.85 }}
            >
              Premium Gaming
            </p>
            <p
              className="font-faberge text-xs tracking-[0.4em] uppercase"
              style={{ color: GOLD_DEEP }}
            >
              In Tansania
            </p>
          </div>

          <div className="w-full space-y-3 mt-10">
            <Link
              to="/club/register"
              className="w-full flex items-center justify-center gap-2 h-14 rounded-md font-faberge text-sm tracking-[0.3em] uppercase transition-transform active:scale-[0.98]"
              style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
            >
              Join the Club <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/club/login"
              className="w-full flex items-center justify-center h-14 rounded-md font-faberge text-sm tracking-[0.3em] uppercase border bg-transparent transition-colors hover:bg-white/5"
              style={{ color: GOLD, borderColor: GOLD }}
            >
              I have an account
            </Link>
            <p
              className="text-center text-[10px] tracking-[0.3em] uppercase pt-2"
              style={{ color: GOLD_DEEP }}
            >
              18+ · Play responsibly
            </p>
          </div>
        </section>

        {/* ======== MANIFESTO ======== */}
        <section className="py-20 text-center">
          <div
            className="w-12 h-px mx-auto mb-6"
            style={{ backgroundColor: GOLD }}
          />
          <p
            className="font-faberge italic text-3xl sm:text-4xl leading-tight"
            style={{ color: GOLD }}
          >
            "Only for those<br />who dare."
          </p>
          <div
            className="w-12 h-px mx-auto mt-6"
            style={{ backgroundColor: GOLD }}
          />
        </section>

        {/* ======== BENEFITS ======== */}
        <section className="py-12">
          <h2
            className="font-faberge text-xs tracking-[0.4em] uppercase text-center mb-8"
            style={{ color: GOLD_DEEP }}
          >
            Member Benefits
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-xl p-4 backdrop-blur-sm border bg-black/40"
                style={{ borderColor: `${GOLD}33` }}
              >
                <b.icon className="w-6 h-6 mb-3" style={{ color: GOLD }} />
                <h3
                  className="font-faberge text-sm tracking-[0.15em] uppercase mb-1.5"
                  style={{ color: GOLD }}
                >
                  {b.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {b.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ======== HOW IT WORKS ======== */}
        <section className="py-12">
          <h2
            className="font-faberge text-xs tracking-[0.4em] uppercase text-center mb-8"
            style={{ color: GOLD_DEEP }}
          >
            How It Works
          </h2>
          <div className="space-y-5">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex gap-4 items-start">
                <div
                  className="font-faberge text-3xl leading-none shrink-0 w-12"
                  style={{ color: GOLD }}
                >
                  {s.n}
                </div>
                <div className="flex-1 pt-1">
                  <h3
                    className="font-faberge text-base tracking-[0.2em] uppercase mb-1"
                    style={{ color: GOLD }}
                  >
                    {s.t}
                  </h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======== NETWORK ======== */}
        <section className="py-12 text-center">
          <h2
            className="font-faberge text-xs tracking-[0.4em] uppercase mb-5"
            style={{ color: GOLD_DEEP }}
          >
            Our Network
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {BRANCHES.map((b) => (
              <span
                key={b}
                className="font-faberge text-xs tracking-[0.25em] uppercase px-4 py-2 rounded-full border"
                style={{ color: GOLD, borderColor: `${GOLD}55` }}
              >
                {b}
              </span>
            ))}
          </div>
        </section>

        {/* ======== FINAL CTA ======== */}
        <section className="py-12">
          <div
            className="rounded-2xl p-8 text-center border bg-black/50"
            style={{ borderColor: `${GOLD}44` }}
          >
            <p
              className="font-faberge italic text-lg mb-5"
              style={{ color: GOLD }}
            >
              Subtle. Seductive.<br />Prestigious.
            </p>
            <Link
              to="/club/register"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-md font-faberge text-sm tracking-[0.3em] uppercase"
              style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
            >
              Become a Member
            </Link>
          </div>
        </section>

        {/* ======== FOOTER ======== */}
        <footer className="pt-10 pb-6 text-center space-y-1">
          <p
            className="font-faberge text-[10px] tracking-[0.4em] uppercase"
            style={{ color: GOLD_DEEP }}
          >
            Premier Casino · Tansania
          </p>
          <p
            className="font-faberge text-[10px] tracking-[0.4em]"
            style={{ color: GOLD_DEEP, opacity: 0.7 }}
          >
            © 2025
          </p>
        </footer>
      </div>
    </div>
  );
}
