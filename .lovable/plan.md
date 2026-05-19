## Что не так сейчас
В Мбее уже есть: 10 закрытых смен, 16 закрытий бизнес-дня, 105 игроков, 730 транзакций.
**Не хватает**, поэтому экраны выглядят пустыми и кликать нечего:
- 0 сотрудников (у Аруши — 65)
- 0 Pit Rota / Staff Rota (у Аруши ~1038 / ~1249 строк)
- 0 Dealer Attendance (у Аруши 690)

Также Pasha — `manager`, и для полноценной кассы нужна роль `cashier` (касса = модуль Cage, требует cashier).

## План

### 1. Расширить `clone_arusha_to_mbeya_demo()` — доклонировать
- **employees** — все 65 сотрудников Аруши → Мбея (новые UUID, тот же набор полей, `casino_id = Mbeya`). Маппинг `arusha_emp_id → mbeya_emp_id` в temp table.
- **employee_bank_accounts** — за компанию (через маппинг).
- **pit_rota** — все записи Аруши за период 10–19 мая 2026 → Мбея, через маппинг сотрудников, `created_by = Pasha`.
- **staff_rota** — то же самое за тот же период.
- **dealer_attendance** — за тот же период через маппинг.
- **attendance_hours / staff_attendance** — если есть данные у Аруши за период, тоже скопировать.
- Всё пишется в `demo_seed_log` для аккуратного wipe.

### 2. Расширить роли Pasha
Добавить `cashier` и `pit` к существующему `manager` → полноценно работает Cage (касса), Live Game, графики, закрытие дня.

### 3. Расширить `purge_mbeya_demo()`
Чтобы при удалении сносились также employees / rotas / attendance / bank_accounts по `demo_seed_log`.

## Изоляция от Аруши — гарантии
1. SQL только `SELECT … FROM <table> WHERE casino_id = Arusha` — **ни одного INSERT/UPDATE/DELETE по Аруше**.
2. У всех вставляемых строк `casino_id = Mbeya` жёстко прописано.
3. RLS и хуки фронта фильтруют по `useCasino().activeCasinoId` — Pasha залогинен только на `mbeya.casinosystem.app`, его токен в `user_casino_access` привязан **только к Mbeya**, физически не сможет писать в Арушу.
4. Каждая вставленная строка логируется в `demo_seed_log` → `purge_mbeya_demo()` удалит ровно их по UUID, без шансов задеть чужое.
5. После клика «Wipe» в Аруше сравнить counts до/после — они не изменятся.

## Технические детали
- `SET LOCAL session_replication_role = 'replica'` — чтобы триггеры не пересчитывали ничего при вставке клонов.
- Период ротации/посещаемости: те же 2026-05-10 … 2026-05-19, что и смены.
- `created_by` / `recorded_by` = id Pasha (вытащим через `auth.users` по email).
- Если в Аруше нет каких-то записей за период (например, нет staff_attendance) — пропускаем без ошибки.

После Implement → залогиниться `pasha@demo.local` / `Pasha26!` на `mbeya.casinosystem.app` → Personnel / Rota / Attendance / Cage заполнены, всё кликабельно.