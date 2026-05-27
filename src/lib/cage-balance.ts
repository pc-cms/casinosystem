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
 *   Cash Desk Result  = ΔCash + Expenses + Collection − Ace Fill (ACE System Fill)
 *                     + LG_Out − LG_In                 ← Cashless NOT included
 *   Cards Miss        = (OpeningCards − ClosingCards) × CardValue
 *   Slots Result      = System Result − OpeningCash − Ace Fill   ← derived P&L
 *   Shift Balance     = Cash Desk Result − Slots Result − Cards Miss
 *
 *   Cashless Balance  = Cashless IN − Cashless OUT   ← display only, never applied
 *
 * `systemResult` is entered MANUALLY by the slots cashier (raw system readout).
 * `slotsResult` is the derived P&L (can be negative — normal).
 */
export type SlotsBalanceInputs = {
  openingCash: number;
  closingCash: number;
  expenses: number;
  collection: number;
  addFloat: number;        // Ace Fill (ACE System Fill)
  lgIn: number;
  lgOut: number;
  cashlessIn: number;      // display only
  cashlessOut: number;     // display only
  openingCards: number;
  closingCards: number;
  cardValue: number;
  systemResult: number;
};

export type SlotsBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;
  cardsMiss: number;
  slotsResult: number;     // derived: systemResult − openingCash − addFloat
  systemResult: number;    // raw manual entry (passthrough)
  cashlessBalance: number; // display only: cashlessIn − cashlessOut
  shiftBalance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult =
    deltaCash + i.expenses + i.collection - i.addFloat
    + i.lgOut - i.lgIn;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult - i.openingCash - i.addFloat;
  const cashlessBalance = i.cashlessIn - i.cashlessOut;
  const shiftBalance = cashDeskResult - slotsResult - cardsMiss;
  return { deltaCash, cashDeskResult, cardsMiss, slotsResult, systemResult: i.systemResult, cashlessBalance, shiftBalance };
};
