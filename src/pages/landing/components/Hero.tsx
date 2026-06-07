import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { MockupFrame } from "./MockupFrame";
import heroDashboard from "@/assets/landing/hero-dashboard.jpg";
import featureCage from "@/assets/landing/feature-cage.jpg";
import featureFinance from "@/assets/landing/feature-finance.jpg";
import featureStaff from "@/assets/landing/feature-staff.jpg";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const { t } = useLandingI18n();
  return (
    <section id="home" className="l-section" style={{ paddingTop: 72, paddingBottom: 72 }}>
      <div className="l-container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div className="l-fade-up" style={{ maxWidth: 880 }}>
            <span className="l-eyebrow">{t.hero.eyebrow}</span>
            <h1>
              {t.hero.title1}
              <br />
              <span style={{ color: "var(--l-gold)" }}>{t.hero.title2}</span>
            </h1>
            <p style={{ fontSize: "1.0625rem", marginTop: 24, maxWidth: 720 }}>
              {t.hero.sub}
            </p>
            <p
              style={{
                fontSize: "0.9375rem",
                marginTop: 16,
                color: "var(--l-text-dim)",
                maxWidth: 720,
              }}
            >
              {t.hero.support}
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <a href="#contact" className="l-btn l-btn-primary">
                {t.hero.cta} <ArrowRight size={16} />
              </a>
              <a href="#modules" className="l-btn l-btn-link">
                {t.hero.secondary} →
              </a>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gridTemplateRows: "auto auto",
              gap: 18,
            }}
            className="l-hero-grid"
          >
            <div style={{ gridRow: "1 / span 2" }}>
              <MockupFrame
                label={t.hero.captions.dashboard}
                src={heroDashboard}
                alt="Dashboard"
                height={420}
              />
            </div>
            <MockupFrame
              label={t.hero.captions.cage}
              src={featureCage}
              alt="Cage"
              height={195}
            />
            <MockupFrame
              label={t.hero.captions.finance}
              src={featureFinance}
              alt="Finance"
              height={195}
            />
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 18,
            marginTop: 18,
          }}
          className="l-hero-row"
        >
          <MockupFrame label={t.hero.captions.pit} height={140} />
          <MockupFrame label={t.hero.captions.players} src={featureStaff} alt="Players" height={140} />
          <MockupFrame label={t.hero.captions.club} height={140} />
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .l-hero-grid { grid-template-columns: 1fr !important; }
          .l-hero-grid > div:first-child { grid-row: auto !important; }
          .l-hero-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
