/**
 * NEP (Net External Position) model — splits each cash-in into:
 *   - External (Drop R)  : new real money from the player
 *   - Recycled (Drop V)  : returned winnings (covers negative NEP)
 *
 * NEP_running = sum(in) - sum(out), walked chronologically per player.
 * For each new buy/in:
 *   recycled = max(0, min(amount, -NEP))
 *   external = amount - recycled
 *   NEP    += amount
 * For each cashout/out:
 *   NEP    -= amount  (no split)
 *
 * Pure client-side helpers. The authoritative computation lives in DB RPCs:
 *   - compute_player_drop_split(player_id, from, to)
 *   - compute_tables_drop_split(casino_id, from, to)
 *   - player_drop_split_lifetime(player_id) (used by player_economy view)
 */

export type NepTx = {
  player_id: string | null;
  table_id?: string | null;
  type: string; // 'buy' | 'in' | 'cashout' | 'out' | ...
  amount: number | string;
  created_at: string;
  id?: string;
};

export type SplitTotals = { dropR: number; recycled: number };

const isCashIn = (t: NepTx) => t.type === "buy" || t.type === "in";
const isCashOut = (t: NepTx) => t.type === "cashout" || t.type === "out";

/**
 * Compute Drop R / Recycled for a single player over a window.
 * `allTxs` MUST contain ALL transactions of the player up to `toIso`
 * (we need full history to know the running NEP).
 */
export function splitPlayerWindow(
  allTxs: NepTx[],
  fromIso: string,
  toIso: string
): SplitTotals {
  const sorted = [...allTxs].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
    return (a.id || "").localeCompare(b.id || "");
  });
  let nep = 0;
  let dropR = 0;
  let recycled = 0;
  for (const t of sorted) {
    if (t.created_at > toIso) break;
    const amt = Number(t.amount) || 0;
    if (isCashIn(t)) {
      const rec = nep < 0 ? Math.min(amt, -nep) : 0;
      const ext = amt - rec;
      nep += amt;
      if (t.created_at >= fromIso) {
        dropR += ext;
        recycled += rec;
      }
    } else if (isCashOut(t)) {
      nep -= amt;
    }
  }
  return { dropR, recycled };
}

/**
 * Compute per-table Drop R / Recycled for a casino window from a flat list.
 * `allTxs` MUST be the full transaction history (all players, up to `toIso`)
 * so NEP is correct. Returns map keyed by table_id.
 */
export function splitTablesWindow(
  allTxs: NepTx[],
  fromIso: string,
  toIso: string
): Map<string, SplitTotals> {
  // group by player, walk chronologically per player
  const byPlayer = new Map<string, NepTx[]>();
  for (const t of allTxs) {
    if (!t.player_id) continue;
    let arr = byPlayer.get(t.player_id);
    if (!arr) { arr = []; byPlayer.set(t.player_id, arr); }
    arr.push(t);
  }
  const result = new Map<string, SplitTotals>();
  const bump = (tableId: string, ext: number, rec: number) => {
    let cur = result.get(tableId);
    if (!cur) { cur = { dropR: 0, recycled: 0 }; result.set(tableId, cur); }
    cur.dropR += ext;
    cur.recycled += rec;
  };
  for (const [, txs] of byPlayer) {
    txs.sort((a, b) => {
      if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
      return (a.id || "").localeCompare(b.id || "");
    });
    let nep = 0;
    for (const t of txs) {
      if (t.created_at > toIso) break;
      const amt = Number(t.amount) || 0;
      if (isCashIn(t)) {
        const rec = nep < 0 ? Math.min(amt, -nep) : 0;
        const ext = amt - rec;
        nep += amt;
        if (t.created_at >= fromIso && t.table_id) {
          bump(t.table_id, ext, rec);
        }
      } else if (isCashOut(t)) {
        nep -= amt;
      }
    }
  }
  return result;
}

/**
 * Per-player Drop R within a window from a flat list of all transactions
 * (all players, up to `toIso`). Returns map keyed by player_id.
 */
export function splitPlayersWindow(
  allTxs: NepTx[],
  fromIso: string,
  toIso: string
): Map<string, SplitTotals> {
  const byPlayer = new Map<string, NepTx[]>();
  for (const t of allTxs) {
    if (!t.player_id) continue;
    let arr = byPlayer.get(t.player_id);
    if (!arr) { arr = []; byPlayer.set(t.player_id, arr); }
    arr.push(t);
  }
  const out = new Map<string, SplitTotals>();
  for (const [pid, txs] of byPlayer) {
    out.set(pid, splitPlayerWindow(txs, fromIso, toIso));
  }
  return out;
}
