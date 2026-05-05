import { useMemo } from "react";
import { UserCog } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserEditorDialog } from "@/components/admin/users/UserEditorDialog";
import { useUsersProfiles, useUsersRoles } from "@/components/admin/users/users-hooks";

const UserEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: profiles = [], isLoading } = useUsersProfiles();
  const userIds = useMemo(() => (id ? [id] : []), [id]);
  const { data: rolesByUser = {} } = useUsersRoles(userIds);
  const profile = profiles.find((p) => p.user_id === id);

  const target = profile && id
    ? {
        mode: "edit" as const,
        userId: id,
        displayName: profile.display_name || "",
        casinoId: profile.casino_id,
        roles: rolesByUser[id] || [],
      }
    : null;

  return (
    <PageShell>
      <PageHeader icon={UserCog} title="Edit User" subtitle={profile?.display_name || ""} />
      {!isLoading && target && (
        <UserEditorDialog
          open
          onOpenChange={(o) => !o && nav("/admin")}
          target={target}
        />
      )}
    </PageShell>
  );
};

export default UserEditPage;
