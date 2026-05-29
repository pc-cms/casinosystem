import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DataTable, DTBody, DTCell, DTHead, DTHeader, DTRow } from "@/components/ui/data-table";
import { usePosMenuPriceHistory, type PosMenuItem } from "@/hooks/use-pos-menu";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PosMenuItem | null;
}

export const PriceHistoryDialog = ({ open, onOpenChange, item }: Props) => {
  const { data: rows = [], isLoading } = usePosMenuPriceHistory(open ? item?.id ?? null : null);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `Price history — ${item.name}` : "Price history"}
      size="lg"
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No changes recorded.</div>
      ) : (
        <DataTable>
          <DTHead>
            <DTRow>
              <DTHeader>When</DTHeader>
              <DTHeader align="right">Old price</DTHeader>
              <DTHeader align="right">New price</DTHeader>
              <DTHeader align="right">Δ</DTHeader>
            </DTRow>
          </DTHead>
          <DTBody>
            {rows.map((r) => {
              const delta = r.old_price_tzs == null ? null : r.new_price_tzs - r.old_price_tzs;
              return (
                <DTRow key={r.id}>
                  <DTCell>{fmtDateTime(r.changed_at)}</DTCell>
                  <DTCell numeric>
                    {r.old_price_tzs == null ? "—" : formatNumberSpaces(r.old_price_tzs)}
                  </DTCell>
                  <DTCell numeric>{formatNumberSpaces(r.new_price_tzs)}</DTCell>
                  <DTCell
                    numeric
                    className={
                      delta == null
                        ? ""
                        : delta > 0
                          ? "text-cms-amount-positive"
                          : delta < 0
                            ? "text-cms-amount-negative"
                            : ""
                    }
                  >
                    {delta == null ? "—" : `${delta > 0 ? "+" : ""}${formatNumberSpaces(delta)}`}
                  </DTCell>
                </DTRow>
              );
            })}
          </DTBody>
        </DataTable>
      )}
    </ResponsiveDialog>
  );
};

export default PriceHistoryDialog;
