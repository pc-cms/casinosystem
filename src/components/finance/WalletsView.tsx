import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWallets, useCreateWalletTransaction, WALLET_LABELS, WalletType, EXPENSE_CATEGORY_GROUPS, CATEGORY_LABELS } from "@/hooks/use-finance";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { ArrowRightLeft, PiggyBank, Wallet, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { WalletSetup } from "./WalletSetup";

const MAIN_WALLETS: WalletType[] = ["main_cash", "office_safe"];
const OPERATIONAL_WALLETS: WalletType[] = ["cage_slot", "cage_table", "mobile_money", "bank_account"];
const RESERVE_WALLETS: WalletType[] = ["rent_reserve", "license_reserve", "tax_reserve", "other_reserve"];

export const WalletsView = () => {
  const { data: wallets = [], isLoading } = useWallets();

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (wallets.length === 0) return <WalletSetup />;

  const getBalance = (wt: WalletType) => Number(wallets.find(w => w.wallet_type === wt)?.current_balance || 0);

  return (
    <div className="space-y-4 mt-4">
      {/* Main wallets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MAIN_WALLETS.map(wt => (
          <Card key={wt}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{WALLET_LABELS[wt]}</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatNumberSpaces(getBalance(wt))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Operational wallets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Operational
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {OPERATIONAL_WALLETS.map(wt => (
              <div key={wt} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{WALLET_LABELS[wt]}</p>
                <p className="text-base font-bold font-mono">{formatNumberSpaces(getBalance(wt))}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reserves */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <PiggyBank className="w-4 h-4" /> Reserves
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RESERVE_WALLETS.map(wt => (
              <div key={wt} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{WALLET_LABELS[wt]}</p>
                <p className="text-base font-bold font-mono">{formatNumberSpaces(getBalance(wt))}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <TransferDialog />
        <AllocateReserveDialog />
        <UseReserveDialog />
        <ExternalIncomeDialog />
        <CollectionDialog />
      </div>
    </div>
  );
};

const TransferDialog = () => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<WalletType>("main_cash");
  const [to, setTo] = useState<WalletType>("office_safe");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();

  const handleSubmit = () => {
    create.mutate({ tx_type: "transfer", from_wallet: from, to_wallet: to, amount: parseSpacedNumber(amount), description: desc }, {
      onSuccess: () => { setOpen(false); setAmount(""); setDesc(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-auto py-3"><ArrowRightLeft className="w-4 h-4" /> Transfer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Transfer Between Wallets</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Select value={from} onValueChange={v => setFrom(v as WalletType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Select value={to} onValueChange={v => setTo(v as WalletType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </div>
          <Button onClick={handleSubmit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Transfer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AllocateReserveDialog = () => {
  const [open, setOpen] = useState(false);
  const [reserve, setReserve] = useState<WalletType>("rent_reserve");
  const [category, setCategory] = useState<string>("rent");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();

  const handleSubmit = () => {
    create.mutate({
      tx_type: "allocate_reserve",
      from_wallet: "main_cash",
      to_wallet: reserve,
      amount: parseSpacedNumber(amount),
      expense_category: category as any,
      description: desc,
    }, {
      onSuccess: () => { setOpen(false); setAmount(""); setDesc(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-auto py-3"><PiggyBank className="w-4 h-4" /> Allocate</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Allocate to Reserve</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Reserve</label>
            <Select value={reserve} onValueChange={v => setReserve(v as WalletType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESERVE_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Budget Category</label>
            <Select value={category} onValueChange={setCategory}>
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
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </div>
          <Button onClick={handleSubmit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Allocate</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UseReserveDialog = () => {
  const [open, setOpen] = useState(false);
  const [reserve, setReserve] = useState<WalletType>("rent_reserve");
  const [category, setCategory] = useState<string>("rent");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();

  const handleSubmit = () => {
    create.mutate({
      tx_type: "use_reserve",
      from_wallet: reserve,
      amount: parseSpacedNumber(amount),
      expense_category: category as any,
      description: desc,
    }, {
      onSuccess: () => { setOpen(false); setAmount(""); setDesc(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-auto py-3"><Wallet className="w-4 h-4" /> Use Reserve</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Spend from Reserve</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Reserve</label>
            <Select value={reserve} onValueChange={v => setReserve(v as WalletType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESERVE_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Expense Category</label>
            <Select value={category} onValueChange={setCategory}>
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
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What for?" />
          </div>
          <Button onClick={handleSubmit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Spend</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CollectionDialog = () => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<WalletType>("main_cash");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();

  const handleSubmit = () => {
    create.mutate({
      tx_type: "collection" as any,
      from_wallet: from,
      amount: parseSpacedNumber(amount),
      description: desc || "Owner collection",
    }, {
      onSuccess: () => { setOpen(false); setAmount(""); setDesc(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-auto py-3 border-destructive/30 text-destructive hover:bg-destructive/10">
          <ArrowUpFromLine className="w-4 h-4" /> Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Owner Collection (Withdrawal)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">From Wallet</label>
            <Select value={from} onValueChange={v => setFrom(v as WalletType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Collection note" />
          </div>
          <p className="text-xs text-muted-foreground">
            Collection is NOT an expense. It reduces cash balance but is not tracked against budget.
          </p>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || !parseSpacedNumber(amount)}
            className="w-full"
            variant="destructive"
          >
            Withdraw
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ExternalIncomeDialog = () => {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<WalletType>("main_cash");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();

  const handleSubmit = () => {
    create.mutate({
      tx_type: "external_income" as any,
      to_wallet: to,
      amount: parseSpacedNumber(amount),
      description: desc || "External income",
      business_date: new Date().toISOString().slice(0, 10),
    }, {
      onSuccess: () => { setOpen(false); setAmount(""); setDesc(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-auto py-3 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
          <ArrowDownToLine className="w-4 h-4" /> Income
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record External Income</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">To Wallet</label>
            <Select value={to} onValueChange={v => setTo(v as WalletType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Source of income" />
          </div>
          <p className="text-xs text-muted-foreground">
            External income increases wallet balance and is included in global reconciliation.
          </p>
          <Button onClick={handleSubmit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Record Income</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
