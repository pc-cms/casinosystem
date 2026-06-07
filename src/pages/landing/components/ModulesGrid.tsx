import {
  Vault, LayoutGrid, Wallet, Users, BadgeCheck, Wine, Smartphone, Boxes, Eye,
} from "lucide-react";
import { useLandingI18n } from "../i18n/LandingI18nProvider";

const ICONS = [Vault, LayoutGrid, Wallet, Users, BadgeCheck, Wine, Smartphone, Boxes, Eye];

export function ModulesGrid() {
  const { t } = useLandingI18n();
  return (
    <section id="modules" className="l-section">
      <div className="l-container">
        <span className="l-eyebrow">{t.modules.eyebrow}</span>
        <h2 className="l-section-title">{t.modules.title}</h2>
        <p className="l-section-sub">{t.modules.sub}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {t.modules.items.map((m, i) => {
            const Icon = ICONS[i] ?? Vault;
            return (
              <div key={m.title} className="l-card">
                <div
                  style={{
                    display: "inline-flex",
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(201, 162, 76, 0.1)",
                    border: "1px solid rgba(201, 162, 76, 0.25)",
                    color: "var(--l-gold)",
                    marginBottom: 16,
                  }}
                >
                  <Icon size={20} strokeWidth={1.6} />
                </div>
                <h3 style={{ marginBottom: 8 }}>{m.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
