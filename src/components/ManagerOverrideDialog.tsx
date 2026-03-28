import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Key, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";

interface ManagerOverrideDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (managerId: string) => void;
  title?: string;
  description?: string;
  actionType?: string; // For logging: "EDIT_LOCKED_CELL", "APPROVE_EXPENSE", etc.
  actionDetails?: Record<string, any>; // Extra details to log
}

const ManagerOverrideDialog = ({
  open,
  onClose,
  onConfirm,
  title = "Manager Override Required",
  description = "This action requires manager authentication.",
  actionType = "MANAGER_OVERRIDE",
  actionDetails = {},
}: ManagerOverrideDialogProps) => {
  const { user, casinoId } = useAuth();
  const [password, setPassword] = useState("");
  const [rfid, setRfid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"password" | "rfid">("password");
  const passwordRef = useRef<HTMLInputElement>(null);
  const rfidRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setPassword("");
      setRfid("");
      setError("");
      setTimeout(() => {
        if (method === "password") passwordRef.current?.focus();
        else rfidRef.current?.focus();
      }, 100);
    }
  }, [open, method]);

  const handlePasswordAuth = async () => {
    if (!user?.email || !password) return;
    setLoading(true);
    setError("");

    try {
      // Re-authenticate to verify password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        setError("Invalid password");
        setLoading(false);
        return;
      }

      // Verify manager role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isManager = roles?.some(r => r.role === "manager");
      if (!isManager) {
        setError("You do not have manager privileges");
        setLoading(false);
        return;
      }

      // Log the override action
      if (casinoId) {
        await logAction(casinoId, "system", actionType, {
          ...actionDetails,
          manager_id: user.id,
          auth_method: "password",
        });
      }

      setPassword("");
      onConfirm(user.id);
    } catch {
      setError("Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRfidAuth = async () => {
    if (!rfid.trim()) return;
    setLoading(true);
    setError("");

    try {
      // Look up profile by RFID tag
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("rfid_tag", rfid.trim())
        .maybeSingle();

      if (profileError || !profile) {
        setError("RFID tag not recognized");
        setLoading(false);
        return;
      }

      // Verify the RFID user has manager role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      const isManager = roles?.some(r => r.role === "manager");
      if (!isManager) {
        setError(`${profile.display_name} is not a manager`);
        setLoading(false);
        return;
      }

      // Log the override action
      if (casinoId) {
        await logAction(casinoId, "system", actionType, {
          ...actionDetails,
          manager_id: profile.user_id,
          manager_name: profile.display_name,
          auth_method: "rfid",
        });
      }

      setRfid("");
      onConfirm(profile.user_id);
    } catch {
      setError("Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setRfid("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>

        <Tabs value={method} onValueChange={(v) => { setMethod(v as any); setError(""); }}>
          <TabsList className="w-full">
            <TabsTrigger value="password" className="flex-1 gap-1.5 text-xs">
              <Key className="w-3.5 h-3.5" /> Password
            </TabsTrigger>
            <TabsTrigger value="rfid" className="flex-1 gap-1.5 text-xs">
              <CreditCard className="w-3.5 h-3.5" /> RFID
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-2 mt-3">
            <Input
              ref={passwordRef}
              type="password"
              placeholder="Enter manager password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordAuth()}
              autoComplete="current-password"
            />
          </TabsContent>

          <TabsContent value="rfid" className="space-y-2 mt-3">
            <Input
              ref={rfidRef}
              type="text"
              placeholder="Scan RFID tag…"
              value={rfid}
              onChange={(e) => setRfid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRfidAuth()}
              className="font-mono"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">Place manager RFID card on reader</p>
          </TabsContent>
        </Tabs>

        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={method === "password" ? handlePasswordAuth : handleRfidAuth}
            disabled={loading || (method === "password" ? !password : !rfid.trim())}
          >
            {loading ? "Verifying…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOverrideDialog;
