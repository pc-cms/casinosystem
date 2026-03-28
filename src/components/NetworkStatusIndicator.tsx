import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";

export const NetworkStatusIndicator = () => {
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

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider", config.bg, config.text)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", config.dot, status === "syncing" && "animate-pulse")} />
      <Icon className={cn("w-3 h-3", status === "syncing" && "animate-spin")} />
      <span>{config.label}</span>
    </div>
  );
};
