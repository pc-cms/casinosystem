import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { SectionLabel } from "./SectionLabel";
import { StaggerContainer, StaggerItem } from "@/lib/motion";

export function BuiltForLandBased() {
  const { t } = useLandingI18n();
  return (
    <section className="l-section">
      <div className="l-container">
        <SectionLabel code="02" label={t.builtFor.eyebrow} />
        <h2 className="l-section-title">{t.builtFor.title}</h2>
        <p className="l-section-sub">{t.builtFor.sub}</p>

        <StaggerContainer
          as="div"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 0,
            border: "1px solid var(--l-border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--l-surface)",
          }}
        >
          {t.builtFor.items.map((item, i) => (
            <StaggerItem key={item}>
              <div
                style={{
                  padding: "22px 22px",
                  borderRight: "1px solid var(--l-border)",
                  borderBottom: "1px solid var(--l-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  minHeight: 84,
                }}
              >
                <span
                  className="l-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--l-gold)",
                    letterSpacing: "0.18em",
                    minWidth: 22,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 14, color: "var(--l-text)", fontWeight: 500 }}>
                  {item}
                </span>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
