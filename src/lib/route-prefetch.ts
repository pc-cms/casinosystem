/**
 * Eagerly prefetch all lazy-loaded route chunks after a successful login.
 *
 * Why: each route in App.tsx is `React.lazy(() => import(...))`. Those chunks
 * are only downloaded when the user first navigates to that route. If a
 * network outage happens BEFORE the user has visited that route, the dynamic
 * import fails with ChunkLoadError → previously the chunk-recovery code
 * wiped caches and reloaded, dropping the user to Chrome's dinosaur page.
 *
 * Now we warm the cache aggressively (and idle-friendly) right after auth
 * is ready, so 100% of routes are reachable offline after the first online
 * session of the day.
 */

type Loader = () => Promise<unknown>;

// Keep this list in sync with App.tsx's lazy() imports. New routes added there
// MUST also be added here, otherwise they will fail to load offline.
const routeLoaders: Loader[] = [
  () => import("@/pages/Dashboard"),
  () => import("@/pages/PlayerProfile"),
  () => import("@/pages/Cage"),
  () => import("@/pages/Tables"),
  () => import("@/pages/finances/FinancesExpensesPage"),
  () => import("@/pages/Logs"),
  () => import("@/pages/Pit"),
  () => import("@/pages/flat/PitFlat"),
  () => import("@/pages/flat/StaffFlat"),
  () => import("@/pages/Groups"),
  () => import("@/pages/Reports"),
  () => import("@/pages/Admin"),
  () => import("@/pages/Staff"),
  () => import("@/pages/finances/FinancesDashboardPage"),
  () => import("@/pages/finances/FinancesWalletsPage"),
  () => import("@/pages/finances/FinancesDayClosingPage"),
  () => import("@/pages/finances/FinancesMoneyChangePage"),
  () => import("@/pages/finances/FinancesOfficeSafePage"),
  () => import("@/pages/finances/FinancesBudgetPage"),
  () => import("@/pages/finances/FinancesBudgetVsActualPage"),
  () => import("@/pages/finances/FinancesMonthlyReportPage"),
  () => import("@/pages/finances/FinancesExcelImportPage"),
  () => import("@/pages/finances/FinancesAuditLogPage"),
  () => import("@/pages/Reception"),
  () => import("@/pages/Guests"),
  () => import("@/pages/Blacklist"),
  () => import("@/pages/ImportReports"),
  () => import("@/pages/TableResults"),
  () => import("@/pages/BankChecks"),
  () => import("@/pages/MissChips"),
  () => import("@/pages/CancelledTransactions"),
  () => import("@/pages/TableTracker"),
  
  () => import("@/pages/PlayerStatistics"),
  () => import("@/pages/Cashless"),
  () => import("@/pages/Incidents"),
  () => import("@/pages/Incidents"),
  () => import("@/pages/cage/CloseShiftPage"),
  () => import("@/pages/cage/RegisterPlayerPage"),
  () => import("@/pages/cage/EditOpeningChipsPage"),
  () => import("@/pages/cage/CageClosingsPage"),
  () => import("@/pages/cage/CageViewPage"),
  () => import("@/pages/ExpensesApprovals"),
  () => import("@/pages/tables/CloseTablesPage"),
  () => import("@/pages/admin/UserNewPage"),
  () => import("@/pages/admin/UserEditPage"),
  () => import("@/pages/admin/SyncLogPage"),
  () => import("@/pages/WeeklyBonus"),
  () => import("@/pages/MonthlyTips"),
  () => import("@/pages/StaffMaster"),
  () => import("@/pages/AttendanceMonthly"),
  () => import("@/pages/Payroll"),
  () => import("@/pages/payroll/PayrollPeriodPage"),
  () => import("@/pages/payroll/PayrollDashboardPage"),
  () => import("@/pages/payroll/PayrollSettingsPage"),
  () => import("@/pages/payroll/PayrollBankExportPage"),
  () => import("@/pages/NotFound"),
];

const KEY = "cms.routePrefetch.lastRun";
const ONE_DAY = 24 * 60 * 60 * 1000;

function shouldRun(): boolean {
  try {
    const last = Number(localStorage.getItem(KEY) || "0");
    return !last || Date.now() - last > ONE_DAY;
  } catch {
    return true;
  }
}

function markRan() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Schedule each import on requestIdleCallback so we don't compete with
// the user's first interaction. Throttle to 3 concurrent imports.
function idle(cb: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (fn: () => void) => void })
    .requestIdleCallback;
  if (typeof ric === "function") ric(cb);
  else setTimeout(cb, 200);
}

async function runPool(loaders: Loader[], concurrency = 3) {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < loaders.length) {
      const my = idx++;
      try {
        await loaders[my]();
      } catch (e) {
        // Swallow — a missing/renamed chunk is OK during dev; we just skip it.
        console.warn("[prefetch] route chunk failed", e);
      }
    }
  });
  await Promise.all(workers);
}

/**
 * Kick off the prefetch. Safe to call multiple times — runs at most once
 * per 24h per device.
 */
export function prefetchRouteChunks(): void {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) return;
  if (!shouldRun()) return;
  markRan();
  idle(() => {
    void runPool(routeLoaders, 3);
  });
}
