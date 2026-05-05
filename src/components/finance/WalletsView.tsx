import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineEditor } from "@/components/layout/InlineEditor";
import { useWallets, useCreateWalletTransaction, WALLET_LABELS, WalletType, EXPENSE_CATEGORY_GROUPS, CATEGORY_LABELS } from "@/hooks/use-finance";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { ArrowRightLeft, PiggyBank, Wallet, ArrowUpFromLine, ArrowDownToLine, X } from "lucide-react";
import { WalletSetup } from "./WalletSetup";
import { cn } from "@/lib/utils";

const MAIN_WALLETS: WalletType[] = ["main_cash", "office_safe"];
const OPERATIONAL_WALLETS: WalletType[] = ["cage_slot", "cage_table", "mobile_money", "bank_account"];
const RESERVE_WALLETS: WalletType[] = ["rent_reserve", "license_reserve", "tax_reserve", "other_reserve"];

type Action = "transfer" | "allocate" | "use_reserve" | "income" | "collection";

const ACTIONS: { id: Action; label: string; icon: any; tone?: string }[] = [
  { id: "transfer", label: "Transfer", icon: ArrowRightLeft },
  { id: "allocate", label: "Allocate", icon: PiggyBank },
  { id: "use_reserve", label: "Use Reserve", icon: Wallet },
  { id: "income", label: "Income", icon: ArrowDownToLine, tone: "success" },
  { id: "collection", label: "Collection", icon: ArrowUpFromLine, tone: "destructive" },
];

export const WalletsView = () => {
  const { data: wallets = [], isLoading } = useWallets();
  const [action, setAction] = useState<Action | null>(null);

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

      {/* Action chips */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {ACTIONS.map(a => {
          const Icon = a.icon;
          const active = action === a.id;
          return (
            <Button
              key={a.id}
              variant={active ? "default" : "outline"}
              onClick={() => setAction(active ? null : a.id)}
              className={cn(
                "gap-2 h-auto py-3",
                !active && a.tone === "destructive" && "border-destructive/30 text-destructive hover:bg-destructive/10",
                !active && a.tone === "success" && "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10",
              )}
            >
              <Icon className="w-4 h-4" /> {a.label}
            </Button>
          );
        })}
      </div>

      {/* Inline editor */}
      <InlineEditor open={!!action}>
        {action === "transfer" && <TransferForm onDone={() => setAction(null)} />}
        {action === "allocate" && <AllocateForm onDone={() => setAction(null)} />}
        {action === "use_reserve" && <UseReserveForm onDone={() => setAction(null)} />}
        {action === "income" && <IncomeForm onDone={() => setAction(null)} />}
        {action === "collection" && <CollectionForm onDone={() => setAction(null)} />}
      </InlineEditor>
    </div>
  );
};

const FormHeader = ({ title, onCancel }: { title: string; onCancel: () => void }) => (
  <div className="flex items-center justify-between mb-3">
    <h4 className="text-sm font-semibold">{title}</h4>
    <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
      <X className="w-4 h-4" />
    </Button>
  </div>
);

const TransferForm = ({ onDone }: { onDone: () => void }) => {
  const [from, setFrom] = useState<WalletType>("main_cash");
  const [to, setTo] = useState<WalletType>("office_safe");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();
  const submit = () => create.mutate(
    { tx_type: "transfer", from_wallet: from, to_wallet: to, amount: parseSpacedNumber(amount), description: desc },
    { onSuccess: onDone }
  );
  return (
    <div className="space-y-3">
      <FormHeader title="Transfer Between Wallets" onCancel={onDone} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Select value={from} onValueChange={v => setFrom(v as WalletType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Select value={to} onValueChange={v => setTo(v as WalletType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}</SelectContent>
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
      <Button onClick={submit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Transfer</Button>
    </div>
  );
};

const CategorySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
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
);

const AllocateForm = ({ onDone }: { onDone: () => void }) => {
  const [reserve, setReserve] = useState<WalletType>("rent_reserve");
  const [category, setCategory] = useState<string>("rent");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();
  const submit = () => create.mutate(
    { tx_type: "allocate_reserve", from_wallet: "main_cash", to_wallet: reserve, amount: parseSpacedNumber(amount), expense_category: category as any, description: desc },
    { onSuccess: onDone }
  );
  return (
    <div className="space-y-3">
      <FormHeader title="Allocate to Reserve" onCancel={onDone} />
      <div>
        <label className="text-xs text-muted-foreground">Reserve</label>
        <Select value={reserve} onValueChange={v => setReserve(v as WalletType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{RESERVE_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Budget Category</label>
        <CategorySelect value={category} onChange={setCategory} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Amount (from Main Cash)</label>
        <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
      </div>
      <Button onClick={submit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Allocate</Button>
    </div>
  );
};

const UseReserveForm = ({ onDone }: { onDone: () => void }) => {
  const [reserve, setReserve] = useState<WalletType>("rent_reserve");
  const [category, setCategory] = useState<string>("rent");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();
  const submit = () => create.mutate(
    { tx_type: "use_reserve", from_wallet: reserve, amount: parseSpacedNumber(amount), expense_category: category as any, description: desc },
    { onSuccess: onDone }
  );
  return (
    <div className="space-y-3">
      <FormHeader title="Spend from Reserve" onCancel={onDone} />
      <div>
        <label className="text-xs text-muted-foreground">Reserve</label>
        <Select value={reserve} onValueChange={v => setReserve(v as WalletType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{RESERVE_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Expense Category</label>
        <CategorySelect value={category} onChange={setCategory} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Amount</label>
        <Input className="font-mono" value={amount} onChange={e => setAmount(formatInputWithSpaces(e.target.value))} placeholder="0" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What for?" />
      </div>
      <Button onClick={submit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Spend</Button>
    </div>
  );
};

const IncomeForm = ({ onDone }: { onDone: () => void }) => {
  const [to, setTo] = useState<WalletType>("main_cash");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();
  const submit = () => create.mutate(
    { tx_type: "external_income" as any, to_wallet: to, amount: parseSpacedNumber(amount), description: desc || "External income", business_date: new Date().toISOString().slice(0, 10) },
    { onSuccess: onDone }
  );
  return (
    <div className="space-y-3">
      <FormHeader title="Record External Income" onCancel={onDone} />
      <div>
        <label className="text-xs text-muted-foreground">To Wallet</label>
        <Select value={to} onValueChange={v => setTo(v as WalletType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}</SelectContent>
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
      <p className="text-xs text-muted-foreground">External income increases wallet balance and is included in global reconciliation.</p>
      <Button onClick={submit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full">Record Income</Button>
    </div>
  );
};

const CollectionForm = ({ onDone }: { onDone: () => void }) => {
  const [from, setFrom] = useState<WalletType>("main_cash");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateWalletTransaction();
  const submit = () => create.mutate(
    { tx_type: "collection" as any, from_wallet: from, amount: parseSpacedNumber(amount), description: desc || "Owner collection" },
    { onSuccess: onDone }
  );
  return (
    <div className="space-y-3">
      <FormHeader title="Owner Collection (Withdrawal)" onCancel={onDone} />
      <div>
        <label className="text-xs text-muted-foreground">From Wallet</label>
        <Select value={from} onValueChange={v => setFrom(v as WalletType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MAIN_WALLETS.map(w => <SelectItem key={w} value={w}>{WALLET_LABELS[w]}</SelectItem>)}</SelectContent>
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
      <p className="text-xs text-muted-foreground">Collection is NOT an expense. It reduces cash balance but is not tracked against budget.</p>
      <Button onClick={submit} disabled={create.isPending || !parseSpacedNumber(amount)} className="w-full" variant="destructive">Withdraw</Button>
    </div>
  );
};
