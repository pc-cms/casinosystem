/**
 * Disambiguate first names within a group: when two people share the same first name,
 * append "<initial>" of the last name (extending letters until unique).
 * Example: two "Berta" → "Berta K", "Berta M". Three "Ann L*" → "Ann Le", "Ann Li", "Ann L".
 */
export interface NameInput {
  id: string;
  first: string;
  last: string;
}

export function buildDisplayNames(items: NameInput[]): Map<string, string> {
  const out = new Map<string, string>();
  const groups = new Map<string, NameInput[]>();
  for (const it of items) {
    const key = (it.first || "").trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  for (const [, group] of groups) {
    if (group.length <= 1) {
      for (const g of group) out.set(g.id, g.first);
      continue;
    }
    // Disambiguate by lengthening last-name prefix until unique.
    const suffixes = new Map<string, string>(); // id → suffix
    let len = 1;
    let pending = group.slice();
    while (pending.length > 0 && len <= 12) {
      const byPrefix = new Map<string, NameInput[]>();
      for (const p of pending) {
        const pref = (p.last || "").trim().slice(0, len).toUpperCase() || "?";
        if (!byPrefix.has(pref)) byPrefix.set(pref, []);
        byPrefix.get(pref)!.push(p);
      }
      const next: NameInput[] = [];
      for (const [pref, arr] of byPrefix) {
        if (arr.length === 1) suffixes.set(arr[0].id, pref);
        else next.push(...arr);
      }
      pending = next;
      len++;
    }
    // Anything still ambiguous gets the longest available prefix (or "?").
    for (const p of pending) {
      suffixes.set(p.id, (p.last || "?").trim().toUpperCase() || "?");
    }
    for (const g of group) {
      const suf = suffixes.get(g.id);
      out.set(g.id, suf ? `${g.first} ${suf}` : g.first);
    }
  }
  return out;
}

/** Split "First Last Last2" → { first, last } using the first whitespace token as first name. */
export function splitFullName(full: string | null | undefined): { first: string; last: string } {
  const s = (full || "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
