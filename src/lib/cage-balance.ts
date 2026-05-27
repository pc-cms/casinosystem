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
 * Cage Slots balance — canonical formula (mirrors DB
 * `compute_slots_shift_balance_from_row`).
 *
 *   ΔCash            = ClosingCash − OpeningCash
 *   Cash Desk Result = ΔCash + Expenses + Collection + LG_Out − LG_In
 *   Cards Miss       = (OpeningCards − ClosingCards) × CardValue
 *   Slots Result     = System Result − OpeningCash − Ace Fill
 *
 *   Shift Balance    = (Cash Desk Result + Ace Fill)
 *                    − (System Result − OpeningCash)
 *                    − Cards Miss
 *
 *   Cashless Balance = Cashless IN − Cashless OUT   (derived, display only)
 *   Cashless Final   = manual entry, PRINT ONLY — never used in any formula.
 *
 * `systemResult` is entered MANUALLY by the slots cashier (raw system readout).
 * `addFloat` = Ace Fill (ACE System Fill).
 */
export type SlotsBalanceInputs = {
  openingCash: number;
  closingCash: number;
  expenses: number;
  collection: number;
  addFloat: number;        // Ace Fill (ACE System Fill)
  lgIn: number;
  lgOut: number;
  cashlessIn: number;
  cashlessOut: number;
  cashlessFinal: number;   // manual entry, print only — not used in calcs
  openingCards: number;
  closingCards: number;
  cardValue: number;
  systemResult: number;
};

export type SlotsBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;  // ΔCash + Expenses + Collection + LG_Out − LG_In
  cardsMiss: number;
  slotsResult: number;     // derived: systemResult − openingCash − addFloat
  systemResult: number;    // raw manual entry (passthrough)
  cashlessBalance: number; // derived: IN − OUT (display)
  cashlessFinal: number;   // manual passthrough (print only)
  expected: number;        // systemResult − openingCash
  shiftBalance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult = deltaCash + i.expenses + i.collection + i.lgOut - i.lgIn;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult - i.openingCash - i.addFloat;
  const expected = i.systemResult - i.openingCash;
  const shiftBalance = (cashDeskResult + i.addFloat) - expected - cardsMiss;
  return {
    deltaCash,
    cashDeskResult,
    cardsMiss,
    slotsResult,
    systemResult: i.systemResult,
    cashlessBalance: i.cashlessIn - i.cashlessOut,
    cashlessFinal: i.cashlessFinal,
    expected,
    shiftBalance,
  };
};
