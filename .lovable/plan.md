
## Реорганизация сайдбара + новая секция STAFF

### Итоговая структура (как просили)

```
OVERVIEW
  Dashboard

PIT
  Break List
  Incidents
  Player Tracking
  Table Check
  Tables Tracking

STAFF                      ← новая секция
  Attendance
  Rota

CASHIER
  Cage View
  Closings
  Bank
  Cashless
  Expenses
  Reports
  Tips & Bonuses

RECEPTION
  Blacklist
  Guests
  Reception

CRM
  Player CRM
```

### Что меняется

1. **PIT** — убирается горизонтальный divider после Table Check; пункты идут по алфавиту: Break List, Incidents, Player Tracking, Table Check, Tables Tracking.
2. **STAFF (новая секция)** — Attendance (`__attendance__` → /attendance/live и т.д.) и Rota (`__rota__` → /rota/live и т.д.) переносятся сюда из PIT. Роли остаются те же (super_admin, manager, floor_manager, pit, finance_manager, surveillance). Раскрытие подпунктов (Live/Floor/Security/Office) сохраняется.
3. **CASHIER** — Closings **возвращается**, порядок ровно как указали: Cage View → Closings → Bank → Cashless → Expenses → Reports → Tips & Bonuses. (Cage Live Game / Cage Slots для кассирских ролей по-прежнему отображаются вместо Cage View.)
4. **RECEPTION** — алфавит: Blacklist, Guests, Reception.
5. **CRM** — без изменений.
6. Остальные секции (FINANCE / HR / ANALYTICS / MARKETING / BAR / SYSTEM) — оставлю в текущем порядке, отдельной сортировки не делаю (они не упомянуты).

### Технические детали

- `src/components/layout/AppSidebar.tsx`:
  - Добавить `"STAFF"` в `Section` type.
  - У `__attendance__` и `__rota__` поменять `section: "PIT"` → `"STAFF"`.
  - Удалить элемент-разделитель `__divider__pit`.
  - В `NAV_ITEMS` переставить пункты CASHIER в требуемом порядке (Cage View → Closings → Bank → Cashless → Expenses → Reports → Tips & Bonuses); PIT-пункты переставить по алфавиту; RECEPTION по алфавиту.
  - В `sectionOrder` вставить `"STAFF"` между `"PIT"` и `"CASHIER"`.
  - В местах рендера секций добавить лейбл "STAFF" (использует ту же логику, что PIT — раскрытие сохраняется через те же `__attendance__` / `__rota__` ключи).
- Без изменений роутов и прав — это чисто визуальная/навигационная перестановка.

Подтверждаете — применю.
