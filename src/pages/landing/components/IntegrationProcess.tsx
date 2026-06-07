import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function IntegrationProcess() {
  const { t } = useLandingI18n();
  return (
    <section id="partners" className="l-section">
      <div className="l-container">
        <span className="l-eyebrow">{t.integration.eyebrow}</span>
        <h2 className="l-section-title">{t.integration.title}</h2>
        <p className="l-section-sub">{t.integration.sub}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 0,
            border: "1px solid var(--l-border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--l-surface)",
          }}
        >
          {t.integration.steps.map((s, i) => (
            <div
              key={s.title}
              style={{
                padding: "28px 28px 32px",
                borderRight: "1px solid var(--l-border)",
                borderBottom: "1px solid var(--l-border)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "transparent",
                    border: "1px solid var(--l-gold-dim)",
                    color: "var(--l-gold)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{s.title}</h3>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
