import { useLandingI18n } from "../i18n/LandingI18nProvider";

export function SiteFooter() {
  const { t } = useLandingI18n();
  return (
    <footer
      style={{
        position: "relative",
        zIndex: 1,
        borderTop: "1px solid var(--l-border)",
        padding: "48px 0 36px",
        background: "rgba(7,9,12,0.6)",
      }}
    >
      <div className="l-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 32,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <div style={{ maxWidth: 360 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontWeight: 800,
                fontSize: 17,
                color: "var(--l-text)",
                marginBottom: 12,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: "linear-gradient(135deg, var(--l-gold) 0%, #8a6e30 100%)",
                }}
              />
              Casino Management System
            </div>
            <p style={{ fontSize: 13.5, color: "var(--l-text-muted)", lineHeight: 1.6 }}>
              {t.footer.tagline}
            </p>
          </div>
          <div
            className="l-mono"
            style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: "0.16em", textTransform: "uppercase" }}
          >
            EN · ES · RU
          </div>
        </div>

        <div className="l-rule-gold" style={{ marginBottom: 24, opacity: 0.5 }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--l-text-dim)",
          }}
        >
          <span>{t.footer.rights}</span>
          <span>Casino Management System · Custom enterprise software</span>
        </div>
      </div>
    </footer>
  );
}
