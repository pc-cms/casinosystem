import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Shows an "Install" button when the browser supports PWA installation.
 * Hides itself if the app is already installed (display-mode: standalone) or
 * if the platform never fires `beforeinstallprompt` (e.g. iOS Safari).
 *
 * Modes:
 *   - default: outline button with label
 *   - iconOnly: small square icon button (for inline action rows)
 */
export const InstallPWAButton = ({
  className,
  label = "Install App",
  iconOnly = false,
}: {
  className?: string;
  label?: string;
  iconOnly?: boolean;
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
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

  if (installed || !deferredPrompt) return null;

  const handleClick = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  if (iconOnly) {
    return (
      <button
        onClick={handleClick}
        title={label}
        className={cn(
          "h-7 flex-1 flex items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
          className,
        )}
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={handleClick}>
      <Download className="w-3.5 h-3.5 mr-1.5" />
      {label}
    </Button>
  );
};
