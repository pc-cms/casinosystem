## Plan

1. **Backfill employee first names now**
   - Copy the first word from each employee’s current `full_name` into `employees.first_name` where `first_name` is empty.
   - Keep the current value in `last_name` as-is so you can manually redistribute surname/name later in Staff Master.

2. **Fix Monthly Attendance backend function**
   - Update `get_monthly_attendance` so it no longer references removed legacy fields `employees.staff_member_id` and `employees.dealer_id`.
   - Read attendance directly by `employee_id` from `staff_attendance` and `dealer_attendance`.
   - This is the direct cause of the empty/broken Monthly Attendance screen.

3. **Make new Staff Master entries safe**
   - When a new employee/dealer/staff member is created with only one name field, automatically seed `first_name` from the first word.
   - Keep duplicate-name display logic: if two first names match, show first name + surname initial/prefix in Rota, Breaklist, and Attendance.

4. **Clean stale frontend types only where needed**
   - Remove/avoid old `staff_member_id` and `dealer_id` assumptions from employee typing/UI paths that now use `employee_id`.
   - Keep compatibility aliases only inside hooks where existing screens still expect `dealer_id`/`staff_id` props.

## Technical details

- Database change: one migration for the RPC fix and trigger/backfill behavior.
- Data change: one safe update to populate `first_name` for existing employees.
- Frontend change: small hook adjustments in employee/dealer/staff create/update paths if needed.
- Validation: re-run read queries against `get_monthly_attendance`, and confirm Rota/Attendance source tables still contain rows.