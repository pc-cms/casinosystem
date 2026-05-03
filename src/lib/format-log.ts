// Human-readable formatter for activity_logs entries.
// Translates raw `action` + `details` JSON into a friendly sentence.
// Lookup maps (dealers/players/tables/users) are passed in so the caller
// resolves UUIDs in a single batched query.

export type NameMap = Record<string, string>;

export interface LogLookups {
  dealers?: NameMap;   // dealer_id -> "Elia"
  players?: NameMap;   // player_id -> "John D."
  tables?: NameMap;    // table_id  -> "BJ-1"
  users?: NameMap;     // user_id   -> "Manager Name"
}

const SHIFT_LABELS: Record<string, string> = {
  M: "Morning", N: "Night", E: "Evening", L: "Late",
  S: "Stand-by", X: "Off",
};

const ACTION_LABELS: Record<string, string> = {
  ROTA_SET: "Rota updated",
  CELL_SET: "Breaklist cell set",
  PLAYER_CHECKED_IN: "Player checked in",
  PLAYER_CHECKED_OUT: "Player checked out",
  PLAYER_CREATED: "Player created",
  PLAYER_SEATED: "Player seated",
  PLAYER_BLACKLISTED: "Player blacklisted",
  PLAYER_EXIT_CONFIRMED: "Player exit confirmed",
  CHANGE_PLAYER_STATUS: "Player status changed",
  STATUS_CHANGED: "Status changed",
  CHIP_COUNT_RECORDED: "Chip count recorded",
  TAG_ADDED: "Tag added",
  TAG_REMOVED: "Tag removed",
  MANAGER_ACCESS_ACTIVATE: "Manager access activated",
  TABLE_ARCHIVED: "Table archived",
  TABLE_RESTORED: "Table restored",
  TABLES_OPENED: "Tables opened",
  TABLES_CLOSED_BY_CASHIER: "Tables closed by cashier",
  TABLE_RESULTS_SET: "Table results set",
  SHIFT_OPENED: "Shift opened",
  SHIFT_CLOSED: "Shift closed",
  EXPENSE_CREATED: "Expense created",
  EXPENSE_APPROVED: "Expense approved",
  APPROVE_EXPENSE: "Expense approved",
  CASHLESS_CREATED: "Cashless created",
  CHIP_CONSERVATION_MODE_CHANGE: "Chip conservation mode changed",
  FLOAT_LOCKED: "Float locked",
  OPEN_SHIFT_CHIPS_EDIT_UNLOCKED: "Opening chips edit unlocked",
  ROLE_REMOVED: "Role removed",
  IN: "Chip IN",
  OUT: "Chip OUT",
  session_auto_closed: "Session auto-closed",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());
}

const fmtDate = (s?: string) => {
  if (!s) return "";
  // Accept "YYYY-MM-DD" or ISO; show "DD MMM"
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const dealerName = (id: string | null | undefined, look: LogLookups) =>
  id ? (look.dealers?.[id] ?? `Dealer ${id.slice(0, 6)}`) : "";
const playerName = (id: string | null | undefined, look: LogLookups) =>
  id ? (look.players?.[id] ?? `Player ${id.slice(0, 6)}`) : "";
const tableName = (id: string | null | undefined, look: LogLookups) =>
  id ? (look.tables?.[id] ?? `Table ${id.slice(0, 6)}`) : "";

export function formatLogDetails(
  action: string,
  details: any,
  look: LogLookups = {},
): string {
  if (!details || typeof details !== "object") return details ? String(details) : "";

  const d = details as Record<string, any>;

  switch (action) {
    case "ROTA_SET": {
      const shift = d.shift ? (SHIFT_LABELS[d.shift] ?? d.shift) : "";
      return `${dealerName(d.dealer_id, look)} → ${shift || "—"} on ${fmtDate(d.date)}`;
    }
    case "CELL_SET": {
      const role = d.role ?? "—";
      const slot = d.time_slot ?? "—";
      const tbl = d.table_id ? ` @ ${tableName(d.table_id, look)}` : "";
      return `${dealerName(d.dealer_id, look)} → ${role} at ${slot}${tbl} (${fmtDate(d.date)})`;
    }
    case "PLAYER_CHECKED_IN":
    case "PLAYER_CHECKED_OUT":
    case "PLAYER_CREATED":
    case "PLAYER_BLACKLISTED":
    case "PLAYER_EXIT_CONFIRMED": {
      const name = playerName(d.player_id, look) || d.full_name || d.name;
      const extra = d.reason ? ` · ${d.reason}` : "";
      return `${name}${extra}`;
    }
    case "PLAYER_SEATED": {
      return `${playerName(d.player_id, look)} → ${tableName(d.table_id, look)}${d.seat ? ` seat ${d.seat}` : ""}`;
    }
    case "STATUS_CHANGED":
    case "CHANGE_PLAYER_STATUS": {
      const name = playerName(d.player_id, look);
      return `${name}: ${d.from ?? "?"} → ${d.to ?? d.status ?? "?"}`;
    }
    case "TAG_ADDED":
    case "TAG_REMOVED": {
      return `${playerName(d.player_id, look)} · ${d.tag ?? ""}`;
    }
    case "TABLE_ARCHIVED":
    case "TABLE_RESTORED":
    case "TABLE_RESULTS_SET": {
      return `${tableName(d.table_id, look)}${d.result != null ? ` · result ${d.result}` : ""}`;
    }
    case "TABLES_OPENED":
    case "TABLES_CLOSED_BY_CASHIER": {
      const ids: string[] = d.table_ids ?? [];
      if (ids.length) return ids.map(id => tableName(id, look)).join(", ");
      return d.count ? `${d.count} tables` : "";
    }
    case "SHIFT_OPENED":
    case "SHIFT_CLOSED": {
      const sh = d.shift ? (SHIFT_LABELS[d.shift] ?? d.shift) : "";
      return [sh, fmtDate(d.date)].filter(Boolean).join(" · ");
    }
    case "EXPENSE_CREATED":
    case "EXPENSE_APPROVED":
    case "APPROVE_EXPENSE":
    case "CASHLESS_CREATED": {
      const amt = d.amount != null ? `${d.amount} ${d.currency ?? ""}`.trim() : "";
      return [d.category, d.description, amt].filter(Boolean).join(" · ");
    }
    case "IN":
    case "OUT": {
      const amt = d.amount != null ? `${d.amount} ${d.currency ?? ""}`.trim() : "";
      return [playerName(d.player_id, look), amt].filter(Boolean).join(" · ");
    }
    case "MANAGER_ACCESS_ACTIVATE": {
      return d.reason ?? "Override granted";
    }
    case "ROLE_REMOVED": {
      return `${look.users?.[d.user_id] ?? d.user_id ?? ""} · ${d.role ?? ""}`;
    }
    case "CHIP_COUNT_RECORDED": {
      return [tableName(d.table_id, look), d.shift && (SHIFT_LABELS[d.shift] ?? d.shift)].filter(Boolean).join(" · ");
    }
    case "FLOAT_LOCKED":
    case "OPEN_SHIFT_CHIPS_EDIT_UNLOCKED":
    case "CHIP_CONSERVATION_MODE_CHANGE": {
      return Object.entries(d)
        .filter(([k]) => !["casino_id"].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    }
  }

  // Fallback: pretty key:value list, resolving common UUID fields.
  return Object.entries(d)
    .filter(([_, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      if (k === "dealer_id") return `dealer: ${dealerName(String(v), look)}`;
      if (k === "player_id") return `player: ${playerName(String(v), look)}`;
      if (k === "table_id")  return `table: ${tableName(String(v), look)}`;
      if (k === "date")      return `date: ${fmtDate(String(v))}`;
      if (k === "shift")     return `shift: ${SHIFT_LABELS[String(v)] ?? v}`;
      return `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
    })
    .join(" · ");
}
