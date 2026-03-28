import { useState, useCallback } from "react";
import { useGamingTables, useTableTracker, useSetTableTrackerValue } from "@/hooks/use-casino-data";
import { Input } from "@/components/ui/input";

// Time slots: every 30 min from 14:00 to 06:00
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

  const handleChange = (tableId: string, slot: string, val: string) => {
    const numVal = Number(val);
    if (isNaN(numVal)) return;
    setValue.mutate({ table_id: tableId, date, time_slot: slot, value: numVal });
  };

  const getTableTotal = (tableId: string) =>
    trackerData.filter(t => t.table_id === tableId).reduce((s, t) => s + Number(t.value), 0);

  const getSlotTotal = (slot: string) =>
    trackerData.filter(t => t.time_slot === slot).reduce((s, t) => s + Number(t.value), 0);

  const grandTotal = trackerData.reduce((s, t) => s + Number(t.value), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Table Tracker</h1>
          <p className="text-sm text-muted-foreground">30/60 min interval recording · Auto totals</p>
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
              {openTables.map(table => (
                <tr key={table.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 bg-card z-10">{table.name}</td>
                  {SLOTS.map(slot => {
                    const val = getVal(table.id, slot);
                    return (
                      <td key={slot} className="px-0.5 py-0.5">
                        <input
                          type="number"
                          defaultValue={val ?? ""}
                          onBlur={e => handleChange(table.id, slot, e.target.value)}
                          className="w-full h-7 text-center text-xs font-mono bg-transparent border border-border rounded px-1 focus:border-primary focus:outline-none text-card-foreground"
                          placeholder="·"
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1 text-right font-mono text-xs font-bold text-card-foreground">
                    €{getTableTotal(table.id).toLocaleString()}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="border-t-2 border-primary/30 bg-muted/30">
                <td className="px-3 py-2 text-xs font-bold text-card-foreground uppercase sticky left-0 bg-muted/30 z-10">Totals</td>
                {SLOTS.map(slot => (
                  <td key={slot} className="px-1 py-2 text-center font-mono text-[10px] font-bold text-card-foreground">
                    {getSlotTotal(slot) ? `€${getSlotTotal(slot).toLocaleString()}` : "·"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-sm font-bold text-primary">
                  €{grandTotal.toLocaleString()}
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
