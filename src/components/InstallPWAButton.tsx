import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Shows an "Install" button when the browser supports PWA installation.
 * Hides itself if the app is already installed (display-mode: standalone) or
 * if the platform never fires `beforeinstallprompt` (e.g. iOS Safari).
 */
export const InstallPWAButton = ({ className, label = "Install App" }: { className?: string; label?: string }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as any).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${className ?? ""}`}
        style={{
          backgroundColor: "rgba(232, 198, 136, 0.12)",
          color: "#E8C688",
          border: "1px solid rgba(232, 198, 136, 0.35)",
        }}
      >
        <CheckCircle2 className="w-2.5 h-2.5" />
        <span>Installed</span>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setDeferredPrompt(null);
      }}
    >
      <Download className="w-3.5 h-3.5 mr-1.5" />
      {label}
    </Button>
  );
};
