import { CURRENCIES } from "@/lib/currency";
import { cashSum } from "./CashDenomInput";

export const MOBILE_PROVIDERS = ["Mpesa", "Tigo", "Halo", "AirTel"] as const;

export type MobileProviders = Record<string, number>;
export type Banks = { tzs: number; usd: number };

export const emptyMobile = (): MobileProviders => Object.fromEntries(MOBILE_PROVIDERS.map(p => [p, 0]));
export const emptyBanks = (): Banks => ({ tzs: 0, usd: 0 });
export const mobileTotal = (m: MobileProviders) => Object.values(m).reduce((s, v) => s + (v || 0), 0);
export const bankTotalTzs = (b: Banks, rates: Record<string, number>) => (b.tzs || 0) + (b.usd || 0) * (rates["USD"] || 0);

export const chipSum = (chips: Record<number, number>) =>
  Object.entries(chips).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

export const emptyCash = (): Record<string, Record<number, number>> =>
  Object.fromEntries(CURRENCIES.map(c => [c, {}]));

export const calcCashTotalTzs = (
  cash: Record<string, Record<number, number>>,
  rates: Record<string, number>,
) =>
  Object.entries(cash).reduce((sum, [cur, denoms]) => {
    const t = cashSum(denoms);
    const rate = cur === "TZS" ? 1 : (rates[cur] || 0);
    return sum + t * rate;
  }, 0);

export const calcGrandTotal = (
  chips: Record<number, number>,
  cash: Record<string, Record<number, number>>,
  banks: Banks,
  mobile: MobileProviders,
  rates: Record<string, number>,
) => chipSum(chips) + calcCashTotalTzs(cash, rates) + bankTotalTzs(banks, rates) + mobileTotal(mobile);
