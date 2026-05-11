/**
 * Canonical Cash Desk Formula — single source of truth (mirrors DB RPC
 * `compute_shift_balance`). Used for live preview during Close Shift entry.
 *
 *   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat
 *                    + SlotsOut − SlotsIn + Miss
 *   Shift Balance    = Cash Desk Result − Tables Result        (= 0 ideal)
 *
 * Sign conventions:
 *  - `miss` is signed (counted − opening). Negative = chips missing.
 *  - `addFloat` reduces cash desk responsibility (cash arrived from safe).
 *  - `collection` increases (cash physically left the desk to safe).
 *  - `slotsOut` increases / `slotsIn` decreases (mirrors physical flow).
 */
export type CageBalanceInputs = {
  openingCash: number;
  closingCash: number;
  expenses: number;
  collection: number;
  addFloat: number;
  slotsIn: number;
  slotsOut: number;
  miss: number;
  tablesResult: number;
};

export type CageBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;
  shiftBalance: number;
};

export const computeShiftBalance = (i: CageBalanceInputs): CageBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult =
    deltaCash + i.expenses + i.collection - i.addFloat + i.slotsOut - i.slotsIn + i.miss;
  const shiftBalance = cashDeskResult - i.tablesResult;
  return { deltaCash, cashDeskResult, shiftBalance };
};
