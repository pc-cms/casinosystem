import { describe, it, expect } from "vitest";
import { getBusinessDate, isBusinessToday, timeToMinutes } from "@/lib/business-day";
import { chipSum, calcCashTotalTzs, calcGrandTotal, emptyMobile, emptyBanks, emptyCash } from "@/components/cage/CageHelpers";
import { cashSum } from "@/components/cage/CashDenomInput";

// ============ business-day.ts ============
describe("getBusinessDate", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const result = getBusinessDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("isBusinessToday matches getBusinessDate", () => {
    const today = getBusinessDate();
    expect(isBusinessToday(today)).toBe(true);
    expect(isBusinessToday("1999-01-01")).toBe(false);
  });

  it("timeToMinutes parses correctly", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("05:30")).toBe(330);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

// ============ CageHelpers ============
describe("chipSum", () => {
  it("returns 0 for empty object", () => {
    expect(chipSum({})).toBe(0);
  });

  it("calculates sum of denomination * count", () => {
    expect(chipSum({ 5: 10, 25: 4, 100: 2 })).toBe(5 * 10 + 25 * 4 + 100 * 2);
  });

  it("handles zero counts", () => {
    expect(chipSum({ 500: 0, 1000: 0 })).toBe(0);
  });
});

describe("cashSum", () => {
  it("returns 0 for empty", () => {
    expect(cashSum({})).toBe(0);
  });

  it("calculates denom * count", () => {
    expect(cashSum({ 1000: 5, 5000: 2 })).toBe(1000 * 5 + 5000 * 2);
  });
});

describe("calcCashTotalTzs", () => {
  it("converts foreign currencies using rates", () => {
    const cash = { TZS: { 1000: 10 }, USD: { 100: 2 } };
    const rates = { USD: 2500 };
    // TZS: 10*1000 = 10000, USD: 2*100=200 * 2500 = 500000
    expect(calcCashTotalTzs(cash, rates)).toBe(10000 + 500000);
  });

  it("returns 0 for empty cash", () => {
    expect(calcCashTotalTzs(emptyCash(), {})).toBe(0);
  });
});

describe("calcGrandTotal", () => {
  it("sums chips + cash + banks + mobile", () => {
    const chips = { 100: 10 }; // 1000
    const cash = { TZS: { 1000: 5 } }; // 5000
    const banks = { tzs: 2000, usd: 0 };
    const mobile = { Mpesa: 500, Tigo: 300, Halo: 0, AirTel: 0 };
    const rates = { USD: 2500 };
    const total = calcGrandTotal(chips, cash, banks, mobile, rates);
    expect(total).toBe(1000 + 5000 + 2000 + 800);
  });
});

describe("empty helpers", () => {
  it("emptyMobile has zero values", () => {
    const m = emptyMobile();
    expect(Object.values(m).every(v => v === 0)).toBe(true);
  });

  it("emptyBanks has zero values", () => {
    const b = emptyBanks();
    expect(b.tzs).toBe(0);
    expect(b.usd).toBe(0);
  });
});
