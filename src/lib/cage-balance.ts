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
 * `compute_slots_shift_balance_from_row`). Updated 03 Jun 2026.
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
 * Tips CD model: tips collected throughout the shift physically sit in the
 * cage cash → they are already included in the closing cash count. When the
 * cashier later pays them out (Day / Evening payout events), the cash count
 * drops by the same amount. Net effect on cage is ZERO, so `tipsCdPayout`
 * MUST NOT be added back into CDR (doing so previously inflated the Shift
 * Balance by the tips amount). The collected log (`cage_slots_tips_cd`)
 * and payouts (`cage_slots_tips_cd_payouts`) remain audit-only here.
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
  tipsCdPayout?: number;   // Tips paid out of cage (Day + Evening)
};

export type SlotsBalanceResult = {
  deltaCash: number;
  cashDeskResult: number;
  cardsMiss: number;
  slotsResult: number;
  systemResult: number;
  cashlessBalance: number;
  cashlessFinal: number;
  expected: number;
  tipsCdPayout: number;
  shiftBalance: number;
};

export const computeSlotsShiftBalance = (i: SlotsBalanceInputs): SlotsBalanceResult => {
  const deltaCash = i.closingCash - i.openingCash;
  const tipsCdPayout = i.tipsCdPayout || 0;
  // Tips CD are cage-neutral (collection inflow + later payout net to zero
  // inside the physical cash count). They must NOT be added to CDR — doing
  // so previously caused tips to surface as a positive Shift Balance.
  const cashDeskResult =
    i.closingCash + i.expenses - i.addFloat + i.collection
    + i.lgOut - i.lgIn;
  const cardsMiss = (i.openingCards - i.closingCards) * i.cardValue;
  const slotsResult = i.systemResult;
  const expected = i.systemResult;
  // Balance = CDR − SystemResult − Cards Miss (no tips term)
  const shiftBalance = cashDeskResult - i.systemResult - cardsMiss;
  return {
    deltaCash,
    cashDeskResult,
    cardsMiss,
    slotsResult,
    systemResult: i.systemResult,
    cashlessBalance: i.cashlessIn - i.cashlessOut,
    cashlessFinal: i.cashlessFinal,
    expected,
    tipsCdPayout,
    shiftBalance,
  };
};


