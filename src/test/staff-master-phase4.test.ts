/**
 * Phase 4 regression guard.
 *
 * After the staff-master consolidation, the six operational tables are
 * keyed by `employee_id` only. The legacy `dealer_id` / `staff_id` columns
 * (and the parent `dealers` / `staff_members` tables) no longer exist in the
 * database. These static-source assertions ensure no future code change
 * silently re-introduces legacy keys in:
 *   - SELECT/INSERT/UPSERT payloads
 *   - `onConflict` strings
 *   - direct table joins
 *
 * The only allowed mention of `dealer_id` as a *DB column* is in
 * `breaklist_logs` (audit-only — column kept, FK dropped, stores employees.id).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const LEGACY_TABLES = ["dealers", "staff_members"] as const;

const OPERATIONAL_TABLES = [
  "breaklist",
  "pit_rota",
  "dealer_attendance",
  "staff_rota",
  "staff_attendance",
  "weekly_bonus_entries",
] as const;

const HOOK_FILES = [
  "src/hooks/use-dealers.ts",
  "src/hooks/use-staff.ts",
  "src/hooks/use-weekly-bonus.ts",
  "src/hooks/use-prefetch.ts",
  "src/hooks/use-log-lookups.ts",
  "src/lib/pit-prefetch.ts",
];

describe("Phase 4 — staff master invariants", () => {
  describe("no direct queries to legacy parent tables", () => {
    for (const table of LEGACY_TABLES) {
      it(`no .from("${table}") anywhere in src/ or supabase/functions/`, () => {
        const allFiles = collectFiles([
          path.join(root, "src"),
          path.join(root, "supabase", "functions"),
        ]);
        const offenders: string[] = [];
        const re = new RegExp(`\\.from\\(['"]${table}['"]\\)`);
        for (const f of allFiles) {
          const c = readFileSync(f, "utf8");
          if (re.test(c)) offenders.push(path.relative(root, f));
        }
        expect(offenders, `legacy .from("${table}") found in: ${offenders.join(", ")}`).toEqual([]);
      });
    }
  });

  describe("hook payloads use employee_id, never dealer_id / staff_id", () => {
    for (const file of HOOK_FILES) {
      it(`${file} writes only employee_id to operational tables`, () => {
        const src = read(file);

        const stripped = src
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .split("\n")
          .filter((l) => !l.trim().startsWith("//"))
          .join("\n");

        const badConflict = stripped.match(/onConflict:\s*['"][^'"]*\b(dealer_id|staff_id)\b[^'"]*['"]/g);
        expect(badConflict, `legacy onConflict in ${file}: ${badConflict?.join(", ")}`).toBeNull();

        const lines = stripped.split("\n");
        const offenders: string[] = [];
        lines.forEach((line, i) => {
          const m = line.match(/\b(dealer_id|staff_id)\s*:\s*([^,;}\s]+)/);
          if (!m) return;
          const value = m[2];
          if (/^(string|number|boolean|null|any|unknown)/.test(value)) return;
          // Pure aliasing: `dealer_id: r.employee_id` — value derived from employee_id.
          if (/employee_id\b/.test(value)) return;
          if (/\bmeta\s*:/.test(line)) return;
          // Read-side alias / optimistic-cache rows always pair the legacy
          // alias with `employee_id:` on the same object literal. A real DB
          // payload never needs both, so when both are present this is a
          // client-only shape (cache row, log lookup) and safe.
          if (/\bemployee_id\s*:/.test(line)) return;
          if (/breaklist_logs/.test(line) || /breaklist_logs/.test(lines[i - 1] ?? "")) return;
          const window = lines.slice(Math.max(0, i - 8), i).join("\n");
          if (/breaklist_logs/.test(window)) return;
          // React Query cache patches / optimistic updates are in-memory only,
          // not DB writes. Skip when surrounding window is clearly cache code.
          if (/setQueryData|getQueryData|cancelQueries|onMutate|BonusEntry/.test(window)) return;
          offenders.push(`L${i + 1}: ${line.trim()}`);
        });
        expect(offenders, `legacy id key written in ${file}:\n  ${offenders.join("\n  ")}`).toEqual([]);
      });
    }
  });

  describe("hook payloads explicitly carry employee_id", () => {
    const expectations: Array<{ file: string; needles: string[] }> = [
      {
        file: "src/hooks/use-dealers.ts",
        needles: [
          'employee_id: input.dealer_id',
          'employee_id: dealer_id',
        ],
      },
      {
        file: "src/hooks/use-staff.ts",
        needles: ["employee_id: staff_id"],
      },
      {
        file: "src/hooks/use-weekly-bonus.ts",
        needles: ["employee_id"],
      },
    ];
    for (const { file, needles } of expectations) {
      it(`${file} contains employee_id in writes`, () => {
        const src = read(file);
        for (const needle of needles) {
          expect(src.includes(needle), `missing "${needle}" in ${file}`).toBe(true);
        }
      });
    }
  });

  describe("operational reads filter/select on employee_id only", () => {
    for (const table of OPERATIONAL_TABLES) {
      it(`no .eq("dealer_id" / "staff_id", …) on ${table}`, () => {
        const allFiles = collectFiles([path.join(root, "src")]);
        const offenders: string[] = [];
        for (const f of allFiles) {
          const c = readFileSync(f, "utf8");
          const fromRe = new RegExp(`\\.from\\(['"]${table}['"]\\)([\\s\\S]{0,600})`);
          const m = c.match(fromRe);
          if (!m) continue;
          if (/\.eq\(['"](dealer_id|staff_id)['"]/.test(m[1])) {
            offenders.push(path.relative(root, f));
          }
        }
        expect(offenders, `${table} read filters by legacy id in: ${offenders.join(", ")}`).toEqual([]);
      });
    }
  });
});

function collectFiles(roots: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        out.push(p);
      }
    }
  };
  roots.forEach(walk);
  return out;
}
