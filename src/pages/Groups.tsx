import { useState } from "react";
import { usePlayerGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember, usePlayers, usePlayerEconomy } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const Groups = () => {
  const { isManager } = useAuth();
  const { data: groups = [] } = usePlayerGroups();
  const { data: players = [] } = usePlayers();
  const { data: economy = [] } = usePlayerEconomy();
  const createGroup = useCreateGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");

  const getPlayerEconomy = (playerId: string) => economy.find(e => e.player_id === playerId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Player Groups</h1>
          <p className="text-sm text-muted-foreground">Manager-controlled grouping with analytics</p>
        </div>
        {isManager && (
          <Button onClick={() => setShowCreate(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> New Group</Button>
        )}
      </div>

      <div className="space-y-4">
        {groups.map(group => {
          const activeMembers = (group as any).group_members?.filter((m: any) => !m.left_at) || [];
          const groupDrop = activeMembers.reduce((s: number, m: any) => s + Number(getPlayerEconomy(m.player_id)?.total_drop || 0), 0);
          const groupCashout = activeMembers.reduce((s: number, m: any) => s + Number(getPlayerEconomy(m.player_id)?.total_cashout || 0), 0);
          const groupExpenses = activeMembers.reduce((s: number, m: any) => s + Number(getPlayerEconomy(m.player_id)?.total_expenses || 0), 0);

          return (
            <div key={group.id} className="cms-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">{group.name}</h3>
                  <span className="text-xs text-muted-foreground">({activeMembers.length} members)</span>
                </div>
                {isManager && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setAddingToGroup(group.id)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Member
                  </Button>
                )}
              </div>

              <div className="px-4 py-3 grid grid-cols-4 gap-3 border-b border-border">
                <div><p className="text-[10px] uppercase text-muted-foreground">Drop</p><p className="font-mono text-sm font-bold text-card-foreground">€{groupDrop.toLocaleString()}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Cashout</p><p className="font-mono text-sm font-bold text-card-foreground">€{groupCashout.toLocaleString()}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Expenses</p><p className="font-mono text-sm font-bold text-card-foreground">€{groupExpenses.toLocaleString()}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Result</p>
                  <p className={`font-mono text-sm font-bold ${groupCashout - groupDrop - groupExpenses >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    €{(groupCashout - groupDrop - groupExpenses).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="px-4 py-2">
                {activeMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <span className="text-xs text-card-foreground">{m.players?.first_name} {m.players?.last_name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">joined {new Date(m.joined_at).toLocaleDateString("en-GB")}</span>
                    </div>
                    {isManager && (
                      <button onClick={() => removeMember.mutate(m.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
                {activeMembers.length === 0 && <p className="text-xs text-muted-foreground py-2">No members</p>}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No groups created</p>}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <Input placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => { createGroup.mutate(newName); setNewName(""); setShowCreate(false); }} disabled={!newName}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addingToGroup} onOpenChange={() => setAddingToGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
            <SelectContent>
              {players.filter(p => p.status === "active").map(p => (
                <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingToGroup(null)}>Cancel</Button>
            <Button onClick={() => { if (addingToGroup && selectedPlayer) { addMember.mutate({ groupId: addingToGroup, playerId: selectedPlayer }); setSelectedPlayer(""); setAddingToGroup(null); } }}
              disabled={!selectedPlayer}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Groups;
