import { useState } from "react";
import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { LangSwitcher } from "./LangSwitcher";
import { Menu, X } from "lucide-react";

const links = [
  { id: "modules", key: "modules" as const },
  { id: "partners", key: "partners" as const },
  { id: "about", key: "about" as const },
  { id: "contact", key: "contacts" as const },
];

export function SiteHeader() {
  const { t } = useLandingI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="l-header">
      <div
        className="l-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          gap: 16,
        }}
      >
        <a
          href="#home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--l-text)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            fontSize: 19,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "#0a0a0a",
            }}
          />
          Casino System
        </a>

        <nav
          aria-label="Primary"
          className="l-nav-desktop"
          style={{ display: "flex", gap: 32, alignItems: "center" }}
        >
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              style={{
                color: "var(--l-text-muted)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--l-text)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--l-text-muted)")
              }
            >
              {t.nav[l.key]}
            </a>
          ))}
        </nav>

        <div
          className="l-actions-desktop"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <LangSwitcher />
          <a href="#contact" className="l-btn l-btn-primary">
            {t.nav.cta}
          </a>
        </div>

        <button
          aria-label="Menu"
          className="l-mobile-toggle"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "none",
            background: "transparent",
            border: "1px solid var(--l-border-strong)",
            color: "var(--l-text)",
            borderRadius: 999,
            padding: 10,
            cursor: "pointer",
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div
          className="l-mobile-panel"
          style={{
            borderTop: "1px solid var(--l-border)",
            padding: "16px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "rgba(255,255,255,0.95)",
          }}
        >
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={() => setOpen(false)}
              style={{
                color: "var(--l-text)",
                textDecoration: "none",
                fontSize: 16,
                fontWeight: 500,
                padding: "10px 0",
                borderBottom: "1px solid var(--l-border)",
              }}
            >
              {t.nav[l.key]}
            </a>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <LangSwitcher />
            <a
              href="#contact"
              className="l-btn l-btn-primary"
              onClick={() => setOpen(false)}
            >
              {t.nav.cta}
            </a>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .l-nav-desktop, .l-actions-desktop { display: none !important; }
          .l-mobile-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
        }
        @media (min-width: 901px) {
          .l-mobile-panel { display: none !important; }
        }
      `}</style>
    </header>
  );
}
