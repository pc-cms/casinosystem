import { useState } from "react";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme";
import { useDensity, type DensityMode } from "@/lib/density";
import { useAuth } from "@/lib/auth-context";
import { getPrimaryRoleLabel } from "@/lib/role-access";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sun, Moon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DENSITY_OPTIONS: { value: DensityMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "comfort", label: "Comfort" },
  { value: "compact", label: "Compact" },
  { value: "touch", label: "Touch" },
];

export const UserProfileDialog = ({ open, onOpenChange }: Props) => {
  const { user, displayName, roles } = useAuth();
  const { theme, toggle } = useTheme();
  const { mode, effective, setMode } = useDensity();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChangePassword = async () => {
    if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setPw(""); setPw2("");
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Profile"
      description="Account, appearance and password"
      size="md"
    >
      <div className="space-y-5">
        {/* Identity */}
        <div className="rounded-md border border-border p-3 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{displayName ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Login</span>
            <span className="font-mono text-xs">{user?.email?.split("@")[0] ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium">{getPrimaryRoleLabel(roles) || "—"}</span>
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => theme !== "light" && toggle()}
              className={cn(
                "h-10 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
              )}
            >
              <Sun className="w-4 h-4" /> Light
            </button>
            <button
              type="button"
              onClick={() => theme !== "dark" && toggle()}
              className={cn(
                "h-10 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
              )}
            >
              <Moon className="w-4 h-4" /> Dark
            </button>
          </div>
        </div>

        {/* Density */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Density</Label>
            {mode === "auto" && (
              <span className="text-xs text-muted-foreground">Auto → {effective}</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {DENSITY_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setMode(o.value)}
                className={cn(
                  "h-9 rounded-md border text-xs font-medium transition-colors",
                  mode === o.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Comfort = roomy. Compact = dense (cashier/pit default). Touch = larger hit targets.
          </p>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label>Change password</Label>
          <Input
            type="password"
            placeholder="New password (min 8)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
          />
          <Button
            variant="outline"
            size="compact"
            onClick={handleChangePassword}
            disabled={busy || !pw || !pw2}
            className="w-full"
          >
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>

      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
};
