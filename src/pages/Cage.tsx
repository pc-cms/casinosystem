import { Landmark } from "lucide-react";
import { CardSkeleton, TableSkeleton } from "@/components/LoadingSkeletons";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import OpenShiftScreen from "@/components/cage/OpenShiftScreen";
import ActiveShiftView from "@/components/cage/ActiveShiftView";
import CageHistoryView from "@/components/cage/CageHistoryView";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useReadOnlyMode } from "@/hooks/use-readonly-mode";

const Cage = () => {
  const isReadOnly = useReadOnlyMode();

  // Surveillance gets the read-only history view (no shift dependency).
  if (isReadOnly) return <CageHistoryView />;

  const { data: shift, isLoading: loadingShift } = useActiveShift();
  const { data: players = [], isLoading: loadingPlayers } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  if (loadingShift || loadingPlayers) {
    return (
      <PageShell>
        <PageHeader icon={Landmark} title="Cage" subtitle="Loading shift data…" date />
        <CardSkeleton count={4} />
        <TableSkeleton rows={3} cols={3} />
      </PageShell>
    );
  }

  if (!shift) return <OpenShiftScreen tables={tables} />;
  return <ActiveShiftView shift={shift} players={players} tables={tables} />;
};

export default Cage;
