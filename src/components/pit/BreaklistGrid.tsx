import { useState, useMemo } from "react";
import { useDealers, useBreaklistData, useSetBreaklistCell, useLockBreaklistCell, useGamingTables } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Unlock, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { toast } from "sonner";
import { ALL_ROLES, ROLE_COLORS, TABLE_ROLES } from "@/lib/currency";

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 14; h <= 29; h++) {
    for (let m = 0; m < 60; m += 20) {
      const hour = h % 24;
      slots.push(`${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const BreaklistGrid = ({ date }: { date: string }) => {
  const { data: dealers = [] } = useDealers();
  const { data: breaklist = [] } = useBreaklistData(date);
  const { data: tables = [] } = useGamingTables();
  const setCell = useSetBreaklistCell();
  const lockCell = useLockBreaklistCell();
  const { isManager } = useAuth();

  const activeDealers = dealers.filter(d => d.is_active);
  const openTables = tables.filter(t => t.status === "open");
  const displaySlots = TIME_SLOTS.slice(0, 24);

  const [editingCell, setEditingCell] = useState<{ dealerId: string; timeSlot: string } | null>(null);
  const [editRole, setEditRole] = useState<string>("BR");
  const [editTable, setEditTable] = useState<string>("");

  // Manager override state
  const [overrideAction, setOverrideAction] = useState<(() => void) | null>(null);
  const [overrideTitle, setOverrideTitle] = useState("");
  const [overrideDesc, setOverrideDesc] = useState("");

  // Build available roles based on selected table
  const availableRoles = useMemo(() => {
    if (!editTable || editTable === "none") return [...ALL_ROLES];
    const selectedTable = openTables.find(t => t.id === editTable);
    if (!selectedTable) return [...ALL_ROLES];
    const gameRoles = TABLE_ROLES[selectedTable.game] || [];
    return [...gameRoles, "BR"];
  }, [editTable, openTables]);

  const getCellData = (dealerId: string, timeSlot: string) =>
    breaklist.find(b => b.dealer_id === dealerId && b.time_slot === timeSlot);

  const handleCellClick = (dealerId: string, timeSlot: string) => {
    const cell = getCellData(dealerId, timeSlot);
    if (cell?.is_locked && !isManager) {
      toast.error("Cell is locked. Manager override required.");
      return;
    }
    if (cell?.is_locked && isManager) {
      setOverrideTitle("Edit Locked Cell");
      setOverrideDesc("This cell is locked. Authenticate to override and edit.");
      setOverrideAction(() => () => {
        setEditingCell({ dealerId, timeSlot });
        setEditRole(cell?.role || "BR");
        setEditTable(cell?.table_id || "");
      });
      return;
    }
    setEditingCell({ dealerId, timeSlot });
    setEditRole(cell?.role || "BR");
    setEditTable(cell?.table_id || "");
  };

  const handleSave = () => {
    if (!editingCell) return;
    setCell.mutate({
      date,
      dealer_id: editingCell.dealerId,
      time_slot: editingCell.timeSlot,
      role: editRole,
      table_id: editTable && editTable !== "none" ? editTable : null,
    });
    setEditingCell(null);
  };

  const handleLockRow = (dealerId: string, lock: boolean) => {
    const dealerCells = breaklist.filter(b => b.dealer_id === dealerId);
    if (dealerCells.length === 0) {
      toast.error("No cells to lock for this dealer");
      return;
    }
    setOverrideTitle(lock ? "Lock Entire Row" : "Unlock Entire Row");
    setOverrideDesc(`This will ${lock ? "lock" : "unlock"} all ${dealerCells.length} cells for this dealer. Authenticate to confirm.`);
    setOverrideAction(() => () => {
      dealerCells.forEach(cell => {
        lockCell.mutate({ id: cell.id, lock });
      });
    });
  };

  const handleToggleLock = () => {
    if (!editingCell) return;
    const cell = getCellData(editingCell.dealerId, editingCell.timeSlot);
    if (!cell) return;
    setOverrideTitle(cell.is_locked ? "Unlock Cell" : "Lock Cell");
    setOverrideDesc("Manager authentication required to change lock status.");
    setOverrideAction(() => () => {
      lockCell.mutate({ id: cell.id, lock: !cell.is_locked });
      setEditingCell(null);
    });
  };

  const getLockedCount = (dealerId: string) =>
    breaklist.filter(b => b.dealer_id === dealerId && b.is_locked).length;

  return (
    <>
      <div className="cms-panel overflow-x-auto">
        <div className="min-w-[1200px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-0 bg-card z-10 min-w-[140px]">Dealer</th>
                {displaySlots.map(slot => (
                  <th key={slot} className="text-center text-[10px] font-mono text-muted-foreground px-1 py-2 min-w-[60px]">{slot}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDealers.map(dealer => {
                const lockedCount = getLockedCount(dealer.id);
                return (
                  <tr key={dealer.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 bg-card z-10">
                      <div className="flex items-center justify-between">
                        <span>{dealer.name}</span>
                        <div className="flex items-center gap-1">
                          {lockedCount > 0 && (
                            <span className="text-[9px] text-yellow-400 flex items-center gap-0.5">
                              <LockKeyhole className="w-2.5 h-2.5" />{lockedCount}
                            </span>
                          )}
                          {isManager && (
                            <button
                              onClick={() => handleLockRow(dealer.id, lockedCount === 0)}
                              className="text-muted-foreground hover:text-primary ml-1"
                              title={lockedCount > 0 ? "Unlock all" : "Lock all"}
                            >
                              {lockedCount > 0 ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    {displaySlots.map(slot => {
                      const cell = getCellData(dealer.id, slot);
                      const tableName = cell?.table_id ? openTables.find(t => t.id === cell.table_id)?.name : null;
                      return (
                        <td key={slot} className="px-0.5 py-0.5 text-center">
                          <button
                            onClick={() => handleCellClick(dealer.id, slot)}
                            className={`w-full h-7 rounded text-[9px] font-mono font-bold relative transition-colors ${
                              cell ? ROLE_COLORS[cell.role] || "bg-muted text-muted-foreground" : "bg-transparent hover:bg-muted/50 text-transparent hover:text-muted-foreground"
                            } ${cell?.is_locked ? "ring-1 ring-yellow-500/40" : ""}`}
                            title={tableName ? `${cell?.role} @ ${tableName}` : cell?.role}
                          >
                            {cell ? (tableName ? `${tableName}` : cell.role) : "·"}
                            {cell?.is_locked && <Lock className="w-2 h-2 absolute top-0.5 right-0.5 text-yellow-400" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Cell Dialog */}
      <Dialog open={!!editingCell} onOpenChange={() => setEditingCell(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {activeDealers.find(d => d.id === editingCell?.dealerId)?.name} @ {editingCell?.timeSlot}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Table</label>
              <Select value={editTable} onValueChange={(v) => { setEditTable(v); setEditRole("BR"); }}>
                <SelectTrigger><SelectValue placeholder="No table" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No table (BR)</SelectItem>
                  {openTables.map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {t.game}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Role</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map(r => (
                    <SelectItem key={r} value={r}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${ROLE_COLORS[r] || ""}`}>{r}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isManager && editingCell && getCellData(editingCell.dealerId, editingCell.timeSlot) && (
              <Button variant="outline" size="sm" className="mr-auto" onClick={handleToggleLock}>
                {getCellData(editingCell.dealerId, editingCell.timeSlot)?.is_locked
                  ? <><Unlock className="w-3 h-3 mr-1" /> Unlock</>
                  : <><Lock className="w-3 h-3 mr-1" /> Lock</>}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditingCell(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Override Dialog */}
      <ManagerOverrideDialog
        open={!!overrideAction}
        onClose={() => setOverrideAction(null)}
        onConfirm={() => {
          overrideAction?.();
          setOverrideAction(null);
        }}
        title={overrideTitle}
        description={overrideDesc}
      />
    </>
  );
};

export default BreaklistGrid;
