import { useState, useMemo } from "react";
import { useDealers, useBreaklistData, useSetBreaklistCell, useLockBreaklistCell, useGamingTables } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, LockKeyhole, Check } from "lucide-react";
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

  // Inline role picker state — no dialog
  const [activeCell, setActiveCell] = useState<{ dealerId: string; timeSlot: string } | null>(null);

  // Manager override
  const [overrideAction, setOverrideAction] = useState<(() => void) | null>(null);
  const [overrideTitle, setOverrideTitle] = useState("");
  const [overrideDesc, setOverrideDesc] = useState("");

  // Build roles for a given table
  const getRolesForTable = (tableId: string | null) => {
    if (!tableId) return [...ALL_ROLES];
    const t = openTables.find(t => t.id === tableId);
    if (!t) return [...ALL_ROLES];
    return [...(TABLE_ROLES[t.game] || []), "BR"];
  };

  const getCellData = (dealerId: string, timeSlot: string) =>
    breaklist.find(b => b.dealer_id === dealerId && b.time_slot === timeSlot);

  const handleCellClick = (dealerId: string, timeSlot: string) => {
    const cell = getCellData(dealerId, timeSlot);
    if (cell?.is_locked && !isManager) {
      toast.error("Locked — manager override required");
      return;
    }
    if (cell?.is_locked && isManager) {
      setOverrideTitle("Edit Locked Cell");
      setOverrideDesc("Cell is locked. Authenticate to override.");
      setOverrideAction(() => () => setActiveCell({ dealerId, timeSlot }));
      return;
    }
    setActiveCell({ dealerId, timeSlot });
  };

  const handleRoleSelect = (role: string, tableId?: string) => {
    if (!activeCell) return;
    setCell.mutate({
      date,
      dealer_id: activeCell.dealerId,
      time_slot: activeCell.timeSlot,
      role,
      table_id: tableId || null,
    });
    setActiveCell(null);
  };

  // Accept button — fill all empty slots with BR
  const handleAccept = () => {
    activeDealers.forEach(dealer => {
      displaySlots.forEach(slot => {
        const existing = getCellData(dealer.id, slot);
        if (!existing) {
          setCell.mutate({ date, dealer_id: dealer.id, time_slot: slot, role: "BR", table_id: null });
        }
      });
    });
    toast.success("Empty slots filled with BR");
  };

  const handleLockRow = (dealerId: string, lock: boolean) => {
    const cells = breaklist.filter(b => b.dealer_id === dealerId);
    if (cells.length === 0) { toast.error("No cells to lock"); return; }
    setOverrideTitle(lock ? "Lock Row" : "Unlock Row");
    setOverrideDesc(`${lock ? "Lock" : "Unlock"} all ${cells.length} cells. Authenticate.`);
    setOverrideAction(() => () => cells.forEach(c => lockCell.mutate({ id: c.id, lock })));
  };

  const getLockedCount = (dealerId: string) =>
    breaklist.filter(b => b.dealer_id === dealerId && b.is_locked).length;

  return (
    <>
      {/* Accept button */}
      <div className="flex items-center justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" onClick={handleAccept} className="gap-1 text-xs">
          <Check className="w-3.5 h-3.5" /> Accept (fill BR)
        </Button>
      </div>

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
                            <button onClick={() => handleLockRow(dealer.id, lockedCount === 0)}
                              className="text-muted-foreground hover:text-primary ml-1"
                              title={lockedCount > 0 ? "Unlock all" : "Lock all"}>
                              {lockedCount > 0 ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    {displaySlots.map(slot => {
                      const cell = getCellData(dealer.id, slot);
                      const table = cell?.table_id ? openTables.find(t => t.id === cell.table_id) : null;
                      const tableName = table?.name ?? null;
                      // Build display label with role suffix: AR2I (inspector), AR2C (chipper), P1I, BJ1I
                      const roleSuffix: Record<string, string> = {
                        ARi: "I", ARc: "C", AR1i: "I", AR1c: "C",
                        Pi: "I", BJi: "I",
                      };
                      const displayLabel = cell
                        ? tableName
                          ? `${tableName}${roleSuffix[cell.role] || ""}`
                          : cell.role
                        : "·";
                      const isActive = activeCell?.dealerId === dealer.id && activeCell?.timeSlot === slot;
                      return (
                        <td key={slot} className="px-0.5 py-0.5 text-center relative">
                          <button
                            onClick={() => handleCellClick(dealer.id, slot)}
                            className={`w-full h-7 rounded text-[9px] font-mono font-bold relative transition-colors ${
                              cell ? ROLE_COLORS[cell.role] || "bg-muted text-muted-foreground" : "bg-transparent hover:bg-muted/50 text-transparent hover:text-muted-foreground"
                            } ${cell?.is_locked ? "ring-1 ring-yellow-500/40" : ""} ${isActive ? "ring-2 ring-primary" : ""}`}
                            title={tableName ? `${cell?.role} @ ${tableName}` : cell?.role}
                          >
                            {displayLabel}
                            {cell?.is_locked && <Lock className="w-2 h-2 absolute top-0.5 right-0.5 text-yellow-400" />}
                          </button>
                          {/* Inline role picker dropdown */}
                          {isActive && (
                            <div className="absolute z-50 top-8 left-0 bg-popover border border-border rounded-md shadow-lg p-1 min-w-[100px]"
                              onMouseLeave={() => setActiveCell(null)}>
                              {/* Quick roles */}
                              <div className="flex flex-wrap gap-0.5 mb-1">
                                {ALL_ROLES.map(r => (
                                  <button key={r} onClick={() => handleRoleSelect(r)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${ROLE_COLORS[r] || "bg-muted text-muted-foreground"} hover:opacity-80`}>
                                    {r}
                                  </button>
                                ))}
                              </div>
                              {/* Table assignment */}
                              {openTables.length > 0 && (
                                <div className="border-t border-border pt-1 space-y-0.5">
                                  <p className="text-[8px] text-muted-foreground uppercase px-1">Assign to table</p>
                                  {openTables.map(t => {
                                    const roles = TABLE_ROLES[t.game] || [];
                                    const roleSuffixMap: Record<string, string> = {
                                      ARi: "I", ARc: "C", AR1i: "I", AR1c: "C",
                                      Pi: "I", BJi: "I",
                                    };
                                    return (
                                      <div key={t.id} className="flex items-center gap-0.5 px-1">
                                        <span className="text-[9px] font-mono text-card-foreground min-w-[28px]">{t.name}</span>
                                        {roles.map(r => (
                                          <button key={r} onClick={() => handleRoleSelect(r, t.id)}
                                            className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold ${ROLE_COLORS[r] || ""} hover:opacity-80`}>
                                            {t.name}{roleSuffixMap[r] || ""}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
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

      <ManagerOverrideDialog
        open={!!overrideAction}
        onClose={() => setOverrideAction(null)}
        onConfirm={(managerId) => { overrideAction?.(); setOverrideAction(null); }}
        title={overrideTitle}
        description={overrideDesc}
        actionType="BREAKLIST_OVERRIDE"
        actionDetails={{ date, action: overrideTitle }}
      />
    </>
  );
};

export default BreaklistGrid;
