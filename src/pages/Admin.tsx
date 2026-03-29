import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Shield, Trash2, UserPlus, Coins } from "lucide-react";
import { toast } from "sonner";
import { logAction } from "@/lib/logging";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import FloatManagement from "@/components/admin/FloatManagement";

const ROLES = ["manager", "cashier", "pit", "reception", "finance_manager", "security"] as const;

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  cashier: "Cashier",
  pit: "Pit Boss",
  reception: "Reception",
  finance_manager: "Finance",
  security: "Security",
};

const useProfiles = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["all-profiles", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("casino_id", casinoId);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

const useAllRoles = () => {
  const { data: profiles = [] } = useProfiles();
  return useQuery({
    queryKey: ["all-user-roles", profiles.map(p => p.user_id)],
    queryFn: async () => {
      const allRoles: Record<string, string[]> = {};
      for (const profile of profiles) {
        for (const role of ROLES) {
          const { data } = await supabase.rpc("has_role", {
            _user_id: profile.user_id,
            _role: role,
          } as any);
          if (data) {
            if (!allRoles[profile.user_id]) allRoles[profile.user_id] = [];
            allRoles[profile.user_id].push(role);
          }
        }
      }
      return allRoles;
    },
    enabled: profiles.length > 0,
  });
};

const Admin = () => {
  const { isManager, casinoId, user } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { data: allRoles = {} } = useAllRoles();
  const qc = useQueryClient();

  // Create user dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>([]);

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          login: newLogin,
          password: newPassword,
          display_name: newDisplayName,
          roles: newRoles,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success(`User "${newLogin}" created`);
      setShowCreate(false);
      setNewLogin("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRoles([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: role as any,
      });
      if (error) throw error;
      await logAction(casinoId!, "system", "ROLE_ASSIGNED", { user_id: userId, role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success("Role assigned");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);
      if (error) throw error;
      await logAction(casinoId!, "system", "ROLE_REMOVED", { user_id: userId, role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success("Role removed");
    },
  });

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  if (!isManager) {
    return (
      <div className="text-center py-16">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Manager Access Required</h2>
        <p className="text-sm text-muted-foreground mt-1">Only managers can access administration.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground">User & Role Management</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <UserPlus className="w-4 h-4" /> Create User
        </Button>
      </div>

      {/* Assign Role */}
      <div className="cms-panel p-4 max-w-lg mb-6">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Assign Role</h3>
        <div className="flex gap-2">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => {
            if (selectedUser && selectedRole) {
              assignRole.mutate({ userId: selectedUser, role: selectedRole });
              setSelectedRole("");
            }
          }} disabled={!selectedUser || !selectedRole}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Roles</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(profile => {
              const userRoles = allRoles[profile.user_id] || [];
              return (
                <tr key={profile.user_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-card-foreground">{profile.display_name}</span>
                    {profile.user_id === user?.id && (
                      <span className="text-[10px] text-muted-foreground ml-2">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {userRoles.map(role => (
                        <Badge key={role} variant="outline" className="text-[10px] font-mono gap-1">
                          {ROLE_LABELS[role] || role}
                          {profile.user_id !== user?.id && (
                            <button onClick={() => removeRole.mutate({ userId: profile.user_id, role })}
                              className="hover:text-destructive ml-0.5">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {userRoles.length === 0 && (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Login</label>
              <Input value={newLogin} onChange={e => setNewLogin(e.target.value)} placeholder="e.g. cashier2" className="font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">User will log in with this name</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Display Name</label>
              <Input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="min 6 characters" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Roles</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={newRoles.includes(role)}
                      onCheckedChange={(checked) => {
                        setNewRoles(prev =>
                          checked ? [...prev, role] : prev.filter(r => r !== role)
                        );
                      }}
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createUser.mutate()}
              disabled={!newLogin || !newPassword || newPassword.length < 6 || !newDisplayName || createUser.isPending}
            >
              {createUser.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
