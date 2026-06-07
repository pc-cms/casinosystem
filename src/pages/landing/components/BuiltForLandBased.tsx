import { Check } from "lucide-react";
import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function BuiltForLandBased() {
  const { t } = useLandingI18n();
  return (
    <section className="l-section" style={{ background: "var(--l-surface)" }}>
      <div className="l-container">
        <span className="l-eyebrow">{t.builtFor.eyebrow}</span>
        <h2 className="l-section-title">{t.builtFor.title}</h2>
        <p className="l-section-sub">{t.builtFor.sub}</p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {t.builtFor.items.map((it) => (
            <li
              key={it}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "var(--l-surface-2)",
                border: "1px solid var(--l-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--l-text)",
              }}
            >
              <Check size={14} style={{ color: "var(--l-gold)", flexShrink: 0 }} />
              {it}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
