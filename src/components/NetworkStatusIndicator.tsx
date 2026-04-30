import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Compact = only colored dot, with tooltip showing full status. */
  compact?: boolean;
}

export const NetworkStatusIndicator = ({ compact = false }: Props) => {
  const { status, pendingCount } = useNetworkStatus();

  const config = {
    online: {
      icon: Wifi,
      label: "Online",
      bg: "bg-emerald-500/15",
      text: "text-emerald-500",
      dot: "bg-emerald-500",
    },
    offline: {
      icon: WifiOff,
      label: "Offline",
      bg: "bg-destructive/15",
      text: "text-destructive",
      dot: "bg-destructive",
    },
    syncing: {
      icon: RefreshCw,
      label: `Syncing${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
      bg: "bg-amber-500/15",
      text: "text-amber-500",
      dot: "bg-amber-500",
    },
  }[status];

  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label={config.label}
              className={cn(
                "inline-block w-2 h-2 rounded-full shrink-0",
                config.dot,
                status === "syncing" && "animate-pulse"
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="right">{config.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider", config.bg, config.text)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", config.dot, status === "syncing" && "animate-pulse")} />
      <Icon className={cn("w-3 h-3", status === "syncing" && "animate-spin")} />
      <span>{config.label}</span>
    </div>
  );
};
