import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { DailyReview } from "@/components/finance/DailyReview";
import { WalletsView } from "@/components/finance/WalletsView";
import { FinanceExpenses } from "@/components/finance/FinanceExpenses";
import { BudgetPlanning } from "@/components/finance/BudgetPlanning";
import { CashCount } from "@/components/finance/CashCount";
import { SummaryDashboard } from "@/components/finance/SummaryDashboard";
import InterCasinoTransfers from "@/components/finance/InterCasinoTransfers";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";

const Finance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles } = useAuth();
  const { isSummaryMode } = useCasino();
  const isFMOrAdmin = roles.includes("finance_manager") || roles.includes("super_admin");
  const tab = searchParams.get("tab") || (isSummaryMode ? "summary" : "dashboard");

  const setTab = (t: string) => {
    setSearchParams({ tab: t });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financial Control</h1>
        <p className="text-sm text-muted-foreground">
          {isSummaryMode ? "Cross-casino financial overview" : "Office-level cash flow management"}
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {isFMOrAdmin && <TabsTrigger value="summary">Summary</TabsTrigger>}
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="review">Daily Review</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="cashcount">Cash Count</TabsTrigger>
          {isFMOrAdmin && <TabsTrigger value="transfers">Transfers</TabsTrigger>}
        </TabsList>
        {isFMOrAdmin && <TabsContent value="summary"><SummaryDashboard /></TabsContent>}
        <TabsContent value="dashboard"><FinanceDashboard /></TabsContent>
        <TabsContent value="review"><DailyReview /></TabsContent>
        <TabsContent value="wallets"><WalletsView /></TabsContent>
        <TabsContent value="expenses"><FinanceExpenses /></TabsContent>
        <TabsContent value="budget"><BudgetPlanning /></TabsContent>
        <TabsContent value="cashcount"><CashCount /></TabsContent>
        {isFMOrAdmin && <TabsContent value="transfers"><InterCasinoTransfers /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default Finance;
