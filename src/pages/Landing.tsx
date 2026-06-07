/**
 * Landing page — premium sales page for CasinoSystem.
 * No internal casino references. Pure marketing / conversion page.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Shield, BarChart3, Users, Zap, Globe, Lock, ChevronRight,
  Wifi, WifiOff, Eye, CreditCard, Clock, Layers, ArrowRight,
  CheckCircle2, Star, Monitor, Smartphone
} from "lucide-react";

import heroDashboard from "@/assets/landing/hero-dashboard.jpg";
import featureCage from "@/assets/landing/feature-cage.jpg";
import featureStaff from "@/assets/landing/feature-staff.jpg";
import featureFinance from "@/assets/landing/feature-finance.jpg";

/* ───────────────────────── Data ───────────────────────── */

const FEATURES = [
  {
    icon: CreditCard,
    title: "Cage & Shift Control",
    desc: "Real-time buy-in/cashout tracking, chip inventory, multi-currency support, and immutable shift audit trails.",
  },
  {
    icon: BarChart3,
    title: "Financial Intelligence",
    desc: "Wallet management, budget planning, daily P&L, break-even analysis, and inter-branch transfers.",
  },
  {
    icon: Users,
    title: "Player Management",
    desc: "Full lifecycle — registration, ID verification, categories, groups, blacklisting, and visit history analytics.",
  },
  {
    icon: WifiOff,
    title: "Offline-First Architecture",
    desc: "Works without internet. Queue mutations locally, sync automatically when connectivity is restored.",
  },
  {
    icon: Globe,
    title: "Multi-Location Network",
    desc: "Manage unlimited branches from one platform. Each location gets isolated data with cross-casino reporting.",
  },
  {
    icon: Lock,
    title: "Role-Based Access",
    desc: "8 configurable roles with granular permissions. Manager overrides with full audit logging.",
  },
  {
    icon: Eye,
    title: "CCTV & Security",
    desc: "Dedicated security dashboard with observation logs, player tagging, and real-time floor monitoring.",
  },
  {
    icon: Clock,
    title: "Staff & Dealer Rotation",
    desc: "Automated breaklists, shift scheduling, attendance tracking, and performance analytics.",
  },
  {
    icon: Layers,
    title: "Table Tracking",
    desc: "Live table results, chip counts, float management, and closing reconciliation per gaming table.",
  },
];

const STATS = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<200ms", label: "Response Time" },
  { value: "256-bit", label: "AES Encryption" },
  { value: "24/7", label: "Support" },
];

const TESTIMONIALS = [
  {
    quote: "CasinoSystem transformed how we manage our operations. What used to take hours now takes minutes.",
    author: "Operations Director",
    company: "Multi-Branch Casino Group",
    stars: 5,
  },
  {
    quote: "The offline capability is a game-changer for our locations with unreliable internet.",
    author: "IT Manager",
    company: "Gaming Network, East Africa",
    stars: 5,
  },
  {
    quote: "Finally, a system that understands casino workflows — not just generic POS software.",
    author: "Casino General Manager",
    company: "Premier Gaming Ltd",
    stars: 5,
  },
];

const SHOWCASE = [
  {
    img: featureCage,
    title: "Cage Operations",
    desc: "Every buy-in, cashout, and chip movement tracked in real-time with immutable audit trails. Multi-currency support with automatic exchange rate management.",
  },
  {
    img: featureFinance,
    title: "Financial Dashboard",
    desc: "Comprehensive budget planning, expense tracking, wallet balances, and daily P&L analysis. Inter-branch transfers with full approval workflows.",
  },
  {
    img: featureStaff,
    title: "Staff & Scheduling",
    desc: "Dealer breaklists, shift rotation, attendance tracking, and HR management. Automated conflict detection and smart scheduling.",
  },
];

/* ───────────────────────── Component ───────────────────────── */

const Landing = () => {
  const [demoEmail, setDemoEmail] = useState("");

  const handleDemo = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `mailto:sales@casinosystem.app?subject=Demo Request&body=Please schedule a demo for ${demoEmail}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-primary-foreground font-black text-sm">CS</span>
            </div>
            <span className="font-bold text-xl tracking-tight">CasinoSystem</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#showcase" className="hover:text-foreground transition-colors">Product</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => window.location.href = "#demo"}>
              Contact Sales
            </Button>
            <Button size="sm" onClick={() => window.location.href = "#demo"} className="shadow-lg shadow-primary/20">
              Get Demo <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-32 px-6 relative">
        {/* Gradient blobs */}
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium">
              <Zap className="w-4 h-4" />
              Enterprise Casino Management Platform
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9]">
              Run Your Casino
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                Like a Machine.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The all-in-one platform for cage operations, financial control, staff scheduling, 
              player intelligence, and multi-location management. Built by casino operators, for casino operators.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="text-base px-8 h-13 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-shadow" onClick={() => window.location.href = "#demo"}>
                Request a Demo
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-13" onClick={() => document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" })}>
                See It in Action
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">No credit card required · 14-day free trial · Setup in under 1 hour</p>
          </div>

          {/* Hero Screenshot */}
          <div className="mt-16 md:mt-20 relative">
            <div className="absolute -inset-4 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative rounded-2xl border border-border/50 overflow-hidden shadow-2xl shadow-black/40">
              <img
                src={heroDashboard}
                alt="CasinoSystem Dashboard — real-time analytics, revenue tracking, and player statistics"
                width={1920}
                height={1080}
                className="w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="py-12 border-y border-border/50 bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-black text-primary">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Features</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Everything You Need.<br className="hidden sm:block" /> Nothing You Don't.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Purpose-built for casino operations — not adapted from generic business software.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Showcase (Screenshots) ─── */}
      <section id="showcase" className="py-24 px-6 bg-muted/20 border-y border-border/50">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="text-center space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Product</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">See CasinoSystem in Action</h2>
          </div>

          {SHOWCASE.map((item, i) => (
            <div
              key={item.title}
              className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 items-center`}
            >
              <div className="lg:w-3/5">
                <div className="rounded-2xl border border-border/50 overflow-hidden shadow-xl shadow-black/20">
                  <img
                    src={item.img}
                    alt={`${item.title} interface`}
                    width={1280}
                    height={800}
                    loading="lazy"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="lg:w-2/5 space-y-4">
                <h3 className="text-2xl md:text-3xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <a href="#demo" className="hover:underline">Learn more</a>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Platforms ─── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest">Works Everywhere</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">Desktop. Tablet. Phone.</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Fully responsive design works on any device. Install as a Progressive Web App for native-like performance — even offline.
          </p>
          <div className="flex items-center justify-center gap-12 pt-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-primary" />
              </div>
              <span className="text-sm font-medium">Desktop</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <span className="text-sm font-medium">Mobile & Tablet</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-primary" />
              </div>
              <span className="text-sm font-medium">Offline Mode</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimonials" className="py-24 px-6 bg-muted/20 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Testimonials</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Trusted by Casino Operators</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="p-8 rounded-2xl border border-border/50 bg-card/50 space-y-4">
                <div className="flex gap-1">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed italic">"{t.quote}"</p>
                <div className="pt-2">
                  <p className="font-semibold">{t.author}</p>
                  <p className="text-sm text-muted-foreground">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Teaser ─── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest">Pricing</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Pay per location, per month. No hidden fees. No setup costs. Volume discounts for casino networks.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            {[
              { plan: "Starter", price: "Contact Us", features: ["1 location", "Up to 10 users", "Core modules", "Email support"] },
              { plan: "Professional", price: "Contact Us", features: ["Up to 5 locations", "Unlimited users", "All modules", "Priority support", "Custom reporting"], highlight: true },
              { plan: "Enterprise", price: "Contact Us", features: ["Unlimited locations", "Unlimited users", "White-label option", "Dedicated manager", "SLA guarantee", "On-site training"] },
            ].map(p => (
              <div key={p.plan} className={`p-8 rounded-2xl border ${p.highlight ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" : "border-border/50 bg-card/50"} space-y-6 relative`}>
                {p.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold">{p.plan}</h3>
                  <div className="text-2xl font-black text-primary mt-2">{p.price}</div>
                </div>
                <ul className="space-y-3 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${p.highlight ? "shadow-lg shadow-primary/25" : ""}`}
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => window.location.href = "#demo"}
                >
                  Get Started
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA / Demo Form ─── */}
      <section id="demo" className="py-24 px-6 bg-muted/20 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium">
            <Shield className="w-4 h-4" />
            Free Demo · No Commitment
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-muted-foreground text-lg">
            Schedule a personalized demo and see how CasinoSystem can streamline your casino management.
          </p>
          <form onSubmit={handleDemo} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="email"
              required
              value={demoEmail}
              onChange={e => setDemoEmail(e.target.value)}
              placeholder="Enter your work email"
              className="flex-1 h-12 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button type="submit" size="lg" className="h-12 px-8 shadow-xl shadow-primary/25">
              Request Demo
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            We'll respond within 24 hours. Your data is protected by our privacy policy.
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-primary-foreground font-black text-xs">CS</span>
            </div>
            <span className="font-bold text-lg">CasinoSystem</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Amaell Group LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
