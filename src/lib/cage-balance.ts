/**
 * Canonical Cash Desk Formula — single source of truth (mirrors DB RPC
 * `compute_shift_balance`). Used for live preview during Close Shift entry.
 *
 *   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat
 *                    + SlotsOut − SlotsIn                         (NO miss)
 *   Shift Balance    = Cash Desk Result − Tables Result − Miss   (= 0 ideal)
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
 * Cage Slots balance — canonical formula.
 *
 *   ΔCash             = ClosingCash − OpeningCash
 *   Cash Desk Result  = ΔCash + Expenses + Collection − AddFloat (Fill)
 *                     + LG_Out − LG_In + Cashless_Out − Cashless_In
 *   Cards Miss        = (OpeningCards − ClosingCards) × CardValue
 *   Slots Result      = System Result − OpeningCash − AddFloat (Fill)   ← derived P&L
 *   Shift Balance     = Cash Desk Result − Slots Result − Cards Miss
 *
 * `systemResult` is entered MANUALLY by the slots cashier (raw system readout).
 * `slotsResult` is the derived P&L (can be negative — normal).
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
  slotsResult: number;   // derived: systemResult − openingCash − addFloat
  systemResult: number;  // raw manual entry (passthrough)
  shiftBalance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult =
    deltaCash + i.expenses + i.collection - i.addFloat
    + i.lgOut - i.lgIn + i.cashlessOut - i.cashlessIn;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult - i.openingCash - i.addFloat;
  const shiftBalance = cashDeskResult - slotsResult - cardsMiss;
  return { deltaCash, cashDeskResult, cardsMiss, slotsResult, systemResult: i.systemResult, shiftBalance };
};
