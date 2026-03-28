import { useState, useMemo } from "react";
import { usePlayerGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember, usePlayers, usePlayerEconomy, useTransactions, useExpenses } from "@/hooks/use-casino-data";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, X, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const Groups = () => {
  const { isManager } = useAuth();
  const { data: groups = [] } = usePlayerGroups();
  const { data: players = [] } = usePlayers();
  const { data: economy = [] } = usePlayerEconomy();
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

  const getPlayerEconomy = (playerId: string) => economy.find(e => e.player_id === playerId);

  // Period-filtered analytics per group
  const getGroupPeriodAnalytics = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return null;

    const filteredTx = allTransactions.filter(tx => {
      if (dateRange.from && tx.created_at < `${dateRange.from}T00:00:00`) return false;
      if (dateRange.to && tx.created_at > `${dateRange.to}T23:59:59`) return false;
      return true;
    });

    const filteredExp = allExpenses.filter(exp => {
      if (dateRange.from && exp.created_at < `${dateRange.from}T00:00:00`) return false;
      if (dateRange.to && exp.created_at > `${dateRange.to}T23:59:59`) return false;
      return true;
    });

    return { transactions: filteredTx, expenses: filteredExp };
  }, [allTransactions, allExpenses, dateRange.from, dateRange.to]);

  const computeGroupStats = (memberPlayerIds: string[]) => {
    if (!getGroupPeriodAnalytics) {
      // Use all-time from economy view
      const drop = memberPlayerIds.reduce((s, pid) => s + Number(getPlayerEconomy(pid)?.total_drop || 0), 0);
      const cashout = memberPlayerIds.reduce((s, pid) => s + Number(getPlayerEconomy(pid)?.total_cashout || 0), 0);
      const expenses = memberPlayerIds.reduce((s, pid) => s + Number(getPlayerEconomy(pid)?.total_expenses || 0), 0);
      return { drop, cashout, expenses, result: cashout - drop - expenses };
    }

    const { transactions, expenses: filteredExp } = getGroupPeriodAnalytics;
    const pids = new Set(memberPlayerIds);
    const drop = transactions.filter(t => t.type === "buy" && pids.has(t.player_id)).reduce((s, t) => s + Number(t.amount), 0);
    const cashout = transactions.filter(t => t.type === "cashout" && pids.has(t.player_id)).reduce((s, t) => s + Number(t.amount), 0);
    const expenses = filteredExp.filter(e => e.player_id && pids.has(e.player_id) && e.approved).reduce((s, e) => s + Number(e.amount), 0);
    return { drop, cashout, expenses, result: cashout - drop - expenses };
  };

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
          const activeMembers = (group as any).group_members?.filter((m: any) => !m.left_at) || [];
          const memberPids = activeMembers.map((m: any) => m.player_id);
          const stats = computeGroupStats(memberPids);

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
                <div><p className="text-[10px] uppercase text-muted-foreground">Drop</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(stats.drop)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Cashout</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(stats.cashout)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Expenses</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(stats.expenses)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Result</p>
                  <p className={`font-mono text-sm font-bold ${stats.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {formatCurrency(stats.result)}
                  </p>
                </div>
              </div>

              <div className="px-4 py-2">
                {activeMembers.map((m: any) => {
                  const pe = getPlayerEconomy(m.player_id);
                  return (
                    <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-card-foreground">{m.players?.first_name} {m.players?.last_name}</span>
                        <span className="text-[10px] text-muted-foreground">joined {new Date(m.joined_at).toLocaleDateString("en-GB")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-muted-foreground">Drop: {formatCurrency(Number(pe?.total_drop || 0))}</span>
                        <span className={`font-mono text-[10px] ${Number(pe?.real_result || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          Result: {formatCurrency(Number(pe?.real_result || 0))}
                        </span>
                        {isManager && (
                          <button onClick={() => removeMember.mutate(m.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
