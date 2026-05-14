/**
 * Single source of truth for invalidating every cache that derives from the
 * `employees` table. After Phase 3, three React Query keys read the same rows
 * with different shapes:
 *   - ["employees"]      — raw rows (Payroll / Staff Master)
 *   - ["dealers"]        — normalized DealerRow (Pit / Live Game)
 *   - ["staff_members"]  — normalized StaffMember (Floor / Security / Office)
 *
 * Any mutation that touches `employees` MUST invalidate all three; otherwise
 * Pit/Staff/Payroll views drift apart until a hard refresh.
 */
import type { QueryClient } from "@tanstack/react-query";

export const invalidateEmployeeCaches = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ["employees"] });
  qc.invalidateQueries({ queryKey: ["dealers"] });
  qc.invalidateQueries({ queryKey: ["staff_members"] });
};
