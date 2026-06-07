import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { SectionReveal } from "@/lib/motion";
import { ArrowRight } from "lucide-react";
import heroMock from "@/assets/landing/dashboard-light.jpg";

export function Hero() {
  const { t } = useLandingI18n();

  return (
    <section
      id="home"
      className="l-section"
      style={{ paddingTop: 96, paddingBottom: 40, position: "relative", textAlign: "center" }}
    >
      <div className="l-container">
        <div className="l-fade-up" style={{ maxWidth: 980, margin: "0 auto" }}>
          <span className="l-eyebrow">
            <span>{t.hero.eyebrow}</span>
          </span>
          <h1 style={{ marginTop: 8 }}>
            {t.hero.title1}
            <br />
            {t.hero.title2}
          </h1>
          <p
            style={{
              fontSize: "1.1875rem",
              marginTop: 28,
              maxWidth: 720,
              marginInline: "auto",
              color: "var(--l-text-muted)",
              lineHeight: 1.5,
            }}
          >
            {t.hero.sub}
          </p>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 40,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <a href="#contact" className="l-btn l-btn-primary">
              {t.hero.cta} <ArrowRight size={16} />
            </a>
            <a href="#modules" className="l-btn l-btn-ghost">
              {t.hero.secondary}
            </a>
          </div>
        </div>

        <SectionReveal y={40} delay={0.2}>
          <div
            style={{
              marginTop: 64,
              maxWidth: 1180,
              marginInline: "auto",
              borderRadius: 22,
              overflow: "hidden",
              boxShadow:
                "0 60px 120px -40px rgba(15,23,42,0.35), 0 20px 40px -20px rgba(15,23,42,0.18)",
              border: "1px solid rgba(10,10,10,0.08)",
              background: "#ffffff",
            }}
          >
            <img
              src={heroMock}
              alt="Casino System dashboard interface"
              loading="eager"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
        </SectionReveal>

      </div>
    </section>
  );
}
