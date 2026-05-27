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
 * Cage Slots balance — canonical (simplified) formula.
 *
 *   ΔCash             = ClosingCash − OpeningCash
 *   Cash Desk Result  = ClosingCash + Ace Fill         ← what the cashier actually has
 *   Cards Miss        = (OpeningCards − ClosingCards) × CardValue
 *   Slots Result      = System Result − OpeningCash − Ace Fill   ← derived P&L
 *
 *   Shift Balance     = (ClosingCash + Ace Fill)
 *                     − (System Result − OpeningCash)
 *                     − Cards Miss
 *
 *   Cashless Balance  = manual entry on the shift, printed on the check only.
 *                       Cashless IN / OUT are informational.
 *
 * `systemResult` is entered MANUALLY by the slots cashier (raw system readout).
 * Expenses / Collection / LG transfers do NOT affect the slots shift balance.
 */
export type SlotsBalanceInputs = {
  openingCash: number;
  closingCash: number;
  addFloat: number;        // Ace Fill (ACE System Fill)
  cashlessIn: number;      // display only
  cashlessOut: number;     // display only
  cashlessBalanceManual: number; // manual entry, printed on check
  openingCards: number;
  closingCards: number;
  cardValue: number;
  systemResult: number;
};

export type SlotsBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;  // ClosingCash + Ace Fill
  cardsMiss: number;
  slotsResult: number;     // derived: systemResult − openingCash − addFloat
  systemResult: number;    // raw manual entry (passthrough)
  cashlessBalance: number; // manual entry passthrough (display only)
  shiftBalance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult = i.closingCash + i.addFloat;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult - i.openingCash - i.addFloat;
  const expected = i.systemResult - i.openingCash;
  const shiftBalance = cashDeskResult - expected - cardsMiss;
  return {
    deltaCash,
    cashDeskResult,
    cardsMiss,
    slotsResult,
    systemResult: i.systemResult,
    cashlessBalance: i.cashlessBalanceManual,
    shiftBalance,
  };
};
