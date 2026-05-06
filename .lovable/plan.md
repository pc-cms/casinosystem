## Incidents page — date control cleanup

**File:** `src/pages/Incidents.tsx`

### 1. Remove the −1 button
In the draft row's date cell (lines ~310-321), remove the `<button>` "−1" and the wrapping `flex` div. Leave only the `<Input type="date">` for `form.incident_date`.

### 2. Add day navigator to PageHeader
Pass a `centerSlot` to `<PageHeader>` containing:

```
[◀]  YYYY-MM-DD  [▶]  [Today]
```

- `◀` / `▶` = `Button variant="ghost" size="icon-sm"` with `ChevronLeft` / `ChevronRight` — shift `form.incident_date` by −1 / +1 day via `setF("incident_date", ...)`.
- Middle: `<Input type="date" value={form.incident_date} onChange=…>` (compact, `h-9 w-44 font-mono`) so user can also pick directly.
- `Today` button (outline, `h-7 text-[10px]`) shown only when `form.incident_date !== todayDate()` — resets to today.
- Max date = today (no future dates); no min limit (incidents can be backdated).

This mirrors the existing pattern in `CageHistoryView.tsx` (`dateControl` element).

### 3. Keep the existing draft date input
The draft row still shows the same date input bound to the same `form.incident_date`, so header arrows and the row input stay in sync automatically (single source of truth).

### Notes
- CCTV/Surveillance already has full insert access — no permission changes needed.
- No new imports beyond `ChevronLeft`, `ChevronRight` from `lucide-react` (already used elsewhere; verify import line in Incidents.tsx and add if missing).
