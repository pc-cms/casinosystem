import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function Pricing() {
  const { t } = useLandingI18n();
  const cards = [t.pricing.impl, t.pricing.license];
  return (
    <section className="l-section" style={{ background: "var(--l-surface)" }}>
      <div className="l-container">
        <span className="l-eyebrow">{t.pricing.eyebrow}</span>
        <h2 className="l-section-title">{t.pricing.title}</h2>
        <p className="l-section-sub">{t.pricing.sub}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {cards.map((c) => (
            <div
              key={c.label}
              className="l-card"
              style={{ padding: 32, background: "var(--l-surface-2)" }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "var(--l-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 12,
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--l-gold)",
                  marginBottom: 12,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.price}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55 }}>{c.note}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
          <a href="#contact" className="l-btn l-btn-primary">
            {t.pricing.cta} →
          </a>
        </div>
      </div>
    </section>
  );
}
