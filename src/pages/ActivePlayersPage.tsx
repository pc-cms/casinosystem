import { Users } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import ActivePlayers from "@/components/pit/ActivePlayers";

const ActivePlayersPage = () => {
  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Active Players"
        subtitle="Players currently in the casino"
        date={true}
      />
      <ActivePlayers />
    </PageShell>
  );
};

export default ActivePlayersPage;
