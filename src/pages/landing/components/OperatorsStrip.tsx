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

function Row({ reverse = false }: { reverse?: boolean }) {
  // duplicate twice for seamless loop
  const items = [...OPERATORS, ...OPERATORS];
  return (
    <div className="l-marquee">
      <div className={`l-marquee__track ${reverse ? "l-marquee__track--reverse" : ""}`}>
        {items.map((o, i) => (
          <div key={`${o.name}-${i}`} className="l-marquee__cell">
            <img
              src={o.src}
              alt={o.name}
              className="l-operator-mark"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OperatorsStrip() {
  const { t } = useLandingI18n();
  return (
    <section
      className="l-section"
      style={{ paddingTop: 80, paddingBottom: 80, textAlign: "center" }}
    >
      <div className="l-container" style={{ marginBottom: 36 }}>
        <p
          className="l-mono"
          style={{
            fontSize: 12,
            color: "var(--l-text-dim)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          {t.operators.eyebrow}
        </p>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--l-text-muted)",
            marginTop: 12,
            maxWidth: 720,
            marginInline: "auto",
          }}
        >
          {t.operators.sub}
        </p>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <Row />
        <Row reverse />
      </div>
    </section>
  );
}
