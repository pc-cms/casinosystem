import { useState, useMemo } from "react";
import { usePlayerGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember, usePlayers, useTransactions, useExpenses } from "@/hooks/use-casino-data";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, X, CalendarDays } from "lucide-react";
import { fmtDate } from "@/lib/format-date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

/**
 * GROUPS (STRICT):
 * - Analytical only — does NOT affect transactions
 * - Time-based membership (join/leave)
 * - Group result calculated only for period where players are in group
 * - RESULT = CASHOUT - DROP
 * - REAL RESULT = CASHOUT - DROP - EXPENSES (approved only)
 */
const Groups = () => {
  const { isManager } = useAuth();
  const { data: groups = [] } = usePlayerGroups();
  const { data: players = [] } = usePlayers();
  const { data: allTransactions = [] } = useTransactions();
  const { data: allExpenses = [] } = useExpenses();
  const createGroup = useCreateGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  // Period-filtered analytics: only count transactions within period AND while member was in group
  const computeGroupStats = (members: any[]) => {
    const activeMembers = members.filter((m: any) => !m.left_at);
    let drop = 0, cashout = 0, expenses = 0;

    activeMembers.forEach((m: any) => {
      const joinedAt = m.joined_at;
      const leftAt = m.left_at;

      allTransactions.forEach(tx => {
        // Must be within membership period
        if (tx.created_at < joinedAt) return;
        if (leftAt && tx.created_at > leftAt) return;
        // Must be within date filter if set
        if (dateRange.from && tx.created_at < `${dateRange.from}T00:00:00`) return;
        if (dateRange.to && tx.created_at > `${dateRange.to}T23:59:59`) return;
        if (tx.player_id !== m.player_id) return;

        if (tx.type === "buy") drop += Number(tx.amount);
        else cashout += Number(tx.amount);
      });

      allExpenses.forEach(exp => {
        if (!exp.player_id || exp.player_id !== m.player_id) return;
        if (!exp.approved) return;
        if (exp.created_at < joinedAt) return;
        if (leftAt && exp.created_at > leftAt) return;
        if (dateRange.from && exp.created_at < `${dateRange.from}T00:00:00`) return;
        if (dateRange.to && exp.created_at > `${dateRange.to}T23:59:59`) return;
        expenses += Number(exp.amount);
      });
    });

    return { drop, cashout, expenses, result: cashout - drop, realResult: cashout - drop - expenses };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Player Groups</h1>
          <p className="text-sm text-muted-foreground">Analytical only · Does not affect transactions</p>
        </div>
        {isManager && (
          <Button onClick={() => setShowCreate(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> New Group</Button>
        )}
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <Input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-40 font-mono text-xs" />
        <span className="text-muted-foreground text-xs">to</span>
        <Input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-40 font-mono text-xs" />
        {(dateRange.from || dateRange.to) && (
          <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: "", to: "" })}>Clear</Button>
        )}
        {(dateRange.from || dateRange.to) && (
          <span className="text-xs text-primary font-medium ml-2">Period filter active</span>
        )}
      </div>

      <div className="space-y-4">
        {groups.map(group => {
          const allMembers = (group as any).group_members || [];
          const activeMembers = allMembers.filter((m: any) => !m.left_at);
          const stats = computeGroupStats(allMembers);

          return (
            <div key={group.id} className="cms-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">{group.name}</h3>
                  <span className="text-xs text-muted-foreground">({activeMembers.length} active)</span>
                </div>
                {isManager && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setAddingToGroup(group.id)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Member
                  </Button>
                )}
              </div>

              <div className="px-4 py-3 grid grid-cols-5 gap-3 border-b border-border">
                <div><p className="text-[10px] uppercase text-muted-foreground">Drop</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(stats.drop)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Cashout</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(stats.cashout)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Result</p>
                  <p className={`font-mono text-sm font-bold ${stats.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{formatCurrency(stats.result)}</p>
                </div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Expenses</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(stats.expenses)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Real Result</p>
                  <p className={`font-mono text-sm font-bold ${stats.realResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{formatCurrency(stats.realResult)}</p>
                </div>
              </div>

              <div className="px-4 py-2">
                {activeMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-card-foreground">{m.players?.first_name} {m.players?.last_name}</span>
                      <span className="text-[10px] text-muted-foreground">joined {fmtDate(m.joined_at)}</span>
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

      <Dialog open={!!addingToGroup} onOpenChange={() => setAddingToGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
            <SelectContent>
              {players.filter((p: any) => p.status === "active").map((p: any) => (
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
