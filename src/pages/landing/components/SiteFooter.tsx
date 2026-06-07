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
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(10px)",
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
                fontWeight: 700,
                fontSize: 18,
                color: "var(--l-text)",
                marginBottom: 12,
                letterSpacing: "-0.03em",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: "#0a0a0a",
                }}
              />
              Casino System
            </div>
            <p style={{ fontSize: 14, color: "var(--l-text-muted)", lineHeight: 1.6 }}>
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
            fontSize: 13,
            color: "var(--l-text-dim)",
          }}
        >
          <span>©2026 Amaell Group LLC. All Rights Reserved.</span>
          <span>Casino System · Custom enterprise software</span>
        </div>
      </div>
    </footer>
  );
}
