import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArrowLeftRight } from "lucide-react";
import ChipTransferDialog from "@/components/player/ChipTransferDialog";
import { usePlayer } from "@/hooks/use-player-profile";

/**
 * Full-page route for chip transfers. Replaces the old standalone modal entry
 * so a player's chip transfer can be performed from a deep-link / preview header.
 * The underlying ChipTransferDialog is reused but pinned open; closing it
 * navigates back to the player profile.
 */
const ChipTransferPage = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const direction = (params.get("dir") === "in" ? "in" : "out") as "in" | "out";
  const tableId = params.get("table");
  const { data: player, isLoading } = usePlayer(id);

  const back = () => nav(id ? `/players/${id}` : "/player-statistics");

  return (
    <PageShell>
      <PageHeader
        icon={ArrowLeftRight}
        title="Chip Transfer"
        subtitle={player ? `${player.first_name} ${player.last_name}` : "Loading..."}
      />
      {!isLoading && player && (
        <ChipTransferDialog
          open
          onOpenChange={(v) => { if (!v) back(); }}
          player={{
            id: player.id,
            first_name: player.first_name,
            last_name: player.last_name,
            nickname: (player as any).nickname,
          }}
          defaultDirection={direction}
          tableId={tableId}
        />
      )}
    </PageShell>
  );
};

export default ChipTransferPage;
