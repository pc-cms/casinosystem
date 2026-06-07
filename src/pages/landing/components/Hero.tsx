import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { CommandPanel } from "./CommandPanel";
import { SectionReveal } from "@/lib/motion";
import {
  Vault, LayoutGrid, Wallet, Users, BadgeCheck, Wine, Smartphone, Boxes, Eye,
  ArrowRight,
} from "lucide-react";
import heroBg from "@/assets/landing/command-hero.jpg";

const MODULE_NODES = [
  { Icon: Vault, label: "CAGE" },
  { Icon: LayoutGrid, label: "PIT" },
  { Icon: Wallet, label: "FINANCE" },
  { Icon: Users, label: "PLAYERS" },
  { Icon: BadgeCheck, label: "HR" },
  { Icon: Wine, label: "BAR POS" },
  { Icon: Smartphone, label: "CLUB" },
  { Icon: Boxes, label: "WAREHOUSE" },
  { Icon: Eye, label: "SURVEILLANCE" },
];

export function Hero() {
  const { t } = useLandingI18n();

  return (
    <section
      id="home"
      className="l-section"
      style={{ paddingTop: 96, paddingBottom: 96, position: "relative" }}
    >
      {/* Soft cinematic hero backdrop image */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.45,
          maskImage:
            "radial-gradient(ellipse 75% 80% at 50% 40%, #000 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 80% at 50% 40%, #000 30%, transparent 80%)",
          zIndex: -1,
        }}
      />

      <div className="l-container">
        <div
          className="l-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div className="l-fade-up">
            <span className="l-eyebrow">
              <span className="l-section-code">§ 01</span>
              <span>{t.hero.eyebrow}</span>
            </span>
            <h1>
              {t.hero.title1}
              <br />
              <span style={{ color: "var(--l-gold-soft)" }}>{t.hero.title2}</span>
            </h1>
            <p style={{ fontSize: "1.0625rem", marginTop: 28, maxWidth: 560, color: "var(--l-text)" }}>
              {t.hero.sub}
            </p>
            <p
              style={{
                fontSize: "0.9375rem",
                marginTop: 18,
                color: "var(--l-text-dim)",
                maxWidth: 560,
              }}
            >
              {t.hero.support}
            </p>
            <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap" }}>
              <a href="#contact" className="l-btn l-btn-primary">
                {t.hero.cta} <ArrowRight size={16} />
              </a>
              <a href="#modules" className="l-btn l-btn-ghost">
                {t.hero.secondary}
              </a>
            </div>

            {/* Module node strip */}
            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                gap: 8,
                maxWidth: 560,
              }}
            >
              {MODULE_NODES.map(({ Icon, label }, i) => (
                <SectionReveal
                  key={label}
                  delay={0.05 * i}
                  y={8}
                  amount={0.1}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 4px",
                      border: "1px solid var(--l-border)",
                      borderRadius: 8,
                      background: "rgba(14,18,24,0.6)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <Icon size={16} strokeWidth={1.4} color="var(--l-gold)" />
                    <span
                      className="l-mono"
                      style={{
                        fontSize: 9.5,
                        color: "var(--l-text-dim)",
                        letterSpacing: "0.14em",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>

          <SectionReveal y={32} delay={0.2}>
            <CommandPanel />
          </SectionReveal>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .l-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}
