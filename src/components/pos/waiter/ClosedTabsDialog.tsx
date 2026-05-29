/**
 * ClosedTabsDialog — receipt-reprint history for the current POS shift.
 * Shows all closed/voided tabs; clicking one opens ReceiptDialog for reprint.
 */
import { useState } from "react";
import { Receipt, X as XIcon } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { usePosShiftClosedTabs, type PosTab } from "@/hooks/use-pos-tabs";
import ReceiptDialog from "./ReceiptDialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  casinoId: string;
  shiftId: string;
}

export const ClosedTabsDialog = ({ open, onOpenChange, casinoId, shiftId }: Props) => {
  const { data: tabs = [], isLoading } = usePosShiftClosedTabs(casinoId, open ? shiftId : null);
  const [receiptTab, setReceiptTab] = useState<PosTab | null>(null);

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Closed bills — this shift"
        description="Tap a row to preview and reprint the receipt."
        size="2xl"
      >
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : tabs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No closed bills yet on this shift.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tabs.map((t) => {
                const label = t.player_id
                  ? t.player_name || "Player"
                  : `Walk-in · ${t.walkin_label ?? ""}`;
                const isVoid = t.status === "voided";
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setReceiptTab(t)}
                      disabled={isVoid}
                      className={cn(
                        "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-muted/40 transition",
                        isVoid && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{label}</span>
                          {isVoid ? (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              <XIcon className="w-3 h-3 mr-0.5" /> Void
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Closed</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Opened {fmtDateTime(t.opened_at)} · #{t.id.slice(0, 8)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums font-semibold">
                          {formatNumberSpaces(t.total_tzs)}
                        </div>
                        {!isVoid && (
                          <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Receipt className="w-3 h-3" /> reprint
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </ResponsiveDialog>

      <ReceiptDialog
        open={!!receiptTab}
        onOpenChange={(o) => { if (!o) setReceiptTab(null); }}
        tab={receiptTab}
      />
    </>
  );
};

export default ClosedTabsDialog;
