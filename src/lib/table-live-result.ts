/**
 * Live Table Result resolution.
 *
 * Priority for "current result of a table" displayed in dashboards:
 *   1. closing_result (table is closed/counted) — authoritative
 *   2. Latest Chip Count snapshot for this table, IF it is newer than the
 *      latest hourly Table Tracker entry for the same table.
 *      → overrides Tracker until the next hourly Tracker update arrives.
 *   3. Sum of Table Tracker values for the table (default live signal).
 */

export interface TrackerRow {
  table_id: string;
  value: number | string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SnapshotRow {
  location_type: string;
  location_id: string | null;
  denomination: number | string;
  expected_quantity: number | string;
  actual_quantity: number | string;
  created_at?: string | null;
}

export type BaselineMap = Record<string, Record<number, number>>;

const ts = (r: { created_at?: string | null; updated_at?: string | null }) =>
  r.updated_at || r.created_at || "";

/**
 * Latest tracker snapshot value for a table.
 *
 * Each Table Tracker hourly cell is a SNAPSHOT of the table's current
 * result at that hour — not an increment. To get the live result we must
 * pick the most recent (by time_slot, fallback to created_at/updated_at)
 * non-null entry, NOT sum the cells.
 */
export const trackerTotal = (trackerData: TrackerRow[], tableId: string) => {
  const rows = trackerData.filter(t => t.table_id === tableId);
  if (rows.length === 0) return 0;
  const sorted = [...rows].sort((a, b) => {
    const sa = (a as any).time_slot || "";
    const sb = (b as any).time_slot || "";
    if (sa !== sb) return sa < sb ? -1 : 1;
    return ts(a).localeCompare(ts(b));
  });
  const last = sorted[sorted.length - 1];
  return Number(last?.value || 0);
};


/** Most recent timestamp among tracker rows for a table (or "" if none). */
export const latestTrackerTime = (trackerData: TrackerRow[], tableId: string) =>
  trackerData
    .filter(t => t.table_id === tableId)
    .reduce((acc, t) => {
      const t2 = ts(t);
      return t2 > acc ? t2 : acc;
    }, "");

/**
 * Build a map: tableId → { latestTime, perDenom: { [denom]: actual_quantity } }
 * keeping only the LATEST snapshot batch per table (snapshots written in a single
 * Chip Count share a created_at).
 */
export const buildLatestTableSnapshot = (snapshots: SnapshotRow[]) => {
  const map: Record<string, { latestTime: string; perDenom: Record<number, number>; expectedPerDenom: Record<number, number> }> = {};
  // Sort ascending by time so later writes overwrite.
  const sorted = [...snapshots].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  sorted.forEach(s => {
    if (s.location_type !== "table" || !s.location_id) return;
    const t = s.created_at || "";
    const cur = map[s.location_id];
    if (!cur || t > cur.latestTime) {
      // New (later) batch — reset per-denom to only this batch's rows
      if (!cur || t > cur.latestTime) {
        map[s.location_id] = { latestTime: t, perDenom: {}, expectedPerDenom: {} };
      }
    }
    if (map[s.location_id].latestTime === t) {
      map[s.location_id].perDenom[Number(s.denomination)] = Number(s.actual_quantity);
      map[s.location_id].expectedPerDenom[Number(s.denomination)] = Number(s.expected_quantity);
    }
  });
  return map;
};

/** Result derived from a chip snapshot batch: Σ (actual - baseline) × denom. */
export const chipSnapshotResult = (
  perDenom: Record<number, number>,
  baselinePerDenom: Record<number, number>
) => {
  let total = 0;
  const denoms = new Set<number>([
    ...Object.keys(perDenom).map(Number),
    ...Object.keys(baselinePerDenom).map(Number),
  ]);
  denoms.forEach(d => {
    const actual = perDenom[d] ?? 0;
    const expected = baselinePerDenom[d] ?? 0;
    total += (actual - expected) * d;
  });
  return total;
};

export interface LiveResultArgs {
  tableId: string;
  closingResult: number | null | undefined;
  trackerData: TrackerRow[];
  snapshotIndex: ReturnType<typeof buildLatestTableSnapshot>;
  baselineMap: BaselineMap;
}

/** Returns the current displayed result for a single table. */
export const liveTableResult = ({
  tableId,
  closingResult,
  trackerData,
  snapshotIndex,
  baselineMap,
}: LiveResultArgs): number => {
  if (closingResult !== null && closingResult !== undefined) return Number(closingResult);

  const trackerSum = trackerTotal(trackerData, tableId);
  const snap = snapshotIndex[tableId];
  if (!snap) return trackerSum;

  const trackerTime = latestTrackerTime(trackerData, tableId);
  // Chip Count overrides Tracker only if it was taken AFTER the last tracker entry.
  if (snap.latestTime && snap.latestTime > trackerTime) {
    return chipSnapshotResult(snap.perDenom, snap.expectedPerDenom || baselineMap[tableId] || {});
  }
  return trackerSum;
};
