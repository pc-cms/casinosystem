import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ImageIcon, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { stripCommission } from "@/lib/bank-check-shift";
import { useUpdateBankCheck, type BankCheck } from "@/hooks/use-bank-checks";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

type SortKey =
  | "check_date"
  | "check_time"
  | "bank"
  | "currency"
  | "receipt_no"
  | "approval_code"
  | "card_masked"
  | "amount"
  | "real";

type SortDir = "asc" | "desc";

interface Props {
  checks: BankCheck[];
  isLoading: boolean;
  onOpenPhoto: (path: string) => void;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
  emptyMessage?: string;
}

export function BankChecksTable({
  checks,
  isLoading,
  onOpenPhoto,
  onDelete,
  showDelete = true,
  emptyMessage = "No checks for this period.",
}: Props) {
  const updateMut = useUpdateBankCheck();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({
    key: "check_date",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    if (!sort) return checks;
    const arr = [...checks];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (key === "real") {
        av = stripCommission(Number(a.amount) || 0);
        bv = stripCommission(Number(b.amount) || 0);
      } else if (key === "amount") {
        av = Number(a.amount) || 0;
        bv = Number(b.amount) || 0;
      } else if (key === "check_date") {
        av = `${a.check_date} ${a.check_time || ""}`;
        bv = `${b.check_date} ${b.check_time || ""}`;
      } else {
        av = (a[key] || "") as string;
        bv = (b[key] || "") as string;
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return arr;
  }, [checks, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const SortHeader = ({
    label,
    keyName,
    align = "left",
  }: {
    label: string;
    keyName: SortKey;
    align?: "left" | "right" | "center";
  }) => {
    const isActive = sort?.key === keyName;
    const Icon = !isActive ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        className={`px-3 py-2 font-semibold cursor-pointer select-none hover:bg-muted ${
          align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
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

  const colCount = showDelete ? 11 : 10;

  return (
    <div className="border rounded-lg overflow-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <SortHeader label="Date" keyName="check_date" />
            <SortHeader label="Time" keyName="check_time" />
            <SortHeader label="Bank" keyName="bank" />
            <SortHeader label="Currency" keyName="currency" />
            <SortHeader label="Receipt №" keyName="receipt_no" />
            <SortHeader label="Approval" keyName="approval_code" />
            <SortHeader label="Card" keyName="card_masked" />
            <SortHeader label="Check amount" keyName="amount" align="right" />
            <SortHeader label="Real (−3%)" keyName="real" align="right" />
            <th className="px-3 py-2 font-semibold text-center">Photo</th>
            {showDelete && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={colCount} className="text-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline" />
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="text-center py-10 text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((c) => {
              const real = stripCommission(Number(c.amount) || 0);
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{fmtDate(c.check_date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.check_time || "—"}</td>
                  <td className="px-3 py-2">{c.bank || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.currency || "TZS"}</td>
                  <td className="px-3 py-2 font-mono">{c.receipt_no || "—"}</td>
                  <td className="px-3 py-2 font-mono">{c.approval_code || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.card_masked || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatCurrency(Number(c.amount), c.currency || "TZS")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-success">
                    {formatCurrency(real, c.currency || "TZS")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.photo_url ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onOpenPhoto(c.photo_url!)}
                        title="Show photo"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {showDelete && (
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (onDelete && confirm("Delete check?")) onDelete(c.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
