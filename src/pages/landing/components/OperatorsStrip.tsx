import { useLandingI18n } from "../i18n/LandingI18nProvider";
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
        <span className="l-eyebrow">{t.operators.eyebrow}</span>
        <h2 className="l-section-title">{t.operators.title}</h2>
        <p className="l-section-sub" style={{ maxWidth: 820 }}>{t.operators.sub}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 24,
            alignItems: "center",
            justifyItems: "center",
            padding: "32px 24px",
            background: "var(--l-surface)",
            border: "1px solid var(--l-border)",
            borderRadius: 12,
          }}
        >
          {OPERATORS.map((o) => (
            <img
              key={o.name}
              src={o.src}
              alt={o.name}
              className="l-operator-mark"
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
