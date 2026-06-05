/**
 * SafeInsert types — TypeScript guards that block client code from sending
 * server-computed or trigger-controlled fields to immutable tables.
 *
 * These mirror the DB-side rules:
 *   - transactions / wallet_transactions / expenses / cage_transfers /
 *     chip_emissions / miss_chips / activity_logs are immutable (no UPDATE/DELETE)
 *   - timestamps, ids and audit columns must be set by the database
 *   - balance / discrepancy / inventory deltas are computed by triggers
 *
 * Use these types in hooks instead of raw `Database["public"]["Tables"][T]["Insert"]`.
 */
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

/** Fields the database always controls — never send from client. */
type ServerManaged = "id" | "created_at" | "updated_at";

/** transactions: immutable; only operator-supplied fields allowed. */
export type SafeTransactionInsert = Omit<
  T["transactions"]["Insert"],
  ServerManaged
>;

/** fin_wallet_tx: immutable ledger; balance derived from sum of rows. */
export type SafeWalletTxInsert = Omit<
  T["fin_wallet_tx"]["Insert"],
  ServerManaged
>;

/** expenses: immutable on creation (approval is a separate UPDATE). */
export type SafeExpenseInsert = Omit<
  T["expenses"]["Insert"],
  ServerManaged | "approved" | "approved_by" | "approved_at"
>;

/**
 * cage_transfers: immutable; chip inventory delta is trigger-driven.
 * `direction` is derived from `transfer_type` server-side validator, but UI
 * still passes it for clarity — left allowed.
 */
export type SafeCageTransferInsert = Omit<
  T["cage_transfers"]["Insert"],
  ServerManaged
>;

/**
 * bank_checks: `expected_balance`, `discrepancy`, `is_balanced` are computed
 * by the `bank_check_compute` BEFORE-INSERT trigger. UI must never send them.
 */
export type SafeBankCheckInsert = Omit<
  T["bank_checks"]["Insert"],
  ServerManaged | "expected_balance" | "discrepancy" | "is_balanced"
>;

/**
 * bank_checks UPDATE: same trigger-computed fields are forbidden, plus the
 * audit columns (`casino_id`, `created_by`) which must never change.
 */
export type SafeBankCheckUpdate = Omit<
  T["bank_checks"]["Update"],
  ServerManaged | "expected_balance" | "discrepancy" | "is_balanced" | "casino_id" | "created_by"
>;

/** chip_emissions: immutable; baseline mutation is trigger-driven. */
export type SafeChipEmissionInsert = Omit<
  T["chip_emissions"]["Insert"],
  ServerManaged
>;

/** miss_chips: REMOVED — table dropped. Miss is now stored in shifts.closing_count.chip_miss_total. */
export type SafeMissChipInsert = never;

/** activity_logs: write via DB trigger or logAction helper only. */
export type SafeActivityLogInsert = Omit<
  T["activity_logs"]["Insert"],
  ServerManaged
>;

