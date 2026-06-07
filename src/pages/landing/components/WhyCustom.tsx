import { Check } from "lucide-react";
import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function WhyCustom() {
  const { t } = useLandingI18n();
  return (
    <section className="l-section" style={{ background: "var(--l-surface)" }}>
      <div className="l-container">
        <span className="l-eyebrow">{t.whyCustom.eyebrow}</span>
        <h2 className="l-section-title">{t.whyCustom.title}</h2>
        <p className="l-section-sub">{t.whyCustom.sub}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {t.whyCustom.items.map((it) => (
            <div
              key={it}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 18px",
                background: "var(--l-surface-2)",
                border: "1px solid var(--l-border)",
                borderRadius: 8,
                fontSize: 15,
              }}
            >
              <Check size={16} style={{ color: "var(--l-teal)", flexShrink: 0 }} />
              <span>{it}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
