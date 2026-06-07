import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { SectionLabel } from "./SectionLabel";
import { SectionReveal } from "@/lib/motion";
import premierLogo from "@/assets/landing/operators/premier.png";
import royalLogo from "@/assets/landing/operators/casino-royal.png";
import napoleonsLogo from "@/assets/landing/operators/napoleons.png";
import rainbowLogo from "@/assets/landing/operators/rainbow.png";
import spaLogo from "@/assets/landing/operators/casino-de-spa.png";
import portomasoLogo from "@/assets/landing/operators/portomaso.png";

const OPERATORS = [
  { name: "Premier Casino", src: premierLogo },
  { name: "Casino Royal Sal Cabo Verde", src: royalLogo },
  { name: "Napoleons Casinos & Restaurants", src: napoleonsLogo },
  { name: "Rainbow Casino Birmingham", src: rainbowLogo },
  { name: "Casino de Spa", src: spaLogo },
  { name: "Portomaso Casino", src: portomasoLogo },
];

export function OperatorsStrip() {
  const { t } = useLandingI18n();
  return (
    <section className="l-section">
      <div className="l-container">
        <SectionLabel code="07" label={t.operators.eyebrow} />
        <h2 className="l-section-title">{t.operators.title}</h2>
        <p className="l-section-sub" style={{ maxWidth: 820 }}>
          {t.operators.sub}
        </p>

        <SectionReveal y={20}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 8,
              padding: "36px 28px",
              background:
                "linear-gradient(180deg, var(--l-surface) 0%, var(--l-bg-2) 100%)",
              border: "1px solid var(--l-border)",
              borderRadius: 14,
            }}
          >
            {OPERATORS.map((o, i) => (
              <div
                key={o.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px 8px",
                  borderRight:
                    i % 3 !== 2 ? "1px solid var(--l-border)" : undefined,
                  borderBottom: i < 3 ? "1px solid var(--l-border)" : undefined,
                }}
                className="l-operator-cell"
              >
                <img
                  src={o.src}
                  alt={o.name}
                  className="l-operator-mark"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .l-operator-cell { border-right: none !important; border-bottom: 1px solid var(--l-border) !important; }
        }
      `}</style>
    </section>
  );
}
