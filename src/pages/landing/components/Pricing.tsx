import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { SectionLabel } from "./SectionLabel";
import { SectionReveal } from "@/lib/motion";
import { ArrowRight } from "lucide-react";

export function Pricing() {
  const { t } = useLandingI18n();
  const cards = [t.pricing.impl, t.pricing.license];
  return (
    <section className="l-section">
      <div className="l-container">
        <SectionLabel code="08" label={t.pricing.eyebrow} />
        <h2 className="l-section-title">{t.pricing.title}</h2>
        <p className="l-section-sub">{t.pricing.sub}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
          }}
        >
          {cards.map((c, i) => (
            <SectionReveal key={c.label} delay={i * 0.1}>
              <div
                style={{
                  position: "relative",
                  padding: "36px 32px 32px",
                  border: "1px solid var(--l-border)",
                  borderRadius: 14,
                  background:
                    "linear-gradient(180deg, var(--l-surface) 0%, var(--l-bg-2) 100%)",
                  overflow: "hidden",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background:
                      "linear-gradient(90deg, transparent, var(--l-gold) 50%, transparent)",
                  }}
                />
                <div
                  className="l-mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--l-text-dim)",
                    letterSpacing: "0.22em",
                    marginBottom: 16,
                  }}
                >
                  {c.label.toUpperCase()}
                </div>
                <div
                  className="l-tnum"
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    color: "var(--l-gold-soft)",
                    marginBottom: 14,
                    lineHeight: 1,
                  }}
                >
                  {c.price}
                </div>
                <div className="l-rule-gold" style={{ margin: "18px 0" }} />
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{c.note}</p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 44 }}>
          <a href="#contact" className="l-btn l-btn-primary">
            {t.pricing.cta} <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
