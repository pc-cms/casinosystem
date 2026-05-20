/**
 * VersionIndicator — shows the running frontend version.
 * Static text only — no manual update checks.
 *
 * Version source priority:
 *   1. runtime-config.json `version` (patched by local cms-frontend entrypoint)
 *   2. __APP_VERSION__ injected by Vite at build time
 *   3. "dev" fallback (editor preview)
 */
import { useEffect, useState } from "react";
import { getRuntimeConfig } from "@/lib/runtime-config";

declare const __APP_VERSION__: string | undefined;

const BUILD_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__ ? __APP_VERSION__ : "dev";

interface Props {
  collapsed?: boolean;
}

export const VersionIndicator = ({ collapsed = false }: Props) => {
  const [version, setVersion] = useState<string>(BUILD_VERSION);

  useEffect(() => {
    getRuntimeConfig()
      .then((cfg) => {
        const onpremSlug = cfg.casinoSlug && ["mwz", "aru", "dod", "mbi"].includes(cfg.casinoSlug.toLowerCase())
          ? cfg.casinoSlug.toLowerCase()
          : null;
        const localTag = onpremSlug ? `local-${onpremSlug}` : "local";
        // Ignore placeholder "local" version — show real build version instead.
        if (cfg.version && cfg.version !== "local") {
          setVersion(cfg.localMode ? `${cfg.version} · ${localTag}` : cfg.version);
        } else if (cfg.localMode) {
          setVersion(`${BUILD_VERSION} · ${localTag}`);
        }
      })
      .catch(() => { /* keep build version */ });
  }, []);

  if (collapsed) {
    return (
      <div
        title={`v${version}`}
        className="h-5 w-full flex items-center justify-center text-[8px] font-mono text-sidebar-foreground/50 select-none"
      >
        v{version}
      </div>
    );
  }

  return (
    <div className="w-full px-2 py-1 text-[10px] font-mono text-sidebar-foreground/50 select-none">
      v{version}
    </div>
  );
};
