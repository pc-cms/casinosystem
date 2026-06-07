import { useLandingI18n, type Lang } from "../i18n/LandingI18nProvider";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ru", label: "RU" },
];

export function LangSwitcher() {
  const { lang, setLang } = useLandingI18n();
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        gap: 2,
        background: "rgba(255,255,255,0.8)",
        border: "1px solid var(--l-border-strong)",
        borderRadius: 999,
        padding: 3,
        backdropFilter: "blur(8px)",
      }}
    >
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            style={{
              border: 0,
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              background: active ? "#0a0a0a" : "transparent",
              color: active ? "#ffffff" : "var(--l-text-muted)",
              transition: "all .15s",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
