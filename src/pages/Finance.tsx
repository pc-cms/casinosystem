import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { DailyReview } from "@/components/finance/DailyReview";
import { WalletsView } from "@/components/finance/WalletsView";
import { FinanceExpenses } from "@/components/finance/FinanceExpenses";
import { BudgetPlanning } from "@/components/finance/BudgetPlanning";
import { CashCount } from "@/components/finance/CashCount";

const Finance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "dashboard";

  const setTab = (t: string) => {
    setSearchParams({ tab: t });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financial Control</h1>
        <p className="text-sm text-muted-foreground">Office-level cash flow management</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="review">Daily Review</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><FinanceDashboard /></TabsContent>
        <TabsContent value="review"><DailyReview /></TabsContent>
        <TabsContent value="wallets"><WalletsView /></TabsContent>
        <TabsContent value="expenses"><FinanceExpenses /></TabsContent>
        <TabsContent value="budget"><BudgetPlanning /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Finance;
