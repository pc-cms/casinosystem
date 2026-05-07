/**
 * PWAUpdateNotification — full-screen blocking overlay when a new version
 * is available. Cannot be dismissed without updating.
 *
 * Listens for the "pwa:update-available" CustomEvent dispatched from
 * pwa-register.ts and forces the user to reload.
 */
import { useEffect, useState } from "react";
import { RefreshCw, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

declare const __APP_VERSION__: string | undefined;

type UpdateFn = (reload?: boolean) => Promise<void>;

export const PWAUpdateNotification = () => {
  const [visible, setVisible] = useState(false);
  const [updateFn, setUpdateFn] = useState<UpdateFn | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    // Try to read current runtime version
    try {
      const el = document.querySelector('meta[name="app-version"]') as HTMLMetaElement | null;
      if (el?.content) setCurrentVersion(el.content);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { update?: UpdateFn } | undefined;
      if (detail?.update) {
        setUpdateFn(() => detail.update as UpdateFn);
        setVisible(true);
      }
    };

    window.addEventListener("pwa:update-available", handler);
    // If event already fired before listener mounted, check for a sticky flag
    // (pwa-register.ts dispatches immediately on detection)
    return () => window.removeEventListener("pwa:update-available", handler);
  }, []);

  const handleUpdate = async () => {
    if (!updateFn) {
      window.location.reload();
      return;
    }
    try {
      await updateFn(true);
    } catch {
      window.location.reload();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Download className="w-7 h-7 text-primary" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          Доступна новая версия
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Обновление системы Casino Management уже загружено. Для продолжения работы необходимо перезагрузить приложение.
        </p>

        <div className="bg-muted/50 rounded-lg p-3 mb-5 text-left space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Текущая: {currentVersion || "загружается…"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Новая версия готова к установке</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleUpdate}
            className={cn(
              "w-full h-11 text-base font-semibold",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить сейчас
          </Button>

          <p className="text-[10px] text-muted-foreground mt-1">
            Без обновления возможны ошибки синхронизации данных.
          </p>
        </div>
      </div>
    </div>
  );
};
