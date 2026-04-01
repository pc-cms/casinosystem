import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, Unlock, ChevronLeft, ChevronRight, Plus, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatNumberSpaces } from "@/lib/currency";
import { BudgetCategories } from "./BudgetCategories";
import {
  useBudgetCategories, useBudgetPeriod, useCreateBudgetPeriod,
  useToggleBudgetLock, useBudgetItems, useCreateBudgetItem,
  useUpdateBudgetItem, PARENT_GROUP_LABELS, type BudgetCategory, type BudgetItem,
} from "@/hooks/use-budget";

export const BudgetPlanning = () => {
  const { hasRole } = useAuth();
  const isFinanceManager = hasRole("finance_manager");

  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data: categories = [] } = useBudgetCategories();
  const { data: period } = useBudgetPeriod(currentMonth);
  const createPeriod = useCreateBudgetPeriod();
  const toggleLock = useToggleBudgetLock();
  const { data: items = [] } = useBudgetItems(period?.id);
  const createItem = useCreateBudgetItem();
  const updateItem = useUpdateBudgetItem();

  const [newItem, setNewItem] = useState({
    category_id: "", item_name: "", logic_type: "direct_expense" as const, monthly_amount: "",
  });

  const canEdit = period && !period.is_locked;

  const navMonth = (dir: number) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = currentMonth.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
  }, [currentMonth]);

  const categoryMap = useMemo(() => {
    const m: Record<string, BudgetCategory> = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, BudgetItem[]> = {};
    items.forEach(item => {
      const cat = categoryMap[item.category_id];
      const group = cat?.parent_group || "other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  }, [items, categoryMap]);

  const totalPlanned = items.reduce((s, i) => s + Number(i.monthly_amount), 0);
  const totalActual = items.reduce((s, i) => s + Number(i.actual_amount), 0);
  const totalReserved = items.filter(i => i.logic_type === "reserve").reduce((s, i) => s + Number(i.reserved_amount), 0);
  const totalReserveRequired = items.filter(i => i.logic_type === "reserve").reduce((s, i) => s + Number(i.monthly_amount), 0);
  const variance = totalActual - totalPlanned;
  const completionPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const handleAddItem = () => {
    if (!period || !newItem.category_id || !newItem.item_name || !newItem.monthly_amount) return;
    createItem.mutate({
      period_id: period.id,
      category_id: newItem.category_id,
      item_name: newItem.item_name,
      logic_type: newItem.logic_type,
      monthly_amount: Number(newItem.monthly_amount),
    }, {
      onSuccess: () => setNewItem({ category_id: "", item_name: "", logic_type: "direct_expense", monthly_amount: "" }),
    });
  };

  const handleInlineUpdate = (item: BudgetItem, field: string, value: any) => {
    if (!period) return;
    const updates: Record<string, any> = { [field]: value };
    // Auto-calculate status based on logic type
    if (field === "actual_amount" || field === "reserved_amount" || field === "monthly_amount") {
      const monthly = Number(field === "monthly_amount" ? value : item.monthly_amount);
      if (item.logic_type === "reserve") {
        const reserved = Number(field === "reserved_amount" ? value : item.reserved_amount);
        const actual = Number(field === "actual_amount" ? value : item.actual_amount);
        if (reserved >= monthly && actual >= monthly) updates.status = "completed";
        else if (reserved > 0 || actual > 0) updates.status = "in_progress";
        else updates.status = "planned";
      } else {
        const actual = Number(field === "actual_amount" ? value : item.actual_amount);
        if (actual >= monthly) updates.status = "completed";
        else if (actual > 0) updates.status = "in_progress";
        else updates.status = "planned";
      }
    }
    updateItem.mutate({ id: item.id, periodId: period.id, ...updates });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      planned: "bg-muted text-muted-foreground",
      in_progress: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
      completed: "bg-green-500/20 text-green-700 dark:text-green-400",
    };
    return <Badge className={styles[status] || ""}>{status.replace("_", " ")}</Badge>;
  };

  // No period yet — offer to create
  if (!period) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-lg font-semibold text-foreground">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => navMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No budget created for {monthLabel}</p>
            <Button onClick={() => createPeriod.mutate(currentMonth)} disabled={createPeriod.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Create Budget
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-lg font-semibold text-foreground">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => navMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
          <Badge variant={period.is_locked ? "destructive" : "secondary"} className="ml-2">
            {period.is_locked ? <><Lock className="w-3 h-3 mr-1" />Locked</> : <><Unlock className="w-3 h-3 mr-1" />Unlocked</>}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isFinanceManager && (
            <Button
              variant="outline" size="sm"
              onClick={() => toggleLock.mutate({ periodId: period.id, lock: !period.is_locked })}
              disabled={toggleLock.isPending}
            >
              {period.is_locked ? "Unlock" : "Lock"}
            </Button>
          )}
          {isFinanceManager && <BudgetCategories />}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Monthly Budget</p>
          <p className="text-xl font-bold font-mono text-foreground">{formatNumberSpaces(totalPlanned)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Actual Expenses</p>
          <p className="text-xl font-bold font-mono text-foreground">{formatNumberSpaces(totalActual)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Variance</p>
          <p className={`text-xl font-bold font-mono ${variance > 0 ? "text-destructive" : "text-green-500"}`}>
            {formatNumberSpaces(variance)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Break-even</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{formatNumberSpaces(totalPlanned)}</p>
          <p className="text-[10px] text-muted-foreground">Min. required income</p>
        </CardContent></Card>
      </div>

      {/* Reserve coverage */}
      {totalReserveRequired > 0 && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Reserve Coverage</p>
              <p className="text-sm font-mono text-foreground">
                {formatNumberSpaces(totalReserved)} / {formatNumberSpaces(totalReserveRequired)}
              </p>
            </div>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, totalReserveRequired > 0 ? (totalReserved / totalReserveRequired) * 100 : 0)}%` }}
              />
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Budget table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Yearly</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Diff</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(PARENT_GROUP_LABELS).flatMap(([group, label]) => {
                const groupItems = groupedItems[group];
                if (!groupItems?.length) return [];
                return [
                  <TableRow key={`g-${group}`} className="bg-muted/30">
                    <TableCell colSpan={9} className="font-semibold text-xs uppercase tracking-wider text-foreground">
                      {label}
                    </TableCell>
                  </TableRow>,
                  ...groupItems.map(item => {
                    const cat = categoryMap[item.category_id];
                    const diff = Number(item.actual_amount) - Number(item.monthly_amount);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-muted-foreground">{cat?.name || "—"}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          {canEdit ? (
                            <Input
                              className="h-7 text-sm"
                              defaultValue={item.item_name}
                              onBlur={e => {
                                if (e.target.value !== item.item_name) handleInlineUpdate(item, "item_name", e.target.value);
                              }}
                            />
                          ) : item.item_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {item.logic_type === "reserve" ? "RES" : "DIR"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {canEdit ? (
                            <Input
                              type="number" className="h-7 text-sm text-right w-24 ml-auto"
                              defaultValue={item.monthly_amount}
                              onBlur={e => {
                                const v = Number(e.target.value);
                                if (v !== Number(item.monthly_amount)) handleInlineUpdate(item, "monthly_amount", v);
                              }}
                            />
                          ) : formatNumberSpaces(item.monthly_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatNumberSpaces(Number(item.monthly_amount) * 12)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {canEdit ? (
                            <Input
                              type="number" className="h-7 text-sm text-right w-24 ml-auto"
                              defaultValue={item.actual_amount}
                              onBlur={e => {
                                const v = Number(e.target.value);
                                if (v !== Number(item.actual_amount)) handleInlineUpdate(item, "actual_amount", v);
                              }}
                            />
                          ) : formatNumberSpaces(item.actual_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.logic_type === "reserve" ? (
                            canEdit ? (
                              <Input
                                type="number" className="h-7 text-sm text-right w-24 ml-auto"
                                defaultValue={item.reserved_amount}
                                onBlur={e => {
                                  const v = Number(e.target.value);
                                  if (v !== Number(item.reserved_amount)) handleInlineUpdate(item, "reserved_amount", v);
                                }}
                              />
                            ) : formatNumberSpaces(item.reserved_amount)
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${diff > 0 ? "text-destructive" : diff < 0 ? "text-green-500" : ""}`}>
                          {formatNumberSpaces(diff)}
                        </TableCell>
                        <TableCell>{statusBadge(item.status)}</TableCell>
                      </TableRow>
                    );
                  }),
                ];
              })}
              {/* Totals */}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={3} className="text-foreground">TOTAL</TableCell>
                <TableCell className="text-right font-mono text-foreground">{formatNumberSpaces(totalPlanned)}</TableCell>
                <TableCell className="text-right font-mono text-foreground">{formatNumberSpaces(totalPlanned * 12)}</TableCell>
                <TableCell className="text-right font-mono text-foreground">{formatNumberSpaces(totalActual)}</TableCell>
                <TableCell className="text-right font-mono text-foreground">{formatNumberSpaces(totalReserved)}</TableCell>
                <TableCell className={`text-right font-mono ${variance > 0 ? "text-destructive" : "text-green-500"}`}>
                  {formatNumberSpaces(variance)}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-foreground">{completionPct}%</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add item form */}
      {canEdit && categories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Add Budget Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-end">
              <Select value={newItem.category_id} onValueChange={v => setNewItem(p => ({ ...p, category_id: v }))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="Item name" className="w-40"
                value={newItem.item_name}
                onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
              />
              <Select value={newItem.logic_type} onValueChange={(v: any) => setNewItem(p => ({ ...p, logic_type: v }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_expense">Direct</SelectItem>
                  <SelectItem value="reserve">Reserve</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number" placeholder="Monthly amount" className="w-36"
                value={newItem.monthly_amount}
                onChange={e => setNewItem(p => ({ ...p, monthly_amount: e.target.value }))}
              />
              <Button onClick={handleAddItem} disabled={createItem.isPending} size="sm">
                <Plus className="w-4 h-4 mr-1" />Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canEdit && categories.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Create categories first to add budget items</p>
            {isFinanceManager && <BudgetCategories />}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
