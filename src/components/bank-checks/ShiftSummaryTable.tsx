import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { fmtShiftLabel, getShiftDate, stripCommission } from "@/lib/bank-check-shift";
import { BankChecksTable } from "./BankChecksTable";
import type { BankCheck } from "@/hooks/use-bank-checks";

type SortKey = "shift_date" | "count" | "total" | "real";
type SortDir = "asc" | "desc";

interface ShiftRow {
  shiftDate: string;
  count: number;
  totalsByCurrency: Record<string, { check: number; real: number }>;
  checks: BankCheck[];
}

interface Props {
  checks: BankCheck[];
  isLoading: boolean;
  onOpenPhoto: (path: string) => void;
}

export function ShiftSummaryTable({ checks, isLoading, onOpenPhoto }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "shift_date",
    dir: "desc",
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo<ShiftRow[]>(() => {
    const map = new Map<string, ShiftRow>();
    for (const c of checks) {
      const shiftDate = getShiftDate(c.check_date, c.check_time);
      if (!map.has(shiftDate)) {
        map.set(shiftDate, {
          shiftDate,
          count: 0,
          totalsByCurrency: {},
          checks: [],
        });
      }
      const row = map.get(shiftDate)!;
      row.count += 1;
      row.checks.push(c);
      const cur = c.currency || "TZS";
      const amt = Number(c.amount) || 0;
      if (!row.totalsByCurrency[cur]) row.totalsByCurrency[cur] = { check: 0, real: 0 };
      row.totalsByCurrency[cur].check += amt;
      row.totalsByCurrency[cur].real += stripCommission(amt);
    }
    return Array.from(map.values());
  }, [checks]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (key === "shift_date") {
        av = a.shiftDate;
        bv = b.shiftDate;
      } else if (key === "count") {
        av = a.count;
        bv = b.count;
      } else if (key === "total") {
        av = sumTotals(a.totalsByCurrency, "check");
        bv = sumTotals(b.totalsByCurrency, "check");
      } else {
        av = sumTotals(a.totalsByCurrency, "real");
        bv = sumTotals(b.totalsByCurrency, "real");
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return arr;
  }, [rows, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  const toggleExpand = (key: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const SortHeader = ({
    label,
    keyName,
    align = "left",
  }: {
    label: string;
    keyName: SortKey;
    align?: "left" | "right";
  }) => {
    const isActive = sort.key === keyName;
    const Icon = !isActive ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        className={`px-3 py-2 font-semibold cursor-pointer select-none hover:bg-muted ${
          align === "right" ? "text-right" : "text-left"
        }`}
        onClick={() => toggleSort(keyName)}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {label}
          <Icon className={`h-3 w-3 ${isActive ? "opacity-100" : "opacity-40"}`} />
        </span>
      </th>
    );
  };

  return (
    <div className="border rounded-lg overflow-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="w-8"></th>
            <SortHeader label="Shift (12:00 → 06:00)" keyName="shift_date" />
            <SortHeader label="Checks" keyName="count" align="right" />
            <SortHeader label="Total (with commission)" keyName="total" align="right" />
            <SortHeader label="Real (−3%)" keyName="real" align="right" />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} className="text-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline" />
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-10 text-muted-foreground">
                No shifts in selected range.
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const isOpen = expanded.has(row.shiftDate);
              const currencies = Object.keys(row.totalsByCurrency);
              return (
                <>
                  <tr
                    key={row.shiftDate}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleExpand(row.shiftDate)}
                  >
                    <td className="px-2 py-2">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{fmtShiftLabel(row.shiftDate)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.count}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {currencies.map((cur) => (
                        <div key={cur}>
                          {formatCurrency(row.totalsByCurrency[cur].check, cur)}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-success">
                      {currencies.map((cur) => (
                        <div key={cur}>
                          {formatCurrency(row.totalsByCurrency[cur].real, cur)}
                        </div>
                      ))}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${row.shiftDate}-detail`} className="bg-muted/20">
                      <td colSpan={5} className="p-3">
                        <BankChecksTable
                          checks={[...row.checks].sort((a, b) => {
                            // chronological within shift: 12:00 → 23:59 → 00:00 → 05:59
                            const ka = `${a.check_date} ${a.check_time || "00:00"}`;
                            const kb = `${b.check_date} ${b.check_time || "00:00"}`;
                            return ka.localeCompare(kb);
                          })}
                          isLoading={false}
                          onOpenPhoto={onOpenPhoto}
                          showDelete={false}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function sumTotals(
  totals: Record<string, { check: number; real: number }>,
  field: "check" | "real"
): number {
  // For sorting only — sum naively across currencies (acceptable for ranking)
  return Object.values(totals).reduce((s, v) => s + v[field], 0);
}
