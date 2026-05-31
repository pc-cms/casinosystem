/**
 * Canonical Cash Desk Formula — single source of truth (mirrors DB RPC
 * `compute_shift_balance`). Used for live preview during Close Shift entry.
 *
 *   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat
 *                    + SlotsOut − SlotsIn                         (NO miss)
 *   Shift Balance    = Cash Desk Result − Tables Result − Miss − Tips
 *
 * Tips (`tips_live` + `tips_poker` + `tips_floor` transactions of THIS shift)
 * sit physically inside the cage at close time. They inflate ΔCash exactly
 * by their sum and must be subtracted so the cashier is not held responsible
 * for that surplus.
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
  tips?: number;
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
  const shiftBalance = cashDeskResult - i.tablesResult - i.miss - (i.tips || 0);
  return { deltaCash, cashDeskResult, shiftBalance };
};


/**
 * Cage Slots balance — canonical formula (mirrors DB
 * `compute_slots_shift_balance_from_row`). Updated 29 May 2026.
 *
 *   ΔCash            = ClosingCash − OpeningCash               (display only)
 *   Cash Desk Result = ClosingCash + Expenses − Ace Fill
 *                    + Collection + LG_Out − LG_In
 *   Cards Miss       = (OpeningCards − ClosingCards) × CardValue
 *   Slots Result     = System Result
 *   Expected         = System Result
 *
 *   Shift Balance    = Cash Desk Result − System Result − Cards Miss
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
  tipsCd?: number;         // Tips CD — physically removed from cage, added back to balance
};

export type SlotsBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;
  cardsMiss: number;
  slotsResult: number;     // = systemResult
  systemResult: number;
  cashlessBalance: number; // derived: IN − OUT (display)
  cashlessFinal: number;   // manual passthrough (print only)
  expected: number;        // = systemResult
  tipsCd: number;
  shiftBalance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const cashDeskResult =
    i.closingCash + i.expenses - i.addFloat + i.collection + i.lgOut - i.lgIn;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult;
  const expected = i.systemResult;
  const tipsCd = i.tipsCd || 0;
  // Shift Balance = CDR − SystemResult − Cards Miss + Tips CD
  // (Tips CD physically removed from cage during shift → added back so balance reflects reality.)
  const shiftBalance = cashDeskResult - i.systemResult - cardsMiss + tipsCd;
  return {
    deltaCash,
    cashDeskResult,
    cardsMiss,
    slotsResult,
    systemResult: i.systemResult,
    cashlessBalance: i.cashlessIn - i.cashlessOut,
    cashlessFinal: i.cashlessFinal,
    expected,
    tipsCd,
    shiftBalance,
  };
};


