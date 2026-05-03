/**
 * UserEditorDialog — single dialog for both "Create" and "Edit" flows.
 *
 * Wide layout (size="2xl") via ResponsiveDialog so it auto-converts to a
 * bottom Drawer on mobile, per the design system rules.
 *
 * Roles are picked as multi-select checkboxes. A user can hold any number of
 * roles — has_role() in the DB is OR-based and all RLS policies already use it.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
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
import {
  ROLE_LABELS,
  ALL_ROLES,
  NON_SUPER_ROLES,
  useAllCasinos,
  useCreateUser,
  useUpdateUserRoles,
  useResetPassword,
  useDisableUser,
} from "./users-hooks";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type UserEditorTarget =
  | { mode: "create" }
  | {
      mode: "edit";
      userId: string;
      displayName: string;
      casinoId: string | null;
      roles: string[];
    };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: UserEditorTarget | null;
}

export const UserEditorDialog = ({ open, onOpenChange, target }: Props) => {
  const { user: currentUser, roles: callerRoles } = useAuth();
  const isSuperAdmin = callerRoles.includes("super_admin");
  const availableRoles = isSuperAdmin ? (ALL_ROLES as readonly string[]) : NON_SUPER_ROLES;

  const { data: casinos = [] } = useAllCasinos();
  const createUser = useCreateUser();
  const updateRoles = useUpdateUserRoles();
  const resetPassword = useResetPassword();
  const disableUser = useDisableUser();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [casinoId, setCasinoId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);

  // Hydrate form when dialog opens
  useEffect(() => {
    if (!open || !target) return;
    if (target.mode === "edit") {
      setLogin("");
      setPassword("");
      setDisplayName(target.displayName || "");
      setCasinoId(target.casinoId || "");
      setSelectedRoles(target.roles);
    } else {
      setLogin("");
      setPassword("");
      setDisplayName("");
      setCasinoId("");
      setSelectedRoles([]);
    }
  }, [open, target]);

  const toggleRole = (r: string, checked: boolean) => {
    setSelectedRoles(prev => (checked ? [...prev, r] : prev.filter(x => x !== r)));
  };

  const isCreate = target?.mode === "create";

  const canSubmit = useMemo(() => {
    if (!target) return false;
    if (target.mode === "create") {
      if (!login.trim() || !displayName.trim()) return false;
      if (password.length < 6) return false;
      if (isSuperAdmin && !casinoId) return false;
      return true;
    }
    return displayName.trim().length > 0;
  }, [target, login, password, displayName, casinoId, isSuperAdmin]);

  const handleSubmit = async () => {
    if (!target) return;
    if (target.mode === "create") {
      try {
        const created = await createUser.mutateAsync({
          login: login.trim(),
          password,
          display_name: displayName.trim(),
          roles: selectedRoles,
          casino_id: casinoId || undefined,
        });
        // create-user already inserted the requested roles; nothing else to do.
        void created;
        onOpenChange(false);
      } catch {/* toast in hook */}
    } else {
      try {
        await updateRoles.mutateAsync({ userId: target.userId, roles: selectedRoles });
        // Note: editing display_name / password is a follow-up feature — not in current scope
        onOpenChange(false);
      } catch {/* toast in hook */}
    }
  };

  const busy = createUser.isPending || updateRoles.isPending;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isCreate ? "Create User" : `Edit roles — ${target?.mode === "edit" ? target.displayName : ""}`}
      description={
        isCreate
          ? "Login is the username the user types on the sign-in screen. A user can have multiple roles."
          : "Toggle roles. A user can hold several roles at once — access is granted by ANY matching role."
      }
      size="2xl"
    >
      <div className="space-y-5">
        {isCreate && isSuperAdmin && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
              Casino
            </label>
            <Select value={casinoId} onValueChange={setCasinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Select casino" />
              </SelectTrigger>
              <SelectContent>
                {casinos.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isCreate && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Login
              </label>
              <Input
                value={login}
                onChange={e => setLogin(e.target.value)}
                placeholder="e.g. cashier2"
                className="font-mono"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1">User logs in with this name</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="min 6 characters"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
            Display Name
          </label>
          <Input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. John Smith"
            disabled={!isCreate /* edit-mode rename is not in scope yet */}
          />
          {!isCreate && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Renaming users is not yet supported here — only roles are editable.
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Roles ({selectedRoles.length} selected)
          </label>
          <div className="grid sm:grid-cols-2 gap-2 rounded-md border border-border bg-muted/20 p-3">
            {availableRoles.map(role => {
              const checked = selectedRoles.includes(role);
              return (
                <label
                  key={role}
                  className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={c => toggleRole(role, c === true)}
                  />
                  <span className={checked ? "font-medium text-foreground" : "text-card-foreground"}>
                    {ROLE_LABELS[role] || role}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Tip: a Manager can also be a Cashier — combine roles freely. Each role unlocks its own
            screens; the UI never hides things from one role just because another role is selected.
          </p>
        </div>
      </div>

      <ResponsiveDialogFooter className="mt-6">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || busy}>
          {busy ? "Saving…" : isCreate ? "Create User" : "Save Roles"}
        </Button>
      </ResponsiveDialogFooter>

      {!canSubmit && isCreate && (
        <p className="hidden">{/* keeps tree stable */}</p>
      )}
      {/* Toasts: hooks already surface errors via sonner */}
      <span className="hidden">{toast.toString()}</span>
    </ResponsiveDialog>
  );
};
