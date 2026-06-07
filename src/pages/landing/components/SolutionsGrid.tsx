import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function SolutionsGrid() {
  const { t } = useLandingI18n();
  return (
    <section id="solutions" className="l-section">
      <div className="l-container">
        <span className="l-eyebrow">{t.solutions.eyebrow}</span>
        <h2 className="l-section-title">{t.solutions.title}</h2>
        <p className="l-section-sub">{t.solutions.sub}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {t.solutions.items.map((s) => (
            <div key={s.title} className="l-card">
              <h3 style={{ marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
