import { useState, useMemo, useEffect } from "react";
import { useDealers, useBreaklistData, useSetBreaklistCell, useLockBreaklistCell, useGamingTables, usePitRotaRange } from "@/hooks/use-casino-data";
import { useCasinoInfo } from "@/hooks/use-table-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { Lock, Unlock, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { ALL_ROLES, ROLE_COLORS, TABLE_ROLES } from "@/lib/currency";
import { getTableCellClasses } from "@/lib/table-colors";
import { isBusinessToday, isAfterBreaklistLock, nowEAT } from "@/lib/business-day";
const CATEGORY_LABELS: Record<string, string> = {
  trainee: "T",
  dealer: "D",
  inspector: "I",
  expert: "E",
  pit_boss: "P",
};

const CATEGORY_COLORS: Record<string, string> = {
  trainee: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  dealer: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  inspector: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  expert: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  pit_boss: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

interface BreaklistGridProps {
  date: string;
  zoom?: number;
  onRegisterRefresh?: (fn: () => void) => void;
  onRegisterAccept?: (fn: () => void) => void;
}

// 18:00 → 05:00, 20-minute intervals
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 18; h <= 28; h++) { // 28 = 04:xx next day
    for (let m = 0; m < 60; m += 20) {
      if (h === 29) break; // stop before 05:00
      const hour = h % 24;
      slots.push(`${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Get current active slot
const getCurrentSlot = () => {
  const now = nowEAT();
  const h = now.getHours();
  const m = Math.floor(now.getMinutes() / 20) * 20;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Check if a slot is within working hours (18-05)
const isInWorkingHours = (slot: string) => {
  const h = parseInt(slot.split(":")[0]);
  return h >= 18 || h < 5;
};

// Map a stored role to the per-table exclusivity slot.
const roleSlot = (r: string): "D" | "I" | "C" | null => {
  if (r === "P" || r === "BJ" || r === "AR") return "D";
  if (r === "Pi" || r === "BJi" || r === "ARi") return "I";
  if (r === "ARc") return "C";
  return null;
};

const BreaklistGrid = ({ date, zoom = 100, onRegisterRefresh, onRegisterAccept }: BreaklistGridProps) => {
  const { data: dealers = [] } = useDealers();
  const { data: breaklist = [] } = useBreaklistData(date);
  const { data: tables = [] } = useGamingTables();
  const { data: rota = [] } = usePitRotaRange(date, date);
  const { data: casino } = useCasinoInfo();
  const setCell = useSetBreaklistCell();
  const lockCell = useLockBreaklistCell();
  const { isManager } = useAuth();

  const activeDealers = dealers.filter(d => d.is_active);
  const openTables = tables.filter(t => t.status === "open");

  // Stable color index per table — based on alphabetical order of open tables.
  const tableColorIndex = useMemo(() => {
    const sorted = [...openTables].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, number>();
    sorted.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [openTables]);

  // Dealers scheduled in rota for this date (M or N only)
  const rotaDealers = useMemo(() => {
    return rota
      .filter((r: any) => r.shift === "M" || r.shift === "N" || r.shift === "E")
      .map((r: any) => ({ dealerId: r.dealer_id, shift: r.shift as string }));
  }, [rota]);

  // Only show dealers that are in the rota for this date
  const [sortBy, setSortBy] = useState<"name" | "shift">("shift");

  const breaklistDealers = useMemo(() => {
    const rotaDealerIds = new Set(rotaDealers.map(r => r.dealerId));
    // Pit Bosses must NOT appear in the Breaklist grid
    const filtered = activeDealers.filter(d => rotaDealerIds.has(d.id) && !(d as any).is_pit_boss);
    if (sortBy === "name") {
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    const shiftOrder: Record<string, number> = { M: 0, N: 1, E: 2 };
    return filtered.sort((a, b) => {
      const sa = rotaDealers.find(r => r.dealerId === a.id)?.shift || "Z";
      const sb = rotaDealers.find(r => r.dealerId === b.id)?.shift || "Z";
      const diff = (shiftOrder[sa] ?? 9) - (shiftOrder[sb] ?? 9);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [activeDealers, rotaDealers, sortBy]);

  const getDealerShift = (dealerId: string) => {
    return rotaDealers.find(r => r.dealerId === dealerId)?.shift || null;
  };

  const currentSlot = useMemo(() => getCurrentSlot(), []);
  const shiftEndHour = casino?.shift_end ? parseInt(casino.shift_end.split(":")[0]) : 5;
  const isToday = isBusinessToday(date, shiftEndHour);
  const pastLock = isToday && isAfterBreaklistLock(casino?.breaklist_lock || "05:30");
  // Editable if it's today AND not past lock time (or if manager)
  const isEditable = isToday && (!pastLock || isManager);

  // Inline role picker state
  const [activeCell, setActiveCell] = useState<{ dealerId: string; timeSlot: string } | null>(null);

  const getCellData = (dealerId: string, timeSlot: string) =>
    breaklist.find(b => b.dealer_id === dealerId && b.time_slot === timeSlot);

  const handleCellClick = (dealerId: string, timeSlot: string) => {
    if (!isEditable) return;
    const cell = getCellData(dealerId, timeSlot);
    if (cell?.is_locked && !isManager) {
      toast.error("Locked — manager access required");
      return;
    }
    // If manager, can edit locked cells directly (session-based access)
    setActiveCell({ dealerId, timeSlot });
  };

  const handleRoleSelect = (role: string, tableId?: string) => {
    if (!activeCell) return;

    // Per-table role exclusivity:
    //   - Dealer slot   (P / BJ / AR)
    //   - Inspector slot (Pi / BJi / ARi)
    //   - Croupier slot  (ARc, roulette only)
    // BR is manual — never auto-filled. Block conflicts with an error.
    const slot = roleSlot(role);
    if (tableId && slot) {
      const conflict = breaklist.find((b: any) => {
        if (b.time_slot !== activeCell.timeSlot) return false;
        if (b.table_id !== tableId) return false;
        if (b.dealer_id === activeCell.dealerId) return false;
        return roleSlot(b.role) === slot;
      });
      if (conflict) {
        const occupant = activeDealers.find(d => d.id === conflict.dealer_id)?.name || "another dealer";
        const table = openTables.find(t => t.id === tableId);
        const tableName = table?.name || "this table";
        toast.error(`${tableName} ${slot} already taken by ${occupant} at ${activeCell.timeSlot}`);
        return;
      }
    }

    setCell.mutate({
      date,
      dealer_id: activeCell.dealerId,
      time_slot: activeCell.timeSlot,
      role,
      table_id: tableId || null,
    });
    setActiveCell(null);
  };

  const handleToggleCellLock = (dealerId: string, timeSlot: string) => {
    const cell = getCellData(dealerId, timeSlot);
    if (!cell) return;
    lockCell.mutate({ id: cell.id, lock: !cell.is_locked });
  };

  const getLockedCount = (dealerId: string) =>
    breaklist.filter(b => b.dealer_id === dealerId && b.is_locked).length;

  const roleSuffix: Record<string, string> = {
    ARi: "i", ARc: "c", AR1i: "i", AR1c: "c",
    Pi: "i", BJi: "i",
  };

  // Parent controls (Refresh/Accept) are no longer auto-filling BR — disabled.
  useEffect(() => {
    onRegisterRefresh?.(() => {});
    onRegisterAccept?.(() => {});
  }, []);

  return (
    <>
      <div className="cms-panel overflow-auto" style={{ zoom: `${zoom}%` }}>
        <div className="min-w-[1400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-center text-[9px] font-medium text-muted-foreground uppercase px-1 py-2 min-w-[24px] sticky left-0 bg-card z-10">
                  C
                </th>
                <th
                  onClick={() => setSortBy("name")}
                  className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-[24px] bg-card z-10 min-w-[120px] cursor-pointer hover:text-foreground select-none"
                >
                  Name {sortBy === "name" && "↓"}
                </th>
                <th
                  onClick={() => setSortBy("shift")}
                  className="text-center text-[9px] font-medium text-muted-foreground uppercase px-1 py-2 min-w-[32px] cursor-pointer hover:text-foreground select-none"
                >
                  S {sortBy === "shift" && "↓"}
                </th>
                {TIME_SLOTS.map(slot => {
                  const isActive = isToday && slot === currentSlot;
                  const isHourStart = slot.endsWith(":00");
                  return (
                    <th
                      key={slot}
                      className={`text-center text-[9px] font-mono px-0.5 py-2 min-w-[52px] ${
                        isActive ? "bg-primary text-primary-foreground font-bold border-x-2 border-primary" : "text-muted-foreground"
                      } ${isHourStart && !isActive ? "border-l-2 border-foreground/25" : ""}`}
                    >
                      {slot}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {breaklistDealers.map((dealer, idx) => {
                const lockedCount = getLockedCount(dealer.id);
                const shift = getDealerShift(dealer.id);
                return (
                  <tr key={dealer.id} className={`border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                    <td className={`text-center py-1 sticky left-0 z-10 ${idx % 2 === 1 ? "bg-card/95" : "bg-card"}`}>
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-mono font-bold ${CATEGORY_COLORS[dealer.category] || "text-muted-foreground"}`}>
                        {CATEGORY_LABELS[dealer.category] || "?"}
                      </span>
                    </td>
                    <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-[24px] z-10 ${idx % 2 === 1 ? "bg-card/95" : "bg-card"}`}>
                      <div className="flex items-center justify-between">
                        <span>{dealer.name}</span>
                        {lockedCount > 0 && (
                          <span className="text-[9px] text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
                            <LockKeyhole className="w-2.5 h-2.5" />{lockedCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`text-center py-1 ${idx % 2 === 1 ? "bg-card/95" : "bg-card"}`}>
                      {shift && (
                         <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          shift === "M" ? "bg-teal-100 text-teal-800 dark:bg-teal-500/25 dark:text-teal-300" : shift === "N" ? "bg-sky-100 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300"
                        }`}>{shift}</span>
                      )}
                    </td>
                    {TIME_SLOTS.map(slot => {
                      const cell = getCellData(dealer.id, slot);
                      const table = cell?.table_id ? openTables.find(t => t.id === cell.table_id) : null;
                      const tableName = table?.name ?? null;
                      const displayLabel = cell
                        ? tableName
                          ? `${tableName}${roleSuffix[cell.role] || ""}`
                          : cell.role
                        : "·";
                      const isActiveCell = activeCell?.dealerId === dealer.id && activeCell?.timeSlot === slot;
                      const isCurrentCol = isToday && slot === currentSlot;
                      const isHourStart = slot.endsWith(":00");
                      return (
                        <td key={slot} className={`px-0.5 py-0.5 text-center relative group ${isCurrentCol ? "bg-primary/15 border-x-2 border-primary" : isHourStart ? "border-l-2 border-foreground/25" : ""}`}>
                          <div
                            onClick={() => isEditable && handleCellClick(dealer.id, slot)}
                            className={`w-full h-7 rounded text-[13px] font-mono font-extrabold relative transition-colors cursor-pointer flex items-center justify-center ${
                              cell
                                ? cell.table_id && tableColorIndex.has(cell.table_id)
                                  ? getTableCellClasses(cell.table_id, tableColorIndex.get(cell.table_id)!, cell.role)
                                  : ROLE_COLORS[cell.role] || "bg-muted text-muted-foreground"
                                : isEditable ? "bg-transparent hover:bg-muted/50 text-transparent hover:text-muted-foreground" : "bg-transparent text-transparent"
                            } ${cell?.is_locked ? "ring-1 ring-yellow-500/40" : ""} ${isActiveCell ? "ring-2 ring-primary" : ""} ${!isEditable ? "cursor-default" : ""}`}
                            title={tableName ? `${cell?.role} @ ${tableName}` : cell?.role}
                          >
                            {displayLabel}
                            {cell?.is_locked && <Lock className="w-2 h-2 absolute top-0.5 right-0.5 text-yellow-600 dark:text-yellow-400" />}
                          </div>
                          {/* Per-cell lock toggle for managers */}
                          {isEditable && isManager && cell && !isActiveCell && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleCellLock(dealer.id, slot); }}
                              className="absolute bottom-0.5 right-0.5 p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-600 dark:hover:text-yellow-400 transition-opacity z-10"
                              title={cell.is_locked ? "Unlock cell" : "Lock cell"}
                            >
                              {cell.is_locked ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                            </button>
                          )}
                          {/* Inline role picker dropdown */}
                          {isActiveCell && (
                            <div className="absolute z-50 top-8 left-0 bg-popover border border-border rounded-md shadow-lg p-1 min-w-[100px]"
                              onMouseLeave={() => setActiveCell(null)}>
                              <div className="flex flex-wrap gap-0.5 mb-1">
                                <button onClick={() => handleRoleSelect("BR")}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${ROLE_COLORS["BR"] || "bg-muted text-muted-foreground"} hover:opacity-80`}>
                                  BR
                                </button>
                              </div>
                              {openTables.length > 0 && (
                                <div className="border-t border-border pt-1 space-y-0.5">
                                  <p className="text-[8px] text-muted-foreground uppercase px-1">Assign to table</p>
                                  {openTables.map(t => {
                                    const roles = TABLE_ROLES[t.game] || [];
                                    const rSuffix: Record<string, string> = {
                                      ARi: "i", ARc: "c", AR1i: "i", AR1c: "c",
                                      Pi: "i", BJi: "i",
                                    };
                                    // Slots already taken on this table for this time slot (by other dealers)
                                    const takenSlots = new Set(
                                      breaklist
                                        .filter((b: any) =>
                                          b.table_id === t.id &&
                                          b.time_slot === activeCell!.timeSlot &&
                                          b.dealer_id !== activeCell!.dealerId,
                                        )
                                        .map((b: any) => roleSlot(b.role))
                                        .filter(Boolean),
                                    );
                                    const availableRoles = roles.filter(r => {
                                      const s = roleSlot(r);
                                      return !s || !takenSlots.has(s);
                                    });
                                    if (availableRoles.length === 0) return null;
                                    return (
                                      <div key={t.id} className="flex items-center gap-0.5 px-1">
                                        <span className="text-[9px] font-mono text-card-foreground min-w-[28px]">{t.name}</span>
                                        {availableRoles.map(r => (
                                          <button key={r} onClick={() => handleRoleSelect(r, t.id)}
                                            className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold ${ROLE_COLORS[r] || ""} hover:opacity-80`}>
                                            {t.name}{rSuffix[r] || ""}
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

    </>
  );
};

export default BreaklistGrid;
