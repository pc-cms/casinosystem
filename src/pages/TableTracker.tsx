import { useState, useCallback, useRef } from "react";
import { useGamingTables, useTableTracker, useSetTableTrackerValue } from "@/hooks/use-casino-data";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";

const generateSlots = () => {
  const slots: string[] = [];
  for (let h = 14; h <= 29; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
};

const SLOTS = generateSlots();

const TableTracker = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const { data: tables = [] } = useGamingTables();
  const { data: trackerData = [] } = useTableTracker(date);
  const setValue = useSetTableTrackerValue();

  const openTables = tables.filter(t => t.status === "open");

  const getVal = useCallback((tableId: string, slot: string) => {
    const entry = trackerData.find(t => t.table_id === tableId && t.time_slot === slot);
    return entry ? Number(entry.value) : null;
  }, [trackerData]);

  // Save on blur or Enter — no save button
  const handleSave = (tableId: string, slot: string, val: string) => {
    const numVal = Number(val);
    if (isNaN(numVal)) return;
    const current = getVal(tableId, slot);
    if (current === numVal) return; // skip if unchanged
    setValue.mutate({ table_id: tableId, date, time_slot: slot, value: numVal });
  };

  const getTableTotal = (tableId: string) =>
    trackerData.filter(t => t.table_id === tableId).reduce((s, t) => s + Number(t.value), 0);

  const getSlotTotal = (slot: string) =>
    trackerData.filter(t => t.time_slot === slot).reduce((s, t) => s + Number(t.value), 0);

  const grandTotal = trackerData.reduce((s, t) => s + Number(t.value), 0);

  // Tab/Enter navigation between cells
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, tableIdx: number, slotIdx: number) => {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      (e.target as HTMLInputElement).blur(); // triggers save
      // Focus next cell
      const nextSlot = slotIdx + 1;
      const nextTable = tableIdx + 1;
      let nextId: string;
      if (nextSlot < SLOTS.length) {
        nextId = `cell-${tableIdx}-${nextSlot}`;
      } else if (nextTable < openTables.length) {
        nextId = `cell-${nextTable}-0`;
      } else return;
      setTimeout(() => document.getElementById(nextId)?.focus(), 10);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Table Tracker</h1>
          <p className="text-xs text-muted-foreground">Enter values · auto-saves on blur/Enter</p>
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
      </div>

      <div className="cms-panel overflow-x-auto">
        <div className="min-w-[1000px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-0 bg-card z-10 min-w-[100px]">Table</th>
                {SLOTS.map(slot => (
                  <th key={slot} className="text-center text-[10px] font-mono text-muted-foreground px-1 py-2 min-w-[70px]">{slot}</th>
                ))}
                <th className="text-right text-xs font-medium text-muted-foreground uppercase px-3 py-2 min-w-[80px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {openTables.map((table, ti) => (
                <tr key={table.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 bg-card z-10">{table.name}</td>
                  {SLOTS.map((slot, si) => {
                    const val = getVal(table.id, slot);
                    return (
                      <td key={slot} className="px-0.5 py-0.5">
                        <input
                          id={`cell-${ti}-${si}`}
                          type="number"
                          defaultValue={val ?? ""}
                          key={`${table.id}-${slot}-${val}`}
                          onBlur={e => handleSave(table.id, slot, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, ti, si)}
                          className="w-full h-7 text-center text-xs font-mono bg-transparent border border-border rounded px-1 focus:border-primary focus:outline-none text-card-foreground"
                          placeholder="·"
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1 text-right font-mono text-xs font-bold text-card-foreground">
                    {formatCurrency(getTableTotal(table.id))}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary/30 bg-muted/30">
                <td className="px-3 py-2 text-xs font-bold text-card-foreground uppercase sticky left-0 bg-muted/30 z-10">Totals</td>
                {SLOTS.map(slot => (
                  <td key={slot} className="px-1 py-2 text-center font-mono text-[10px] font-bold text-card-foreground">
                    {getSlotTotal(slot) ? formatCurrency(getSlotTotal(slot)) : "·"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-sm font-bold text-primary">
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {openTables.length === 0 && <p className="text-muted-foreground text-sm text-center py-8 mt-4">No open tables to track</p>}
    </div>
  );
};

export default TableTracker;
