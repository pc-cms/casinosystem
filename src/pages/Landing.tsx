/**
 * Landing page for casinosystem.app (root domain).
 * Professional marketing page for the Casino Management System.
 */

import { Button } from "@/components/ui/button";
import { Shield, BarChart3, Users, Zap, Globe, Lock } from "lucide-react";
import { getBaseDomain } from "@/lib/casino-context";

const FEATURES = [
  {
    icon: Shield,
    title: "Real-Time Cage Control",
    desc: "Track every buy-in, cashout, and chip movement with immutable audit trails.",
  },
  {
    icon: BarChart3,
    title: "Financial Intelligence",
    desc: "Wallet management, budget planning, break-even analysis — all in one dashboard.",
  },
  {
    icon: Users,
    title: "Player Management",
    desc: "Registration, categories, groups, blacklisting, and full visit history.",
  },
  {
    icon: Zap,
    title: "Offline Resilience",
    desc: "Works without internet. Syncs automatically when connection is restored.",
  },
  {
    icon: Globe,
    title: "Multi-Casino",
    desc: "Manage all locations from a single platform with cross-casino transfers.",
  },
  {
    icon: Lock,
    title: "Role-Based Access",
    desc: "6 roles with granular permissions. Manager overrides with audit logging.",
  },
];

const CASINOS = [
  { name: "Arusha", slug: "arusha" },
  { name: "Dodoma", slug: "dodoma" },
  { name: "Mbeya", slug: "mbeya" },
  { name: "Mwanza", slug: "mwanza" },
];

const Landing = () => {
  const baseDomain = getBaseDomain();

  const goToCasino = (slug: string) => {
    window.location.href = `https://${slug}.${baseDomain}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CS</span>
            </div>
            <span className="font-bold text-lg tracking-tight">CasinoSystem</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `https://premier.${baseDomain}`}
            >
              Premier Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero section */}
        <section className="py-20 md:py-32 text-center px-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Casino Management
              <br />
              <span className="text-primary">Simplified.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Enterprise-grade control for cage operations, financial tracking, staff management, 
              and player intelligence — built for African casino networks.
            </p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                size="lg"
                onClick={() => window.location.href = `https://premier.${baseDomain}/login`}
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 border-t border-border bg-muted/30">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center mb-12">Everything You Need</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(f => (
                <div key={f.title} className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                  <f.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Locations */}
        <section className="py-16 border-t border-border">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-bold mb-2">Our Locations</h2>
            <p className="text-muted-foreground mb-8">Select your casino to access the management system</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CASINOS.map(c => (
                <button
                  key={c.slug}
                  onClick={() => goToCasino(c.slug)}
                  className="p-6 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <Globe className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-semibold text-lg">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.slug}.{baseDomain}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} CasinoSystem. Internal management platform.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
