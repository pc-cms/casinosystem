/**
 * Canonical Cash Desk Formula — single source of truth (mirrors DB RPC
 * `compute_shift_balance`). Used for live preview during Close Shift entry.
 *
 *   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat
 *                    + SlotsOut − SlotsIn                         (NO miss)
 *   Shift Balance    = Cash Desk Result − Tables Result − Miss   (= 0 ideal)
 *
 * Sign conventions:
 *  - `miss` is signed (counted − opening). Negative = chips missing.
 *    Miss is a SEPARATE balance term, NOT folded into Cash Desk Result.
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
    deltaCash + i.expenses + i.collection - i.addFloat + i.slotsOut - i.slotsIn;
  const shiftBalance = cashDeskResult - i.tablesResult - i.miss;
  return { deltaCash, cashDeskResult, shiftBalance };
};

/**
 * Cage Slots Cash Desk Formula (mirrors live game, with Cards Miss in place of
 * Chip Miss). Source of truth = DB trigger `compute_slots_shift_balance_from_row`.
 *
 *   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat
 *                    + LG_Out − LG_In + CashlessOut − CashlessIn
 *   Cards Miss       = (OpeningCards − ClosingCards) × CardValue   (− = shortage)
 *   Slots Result     = SystemResult  (what slot system reported)
 *   Balance          = Cash Desk Result − Slots Result − Cards Miss
 */
export type SlotsBalanceInputs = {
  openingCash: number;
  closingCash: number;
  expenses: number;
  collection: number;
  addFloat: number;
  lgIn: number;
  lgOut: number;
  cashlessIn: number;
  cashlessOut: number;
  openingCards: number;
  closingCards: number;
  cardValue: number;
  systemResult: number;
};

export type SlotsBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;
  cardsMiss: number;
  slotsResult: number;
  balance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult =
    deltaCash + i.expenses + i.collection - i.addFloat
    + i.lgOut - i.lgIn + i.cashlessOut - i.cashlessIn;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult;
  const balance = cashDeskResult - slotsResult - cardsMiss;
  return { deltaCash, cashDeskResult, cardsMiss, slotsResult, balance };
};
