import { useState } from "react";
import { useDealers, useCreateDealer, usePitRota, useSetPitRota, useBreaklistData, useSetBreaklistCell, useLockBreaklistCell, useGamingTables } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Lock, Unlock, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const SHIFTS = ["M", "N", "A", "S", "E"] as const;
const ROLES = ["BJ", "BJi", "AR1", "AR1i", "AR1c", "BR"] as const;

// Generate time slots: 20-min intervals from 14:00 to 06:00
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

const Pit = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pit System</h1>
          <p className="text-sm text-muted-foreground">Rota & Breaklist management</p>
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
      </div>

      <Tabs defaultValue="rota" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="breaklist">Breaklist</TabsTrigger>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
        </TabsList>

        <TabsContent value="rota"><RotaGrid date={date} /></TabsContent>
        <TabsContent value="breaklist"><BreaklistGrid date={date} /></TabsContent>
        <TabsContent value="dealers"><DealersList /></TabsContent>
      </Tabs>
    </div>
  );
};

const RotaGrid = ({ date }: { date: string }) => {
  const { data: dealers = [] } = useDealers();
  const { data: rota = [] } = usePitRota(date);
  const setRota = useSetPitRota();

  const activeDealers = dealers.filter(d => d.is_active);

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Dealer</th>
            {SHIFTS.map(s => (
              <th key={s} className="text-center text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-20">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeDealers.length === 0 ? (
            <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No dealers — add dealers first</td></tr>
          ) : activeDealers.map(dealer => {
            const dealerRota = rota.find(r => r.dealer_id === dealer.id);
            return (
              <tr key={dealer.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-sm font-medium text-card-foreground">{dealer.name}</td>
                {SHIFTS.map(shift => {
                  const isActive = dealerRota?.shift === shift;
                  return (
                    <td key={shift} className="px-2 py-2 text-center">
                      <button
                        onClick={() => setRota.mutate({ dealer_id: dealer.id, date, shift })}
                        className={`w-10 h-8 rounded text-xs font-mono font-bold transition-colors ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20"
                        }`}
                      >
                        {shift}
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
  );
};

const BreaklistGrid = ({ date }: { date: string }) => {
  const { data: dealers = [] } = useDealers();
  const { data: breaklist = [] } = useBreaklistData(date);
  const { data: tables = [] } = useGamingTables();
  const setCell = useSetBreaklistCell();
  const lockCell = useLockBreaklistCell();
  const { isManager } = useAuth();

  const activeDealers = dealers.filter(d => d.is_active);
  const displaySlots = TIME_SLOTS.slice(0, 24); // Show first 8 hours (24 slots)

  const [editingCell, setEditingCell] = useState<{ dealerId: string; timeSlot: string } | null>(null);
  const [editRole, setEditRole] = useState<string>("BR");
  const [editTable, setEditTable] = useState<string>("");

  const getCellData = (dealerId: string, timeSlot: string) =>
    breaklist.find(b => b.dealer_id === dealerId && b.time_slot === timeSlot);

  const handleCellClick = (dealerId: string, timeSlot: string) => {
    const cell = getCellData(dealerId, timeSlot);
    if (cell?.is_locked && !isManager) return;
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
      table_id: editTable || null,
    });
    setEditingCell(null);
  };

  const roleColors: Record<string, string> = {
    BJ: "bg-blue-600/20 text-blue-400", BJi: "bg-blue-500/15 text-blue-300",
    AR1: "bg-emerald-600/20 text-emerald-400", AR1i: "bg-emerald-500/15 text-emerald-300",
    AR1c: "bg-emerald-400/15 text-emerald-200", BR: "bg-muted text-muted-foreground",
  };

  return (
    <>
      <div className="cms-panel overflow-x-auto">
        <div className="min-w-[1200px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-0 bg-card z-10 min-w-[120px]">Dealer</th>
                {displaySlots.map(slot => (
                  <th key={slot} className="text-center text-[10px] font-mono text-muted-foreground px-1 py-2 min-w-[60px]">{slot}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDealers.map(dealer => (
                <tr key={dealer.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 bg-card z-10">{dealer.name}</td>
                  {displaySlots.map(slot => {
                    const cell = getCellData(dealer.id, slot);
                    return (
                      <td key={slot} className="px-0.5 py-0.5 text-center">
                        <button
                          onClick={() => handleCellClick(dealer.id, slot)}
                          className={`w-full h-7 rounded text-[9px] font-mono font-bold relative transition-colors ${
                            cell ? roleColors[cell.role] || "bg-muted text-muted-foreground" : "bg-transparent hover:bg-muted/50 text-transparent hover:text-muted-foreground"
                          }`}
                        >
                          {cell?.role || "·"}
                          {cell?.is_locked && <Lock className="w-2 h-2 absolute top-0.5 right-0.5 text-warning" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editingCell} onOpenChange={() => setEditingCell(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {activeDealers.find(d => d.id === editingCell?.dealerId)?.name} @ {editingCell?.timeSlot}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Role</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Table</label>
              <Select value={editTable} onValueChange={setEditTable}>
                <SelectTrigger><SelectValue placeholder="No table" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No table</SelectItem>
                  {tables.filter(t => t.status === "open").map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isManager && editingCell && getCellData(editingCell.dealerId, editingCell.timeSlot) && (
              <Button variant="outline" size="sm" className="mr-auto"
                onClick={() => {
                  const cell = getCellData(editingCell.dealerId, editingCell.timeSlot);
                  if (cell) lockCell.mutate({ id: cell.id, lock: !cell.is_locked });
                  setEditingCell(null);
                }}>
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
    </>
  );
};

const DealersList = () => {
  const { data: dealers = [] } = useDealers();
  const createDealer = useCreateDealer();
  const [name, setName] = useState("");

  return (
    <div className="max-w-md space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Dealer name" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && name) { createDealer.mutate(name); setName(""); } }} />
        <Button onClick={() => { if (name) { createDealer.mutate(name); setName(""); } }} disabled={!name}>
          <UserPlus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      <div className="cms-panel">
        {dealers.map(d => (
          <div key={d.id} className="flex items-center justify-between px-4 py-2 border-b border-border last:border-0">
            <span className="text-sm text-card-foreground">{d.name}</span>
            <span className={`text-xs ${d.is_active ? "cms-status-active" : "cms-status-blacklist"}`}>
              {d.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
        {dealers.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No dealers</p>}
      </div>
    </div>
  );
};

export default Pit;
