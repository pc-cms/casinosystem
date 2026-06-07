import { Check } from "lucide-react";
import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function AboutCMS() {
  const { t } = useLandingI18n();
  return (
    <section id="about" className="l-section" style={{ background: "var(--l-surface)" }}>
      <div className="l-container">
        <span className="l-eyebrow">{t.about.eyebrow}</span>
        <h2 className="l-section-title">{t.about.title}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }} className="l-about-grid">
          <p style={{ fontSize: "1.0625rem", lineHeight: 1.65 }}>{t.about.body}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {t.about.bullets.map((b) => (
              <li
                key={b}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  fontSize: 15,
                  color: "var(--l-text)",
                }}
              >
                <Check size={16} style={{ color: "var(--l-gold)", marginTop: 4, flexShrink: 0 }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <style>{`@media (max-width: 768px) { .l-about-grid { grid-template-columns: 1fr !important; gap: 24px !important; } }`}</style>
    </section>
  );
}
