import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { MockupFrame } from "./MockupFrame";
import heroDashboard from "@/assets/landing/hero-dashboard.jpg";
import featureCage from "@/assets/landing/feature-cage.jpg";
import featureFinance from "@/assets/landing/feature-finance.jpg";
import featureStaff from "@/assets/landing/feature-staff.jpg";

export function ProductScreens() {
  const { t } = useLandingI18n();
  const c = t.screens.captions;
  return (
    <section className="l-section" style={{ background: "var(--l-surface)" }}>
      <div className="l-container">
        <span className="l-eyebrow">{t.screens.eyebrow}</span>
        <h2 className="l-section-title">{t.screens.title}</h2>
        <p className="l-section-sub">{t.screens.sub}</p>

        <div style={{ display: "grid", gap: 18 }}>
          <figure style={{ margin: 0 }}>
            <MockupFrame label="Dashboard" src={heroDashboard} alt="Dashboard" height={460} />
            <figcaption
              style={{ marginTop: 12, fontSize: 13, color: "var(--l-text-muted)" }}
            >
              {c.dashboard}
            </figcaption>
          </figure>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            {[
              { label: "Cage", src: featureCage, caption: c.cage },
              { label: "Pit & Tables", caption: c.pit },
              { label: "Finance", src: featureFinance, caption: c.finance },
              { label: "Player Tracking", src: featureStaff, caption: c.players },
              { label: "Client Club App", caption: c.club },
            ].map((s) => (
              <figure key={s.label} style={{ margin: 0 }}>
                <MockupFrame label={s.label} src={s.src} alt={s.label} height={220} />
                <figcaption
                  style={{ marginTop: 10, fontSize: 12.5, color: "var(--l-text-muted)" }}
                >
                  {s.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
