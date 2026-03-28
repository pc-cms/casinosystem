import { useState } from "react";
import { useDealers, useCreateDealer, usePitRota, useSetPitRota } from "@/hooks/use-casino-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";
import BreaklistGrid from "@/components/pit/BreaklistGrid";

const SHIFTS = ["M", "N", "A", "S", "E"] as const;

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
