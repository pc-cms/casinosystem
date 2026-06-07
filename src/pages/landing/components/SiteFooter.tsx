import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { LangSwitcher } from "./LangSwitcher";

const NAV = [
  { id: "home", key: "home" as const },
  { id: "modules", key: "modules" as const },
  { id: "solutions", key: "solutions" as const },
  { id: "partners", key: "partners" as const },
  { id: "about", key: "about" as const },
  { id: "contact", key: "contacts" as const },
];

export function SiteFooter() {
  const { t } = useLandingI18n();
  return (
    <footer
      style={{
        borderTop: "1px solid var(--l-border)",
        padding: "56px 0 32px",
        background: "var(--l-surface)",
      }}
    >
      <div className="l-container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr",
            gap: 40,
            marginBottom: 40,
          }}
          className="l-footer-grid"
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "-0.02em",
                marginBottom: 12,
                color: "var(--l-text)",
              }}
            >
              CMS · Casino Management System
            </div>
            <p style={{ fontSize: 14, maxWidth: 360 }}>{t.footer.tagline}</p>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--l-text-dim)",
                marginBottom: 14,
                fontWeight: 600,
              }}
            >
              {t.footer.nav}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {NAV.map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    style={{ color: "var(--l-text-muted)", textDecoration: "none", fontSize: 14 }}
                  >
                    {t.nav[l.key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--l-text-dim)",
                marginBottom: 14,
                fontWeight: 600,
              }}
            >
              {t.footer.languages}
            </div>
            <LangSwitcher />
          </div>
        </div>

        <div className="l-rule-gold" style={{ margin: "8px 0 24px" }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12.5,
            color: "var(--l-text-dim)",
          }}
        >
          <div>{t.footer.rights}</div>
        </div>
      </div>
      <style>{`@media (max-width: 768px) { .l-footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; } }`}</style>
    </footer>
  );
}
