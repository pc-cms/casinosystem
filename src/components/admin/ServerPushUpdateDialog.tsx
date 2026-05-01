/**
 * ServerPushUpdateDialog — super_admin queues a target version for a casino's local server.
 * Local cms-updater picks it up via the next /report-health response.
 */
import { useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { usePushUpdate } from "@/hooks/use-network-admin";
import { Rocket } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  casinoId: string | null;
  casinoName: string;
}

export const ServerPushUpdateDialog = ({ open, onOpenChange, casinoId, casinoName }: Props) => {
  const [version, setVersion] = useState("");
  const [autoApply, setAutoApply] = useState(false);
  const push = usePushUpdate();

  const handlePush = async () => {
    if (!casinoId || !version.trim()) return;
    await push.mutateAsync({ casinoId, version, autoApply });
    setVersion("");
    setAutoApply(false);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Push update — ${casinoName}`}
      description="Queue a target frontend version. The local updater will fetch it on the next health ping."
    >
      <div className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Target version (git tag)</label>
          <Input
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="e.g. v1.4.2"
            className="font-mono mt-1"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={autoApply} onCheckedChange={c => setAutoApply(!!c)} />
          <span>Auto-apply (no manual confirmation on the local server)</span>
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePush} disabled={!version.trim() || push.isPending}>
            <Rocket className="w-4 h-4 mr-1" /> Push
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
};
