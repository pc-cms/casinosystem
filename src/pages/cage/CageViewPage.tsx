import CageHistoryView from "@/components/cage/CageHistoryView";

/**
 * Read-only Cage history surface.
 *
 * `/cage`     → cashier transactional surface (Cage.tsx, module: `cage`)
 * `/cage/view` → read-only history for managers/finance/pit/surveillance (this page, module: `cage_view`)
 *
 * Splitting them gives two distinct ModuleKeys so the Permission Matrix can grant
 * read-only Cage to a role without granting transactional rights.
 */
const CageViewPage = () => <CageHistoryView />;

export default CageViewPage;
