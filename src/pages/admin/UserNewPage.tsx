import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserEditorDialog } from "@/components/admin/users/UserEditorDialog";

const UserNewPage = () => {
  const nav = useNavigate();
  return (
    <PageShell>
      <PageHeader icon={UserPlus} title="New User" subtitle="Create a new staff account" />
      <UserEditorDialog
        open
        onOpenChange={(o) => !o && nav("/admin")}
        target={{ mode: "create" }}
      />
    </PageShell>
  );
};

export default UserNewPage;
