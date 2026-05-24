/**
 * CCTV Dashboard summary section.
 *
 * Visible only to roles `surveillance` and `super_admin`.
 * Aggregates 3 read-only blocks:
 *   1. Latest incidents within the current business-day window (11:00→11:00 EAT)
 *      with quick shift-time filter (M / E / N / L) over `incident_time`.
 *   2. Live tables grid — open tables with current dealer + #seats taken.
 *   3. Active players in casino + Blacklist alerts (status === 'blacklist').
 *
 * No mutations. No financial figures. Pure surveillance overview.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, AlertTriangle, Users, Layers, Clock } from "lucide-react";
import { useIncidents } from "@/hooks/use-incidents";
import { useVisitsToday, useGamingTables } from "@/hooks/use-casino-data";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { getBusinessDate } from "@/lib/business-day";
import { fmtDateOnly } from "@/lib/format-date";
import { Button } from "@/components/ui/button";

type ShiftKey = "all" | "M" | "E" | "N" | "L";

// Shift time windows in EAT (24h). Used purely for filtering incident_time.
const SHIFT_WINDOWS: Record<Exclude<ShiftKey, "all">, { from: number; to: number; label: string }> = {
  M: { from: 6,  to: 14, label: "Morning 06–14" },
  E: { from: 14, to: 22, label: "Evening 14–22" },
  N: { from: 22, to: 30, label: "Night 22–06" }, // wraps past midnight
  L: { from: 2,  to: 6,  label: "Late 02–06" },
};

const SHIFT_BTNS: Array<{ id: ShiftKey; label: string }> = [
  { id: "all", label: "All" },
  { id: "M", label: "M" },
  { id: "E", label: "E" },
  { id: "N", label: "N" },
  { id: "L", label: "L" },
];

const inShift = (timeStr: string, shift: Exclude<ShiftKey, "all">): boolean => {
  const [hh] = timeStr.split(":").map(Number);
  const w = SHIFT_WINDOWS[shift];
  if (w.to > 24) {
    // wraps midnight — accept hh >= from OR hh < (to-24)
    return hh >= w.from || hh < w.to - 24;
  }
  return hh >= w.from && hh < w.to;
};

export const CCTVDashboardSection = () => {
  const { data: serverDate } = useEffectiveBusinessDate();
  const businessDate = serverDate || getBusinessDate();

  const { data: incidents = [] } = useIncidents(null, businessDate);
  const { data: visits = [] } = useVisitsToday();
  const { data: tables = [] } = useGamingTables();

  const [shift, setShift] = useState<ShiftKey>("all");

  const filteredIncidents = useMemo(() => {
    const list = shift === "all"
      ? incidents
      : incidents.filter(i => inShift(i.incident_time, shift));
    // Newest first for the dashboard preview
    return [...list].reverse().slice(0, 8);
  }, [incidents, shift]);

  const inCasino = useMemo(
    () => visits.filter((v: any) => !v.checked_out_at),
    [visits],
  );

  const blacklistAlerts = useMemo(
    () => inCasino.filter((v: any) => v.players?.status === "blacklist"),
    [inCasino],
  );

  const liveTables = useMemo(
    () => tables.filter(t => t.status === "open"),
    [tables],
  );

  // Per-table seat count (from active visits with table_id position)
  const seatsByTable = useMemo(() => {
    const map: Record<string, number> = {};
    inCasino.forEach((v: any) => {
      if (v.position_table_id) {
        map[v.position_table_id] = (map[v.position_table_id] || 0) + 1;
      }
    });
    return map;
  }, [inCasino]);

  return (
    <div className="cms-panel mb-6">
      <div className="cms-header flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          CCTV Overview · {fmtDateOnly(businessDate)}
        </span>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {SHIFT_BTNS.map(b => (
            <Button
              key={b.id}
              variant={shift === b.id ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 font-mono text-xs"
              onClick={() => setShift(b.id)}
              title={b.id === "all" ? "All hours" : SHIFT_WINDOWS[b.id as Exclude<ShiftKey, "all">].label}
            >
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Latest incidents */}
        <div className="cms-panel">
          <div className="cms-header flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              Latest Incidents
            </span>
            <Link to="/incidents" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No incidents</p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredIncidents.map(i => (
                  <li key={i.id} className="px-3 py-2 hover:bg-muted/30">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {i.incident_time?.slice(0, 5)}
                      </span>
                      {i.points > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded cms-amount-negative bg-destructive/10">
                          {i.points} pts
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-card-foreground truncate" title={i.incident}>
                      {i.violation_type ? `[${i.violation_type}] ` : ""}{i.incident}
                    </p>
                    {(i.table_name || i.dealer_name) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[i.table_name, i.dealer_name].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Live tables grid */}
        <div className="cms-panel">
          <div className="cms-header flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Tables Tracking
            </span>
            <Link to="/tables" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {liveTables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No open tables</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-3 py-1.5">Table</th>
                    <th className="text-left px-3 py-1.5">Game</th>
                    <th className="text-right px-3 py-1.5">Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {liveTables.map(t => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-mono text-card-foreground">{t.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">{t.game}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {seatsByTable[t.id] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Active players + Blacklist alerts */}
        <div className="cms-panel">
          <div className="cms-header flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              In Casino · {inCasino.length}
            </span>
            <Link to="/guests" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {blacklistAlerts.length > 0 && (
              <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/30">
                <p className="text-[10px] uppercase tracking-wider cms-amount-negative font-semibold mb-1">
                  Blacklist alert · {blacklistAlerts.length}
                </p>
                <ul className="space-y-0.5">
                  {blacklistAlerts.slice(0, 5).map((v: any) => (
                    <li key={v.id} className="text-sm text-card-foreground truncate">
                      <Link to={`/players/${v.player_id}`} className="hover:underline">
                        {v.players?.first_name} {v.players?.last_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inCasino.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active players</p>
            ) : (
              <ul className="divide-y divide-border">
                {inCasino.slice(0, 12).map((v: any) => (
                  <li key={v.id} className="px-3 py-1.5 hover:bg-muted/30 flex items-center justify-between gap-2">
                    <Link to={`/players/${v.player_id}`} className="text-sm text-card-foreground truncate hover:underline">
                      {v.players?.first_name} {v.players?.last_name}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0">
                      {v.position_table_id ? "table" : v.position_slots ? "slots" : "hall"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
