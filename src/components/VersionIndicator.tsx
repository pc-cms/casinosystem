/**
 * VersionIndicator — shows the running frontend version and lets the user
 * manually check for an update. Sits at the bottom of the sidebar.
 *
 * Version source priority:
 *   1. runtime-config.json `version` (patched by local cms-frontend entrypoint)
 *   2. __APP_VERSION__ injected by Vite at build time
 *   3. "dev" fallback (editor preview)
 *
 * "Check for updates" pings the active service worker registration. If a new
 * worker is found, vite-plugin-pwa's onNeedRefresh callback (in pwa-register.ts)
 * surfaces the standard reload toast.
 */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getRuntimeConfig } from "@/lib/runtime-config";

declare const __APP_VERSION__: string | undefined;

const BUILD_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__ ? __APP_VERSION__ : "dev";

interface Props {
  collapsed?: boolean;
}

export const VersionIndicator = ({ collapsed = false }: Props) => {
  const [version, setVersion] = useState<string>(BUILD_VERSION);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getRuntimeConfig()
      .then((cfg) => {
        if (cfg.version) setVersion(cfg.version);
      })
      .catch(() => { /* keep build version */ });
  }, []);

  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      if (!("serviceWorker" in navigator)) {
        toast.info("Проверка обновлений недоступна", {
          description: "Service Worker не поддерживается в этом окружении.",
        });
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        toast.info("Service Worker не зарегистрирован", {
          description: "Откройте опубликованную версию, не editor preview.",
        });
        return;
      }
      await reg.update();
      // Если обновление найдено — pwa-register.ts покажет «Доступна новая версия».
      // Иначе подтверждаем, что версия актуальна.
      setTimeout(() => {
        if (!reg.waiting && !reg.installing) {
          toast.success("Установлена последняя версия", {
            description: `Текущая: ${version}`,
          });
        }
      }, 1500);
    } catch (e) {
      toast.error("Не удалось проверить обновления", {
        description: String((e as Error)?.message ?? e),
      });
    } finally {
      setTimeout(() => setChecking(false), 1500);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={handleCheck}
        title={`v${version} — проверить обновления`}
        className="h-6 w-full flex items-center justify-center text-[8px] font-mono text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded transition-colors"
      >
        <RefreshCw className={cn("w-2.5 h-2.5", checking && "animate-spin")} />
      </button>
    );
  }

  return (
    <button
      onClick={handleCheck}
      title="Проверить обновления"
      className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-[10px] font-mono text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors group"
    >
      <span className="truncate">v{version}</span>
      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <RefreshCw className={cn("w-2.5 h-2.5", checking && "animate-spin")} />
        <span>check</span>
      </span>
    </button>
  );
};
