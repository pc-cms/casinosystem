/**
 * UsersTab — full Users & Roles management view.
 *
 * Replaces the old in-page UsersAndRoles component (which was crammed into the
 * 1000-line Admin.tsx and used a tiny "max-w-sm" Dialog for creation).
 *
 * Structure:
 *   - Header bar (search + "+ New User")
 *   - DataTable with: Display Name, Login (badge), Casino, Roles (chips), Actions
 *   - Single UserEditorDialog used for both create and edit
 *   - Module-permissions dialog reused as-is for super_admin
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, SlidersHorizontal, Shield, Trash2 } from "lucide-react";
import { UserPermissionsDialog } from "@/components/admin/UserPermissionsDialog";
import { ROLE_LABELS, useUsersProfiles, useUsersRoles, useAllCasinos, useDisableUser } from "./users-hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const UsersTab = () => {
  const navigate = useNavigate();
  const { user, roles: callerRoles } = useAuth();
  const isSuperAdmin = callerRoles.includes("super_admin");
  const isFinance = callerRoles.includes("finance_manager");
  const showCasinoColumn = isSuperAdmin || isFinance;

  const { data: profiles = [], isLoading } = useUsersProfiles();
  const userIds = useMemo(() => profiles.map(p => p.user_id), [profiles]);
  const { data: rolesByUser = {} } = useUsersRoles(userIds);
  const { data: casinos = [] } = useAllCasinos();
  const disableUser = useDisableUser();

  const [search, setSearch] = useState("");
  const [permsTarget, setPermsTarget] = useState<{ id: string; name: string } | null>(null);
  const [disableTarget, setDisableTarget] = useState<{ id: string; name: string } | null>(null);

  const casinoName = (id: string | null) =>
    id ? (casinos.find(c => c.id === id)?.name ?? id.slice(0, 8)) : "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Hide super_admin accounts from non-super viewers — they should not even
    // know super_admin exists. Defense in depth: badges below also strip the role.
    const visible = isSuperAdmin
      ? profiles
      : profiles.filter(p => !(rolesByUser[p.user_id] || []).includes("super_admin"));
    if (!q) return visible;
    return visible.filter(p => {
      const name = (p.display_name || "").toLowerCase();
      const userRoles = (rolesByUser[p.user_id] || []).join(" ").toLowerCase();
      return name.includes(q) || userRoles.includes(q);
    });
  }, [search, profiles, rolesByUser, isSuperAdmin]);

  const openCreate = () => navigate("/admin/users/new");
  const openEdit = (p: typeof profiles[number]) => navigate(`/admin/users/${p.user_id}/edit`);

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Users &amp; Roles</h3>
          <p className="text-xs text-muted-foreground">
            A user can hold multiple roles — Manager + Cashier, etc. Access is granted by ANY matching role.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or role…"
              className="pl-8 w-56"
            />
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="w-4 h-4" /> New User
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="cms-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">User</th>
                {showCasinoColumn && (
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Casino</th>
                )}
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Roles</th>
                <th className="w-[120px] text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const rawRoles = rolesByUser[p.user_id] || [];
                // Strip super_admin from the badge list when viewer is not super_admin.
                const userRoles = isSuperAdmin ? rawRoles : rawRoles.filter(r => r !== "super_admin");
                const isSelf = p.user_id === user?.id;
                return (
                  <tr key={p.user_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {(p.display_name || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
                            {p.display_name || <span className="text-muted-foreground italic">No name</span>}
                            {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                            {p.disabled_at && <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground/60">
                            {p.user_id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    {showCasinoColumn && (
                      <td className="px-4 py-3 text-xs text-muted-foreground">{casinoName(p.casino_id)}</td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground/40 italic">No roles assigned</span>
                        )}
                        {userRoles.map(r => (
                          <Badge
                            key={r}
                            variant={r === "super_admin" ? "default" : "secondary"}
                            className="text-[10px] font-medium"
                          >
                            {ROLE_LABELS[r] || r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-0.5 justify-end items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                          title="Edit roles"
                          className="h-8 w-8"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPermsTarget({ id: p.user_id, name: p.display_name || "User" })}
                            title="Module permissions"
                            className="h-8 w-8"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDisableTarget({ id: p.user_id, name: p.display_name || "User" })}
                          title="Disable user"
                          disabled={isSelf || !!p.disabled_at}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={showCasinoColumn ? 4 : 3} className="text-center py-10">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {search ? "No users match your search" : "No users yet — click “New User” to add one."}
                    </p>
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={showCasinoColumn ? 4 : 3} className="text-center py-10 text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      

      <UserPermissionsDialog
        open={!!permsTarget}
        onOpenChange={o => !o && setPermsTarget(null)}
        userId={permsTarget?.id ?? null}
        userName={permsTarget?.name ?? ""}
        userRoles={permsTarget ? (rolesByUser[permsTarget.id] || []) : []}
      />

      <AlertDialog open={!!disableTarget} onOpenChange={o => !o && setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable user?</AlertDialogTitle>
            <AlertDialogDescription>
              {disableTarget?.name} will no longer be able to sign in. Historical logs and records stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!disableTarget) return;
                disableUser.mutate({ userId: disableTarget.id }, { onSuccess: () => setDisableTarget(null) });
              }}
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
