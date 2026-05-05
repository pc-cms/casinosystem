import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { RegisterTab } from "@/pages/Reception";

const RegisterPlayerPage = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  return (
    <PageShell>
      <PageHeader icon={UserPlus} title="Register Player" subtitle="New player registration">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}>Cancel</Button>
      </PageHeader>
      <PageSection card>
        <RegisterTab
          onRegistered={() => {
            qc.invalidateQueries({ queryKey: ["players"] });
            nav(-1);
          }}
        />
      </PageSection>
    </PageShell>
  );
};

export default RegisterPlayerPage;
