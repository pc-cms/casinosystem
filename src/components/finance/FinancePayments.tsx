import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useWalletTransactions, useCreateWalletTransaction,
  EXPENSE_CATEGORY_GROUPS, CATEGORY_LABELS, OfficeExpenseCategory, WALLET_LABELS,
} from "@/hooks/use-finance";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { Plus } from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";

export const FinancePayments = () => {
  const { data: txs = [] } = useWalletTransactions(500);

  // Filter only expense-type transactions
  const expenses = txs.filter(tx => tx.tx_type === "manual_expense" || tx.tx_type === "use_reserve");

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Wallet Payments</h3>
        <AddManualExpenseDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No expenses recorded</TableCell>
                </TableRow>
              ) : (
                expenses.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">{fmtDateTime(tx.created_at)}</TableCell>
                    <TableCell className="font-mono font-medium">{formatNumberSpaces(tx.amount)}</TableCell>
                    <TableCell>
                      {tx.expense_category ? (
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[tx.expense_category]}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.tx_type === "manual_expense" ? "default" : "secondary"} className="text-[10px]">
                        {tx.tx_type === "manual_expense" ? "Manual" : "Reserve"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{tx.description || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const AddManualExpenseDialog = () => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<OfficeExpenseCategory>("salary");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();

  const handleSubmit = () => {
    create.mutate({
      tx_type: "manual_expense",
      from_wallet: "main_cash",
      amount: parseSpacedNumber(amount),
      expense_category: category,
      description: desc,
    }, {
      onSuccess: () => { setOpen(false); setAmount(""); setDesc(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Manual Expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={category} onValueChange={v => setCategory(v as OfficeExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORY_GROUPS).map(([key, group]) => (
                  <div key={key}>
                    <div className="px-2 py-1 text-[10px] font-mono text-muted-foreground uppercase">{group.label}</div>
                    {group.categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount (from Main Cash)</label>
            <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What for?" />
          </div>
          <Button onClick={handleSubmit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Record Expense</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
