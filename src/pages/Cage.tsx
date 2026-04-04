import { CardSkeleton, TableSkeleton } from "@/components/LoadingSkeletons";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import OpenShiftScreen from "@/components/cage/OpenShiftScreen";
import ActiveShiftView from "@/components/cage/ActiveShiftView";

const Cage = () => {
  const { data: shift, isLoading: loadingShift } = useActiveShift();
  const { data: players = [], isLoading: loadingPlayers } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  if (loadingShift || loadingPlayers) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Cage</h1>
            <p className="text-xs text-muted-foreground">Loading shift data...</p>
          </div>
        </div>
        <CardSkeleton count={4} />
        <TableSkeleton rows={3} cols={3} />
      </div>
    );
  }

  if (!shift) return <OpenShiftScreen tables={tables} />;
  return <ActiveShiftView shift={shift} players={players} tables={tables} />;
};

export default Cage;
