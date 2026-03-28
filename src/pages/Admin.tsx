import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logAction } from "@/lib/logging";

const ROLES = ["manager", "cashier", "pit", "reception"] as const;

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
  const { casinoId } = useAuth();
  const { data: profiles = [] } = useProfiles();
  return useQuery({
    queryKey: ["all-user-roles", profiles.map(p => p.user_id)],
    queryFn: async () => {
      // Manager can see all roles via security definer
      // We need to fetch roles for each profile user
      const allRoles: Record<string, string[]> = {};
      for (const profile of profiles) {
        // Use has_role check for each
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
        <p className="text-sm text-muted-foreground mt-1">Only managers can access role administration.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
        <p className="text-sm text-muted-foreground">Assign and manage user roles</p>
      </div>

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
            <SelectTrigger className="w-32"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
                          {role}
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
    </div>
  );
};

export default Admin;
