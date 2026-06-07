import { SectionReveal } from "@/lib/motion";

const CURRENCIES = ["TZS", "USD", "EUR", "GBP", "KES"];
const LANGS = ["EN", "ES", "RU"];

function Disc({ label, size = 76 }: { label: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#ffffff",
        border: "1px solid var(--l-border)",
        boxShadow: "0 10px 24px -14px rgba(15,23,42,0.18)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter Tight, sans-serif",
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: "-0.01em",
        color: "var(--l-text)",
      }}
    >
      {label}
    </div>
  );
}

export function IntegrationsLanguages() {
  const discs = [
    ...CURRENCIES.map((c) => ({ k: `c-${c}`, label: c })),
    ...LANGS.map((l) => ({ k: `l-${l}`, label: l })),
  ];

  return (
    <section className="l-section" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="l-container">
        <div
          className="l-card"
          style={{
            padding: "48px 36px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <span className="l-eyebrow"><span>Local from day one</span></span>
            <h2 style={{ fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)", marginBottom: 14 }}>
              Speaks your language.<br />Settles in your currency.
            </h2>
            <p style={{ fontSize: "1rem", color: "var(--l-text-muted)", lineHeight: 1.6, maxWidth: 460 }}>
              Multi-currency cage, per-casino number formats and a UI that ships
              in three languages out of the box — with room for more.
            </p>
          </div>

          <SectionReveal y={20}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                justifyContent: "center",
              }}
            >
              {discs.map((d, i) => (
                <div
                  key={d.k}
                  style={{
                    transform: `translateY(${(i % 2) * 14}px)`,
                  }}
                >
                  <Disc label={d.label} />
                </div>
              ))}
            </div>
          </SectionReveal>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .landing-root section .l-card[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}
