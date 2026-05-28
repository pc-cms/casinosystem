import { useState } from "react";
import { useParams } from "react-router-dom";
import { Coins, Printer } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format-date";
import { useCageSlotsShift } from "@/hooks/use-cage-slots";
import PrintSlotsShiftDialog from "@/components/cage-slots/PrintSlotsShiftDialog";
import SlotsShiftReportBody from "@/components/cage-slots/SlotsShiftReportBody";

const CageSlotsReport = () => {
  const { id } = useParams<{ id: string }>();
  const [printOpen, setPrintOpen] = useState(false);
  const { data: shift } = useCageSlotsShift(id);

  if (!shift || !id) {
    return (
      <PageShell className="print-target">
        <PageHeader icon={Coins} title="Cage Slots · Report" subtitle="Loading…" />
      </PageShell>
    );
  }

  return (
    <PageShell className="print-target">
      <PageHeader
        icon={Coins}
        title="Cage Slots · Shift Report"
        subtitle={`${fmtDate(shift.business_date)} · ${shift.shift_type.toUpperCase()}`}
        context={<Badge variant="outline" className="uppercase text-[10px]">{shift.status.replace("_", " ")}</Badge>}
      >
        <Button onClick={() => setPrintOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 print:hidden">
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
      </PageHeader>

      <PrintSlotsShiftDialog
        open={printOpen}
        shiftId={id}
        onClose={() => setPrintOpen(false)}
      />

      <SlotsShiftReportBody id={id} />

      <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
        <div>
          <p className="border-t border-foreground pt-1 text-center">Cashier Signature</p>
        </div>
        <div>
          <p className="border-t border-foreground pt-1 text-center">Manager Signature</p>
        </div>
      </div>
    </PageShell>
  );
};

export default CageSlotsReport;
