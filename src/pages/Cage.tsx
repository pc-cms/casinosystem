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
import { useAuth } from "@/lib/auth-context";

const Cage = () => {
  const isReadOnly = useReadOnlyMode();
  const { roles, managerOverride } = useAuth();

  // Cage is a CASHIER-only operational surface.
  // Cashier and Super Admin can transact. Manager Access override also unlocks it.
  // Everyone else (Manager, Surveillance, Pit, Reception, HR, Finance) sees read-only history.
  const canTransact =
    roles.includes("cashier") ||
    roles.includes("super_admin") ||
    managerOverride.active;

  if (isReadOnly || !canTransact) return <CageHistoryView />;

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
