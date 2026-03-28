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
  actionType?: string;
  actionDetails?: Record<string, any>;
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
  const { casinoId } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rfid, setRfid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"password" | "rfid">("password");
  const emailRef = useRef<HTMLInputElement>(null);
  const rfidRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setPassword("");
      setRfid("");
      setError("");
      setTimeout(() => {
        if (method === "password") emailRef.current?.focus();
        else rfidRef.current?.focus();
      }, 100);
    }
  }, [open, method]);

  const handlePasswordAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      // Call edge function to verify manager credentials without affecting current session
      const { data, error: fnError } = await supabase.functions.invoke("verify-manager", {
        body: { email, password },
      });

      if (fnError || !data?.manager_id) {
        setError(data?.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      // Log the override action
      if (casinoId) {
        await logAction(casinoId, "system", actionType, {
          ...actionDetails,
          manager_id: data.manager_id,
          manager_name: data.display_name,
          auth_method: "password",
        });
      }

      setEmail("");
      setPassword("");
      onConfirm(data.manager_id);
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
      const { data: lookupResult, error: lookupError } = await supabase
        .rpc("lookup_rfid_user", { rfid: rfid.trim() });

      const profile = Array.isArray(lookupResult) ? lookupResult[0] : lookupResult;

      if (lookupError || !profile) {
        setError("RFID tag not recognized");
        setLoading(false);
        return;
      }

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
    setEmail("");
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
              ref={emailRef}
              type="email"
              placeholder="Manager email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("mgr-pwd")?.focus()}
              autoComplete="off"
            />
            <Input
              id="mgr-pwd"
              type="password"
              placeholder="Manager password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordAuth()}
              autoComplete="off"
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
            disabled={loading || (method === "password" ? (!email || !password) : !rfid.trim())}
          >
            {loading ? "Verifying…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOverrideDialog;
