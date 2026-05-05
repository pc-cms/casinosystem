
# Modal Redesign — финальный план (v3)

## Стратегия — 4 паттерна

| Паттерн | Когда | Пример |
|---|---|---|
| **Full Page Route (multi-step)** | Любой процесс закрытия / регистрации, длинная форма | Close Shift, Close Table, Register Player, User Editor |
| **Inline Panel / Row** | Действие в контексте таблицы / карточки | Add expense, Edit budget category, Adjust float, Seat player |
| **Sticky Preview Header** *(новое)* | Быстрый просмотр сущности из списка без перехода | Player в Players list, в Active Players, в Blacklist, в Group members |
| **Dialog (минимум)** | Только confirm и микро-формы 1-3 поля | Logout, Override, Delete, Chip Emission, Push Update |

## Sticky Preview Header — для игроков (новое)

Вместо открытия модалки/страницы при клике на игрока в любом списке:

```text
┌──────────────────────────────────────────────────────────┐
│  [Photo]  John Doe   #CMS123   D · TZS  ★ Flags  Tags   │
│           Last visit · Lifetime NEP · Drop · Visits       │
│                                  [Open profile →] [✕]     │
├──────────────────────────────────────────────────────────┤
│  Players list (продолжает работать, можно кликать дальше) │
└──────────────────────────────────────────────────────────┘
```

Поведение:
- Клик по строке игрока → header «прилипает» сверху списка (sticky), прокрутка списка не блокируется.
- Кликаешь следующего → header обновляется, без закрытия/открытия. Никаких модалок.
- Кнопка `Open profile →` ведёт на `/players/:id` — полная статистика по дням, история визитов, transfers, intelligence и т.д.
- `✕` сворачивает header.
- Внутри header: photo, name, CMS code, category badge, flags, tags, last visit, lifetime NEP/Drop/Visits, кнопки быстрых действий (Edit / Chip Transfer / Blacklist) — те же, что сейчас в `PlayerEditDialog` карточке-шапке.
- Если ширина позволяет (FHD), header горизонтальный одной строкой; на узких экранах — компактный mobile preview.

Где применяем:
- `/players` (Players list)
- `/blacklist`
- `/groups/:id` members
- `/cage` Active Players
- `/pit` Active Players
- Player search results везде

Cashier/Reception: в header скрыты lifetime financials (по правилу `canSeePlayerFinancials`).

Технически: компонент `<PlayerPreviewHeader playerId={selected} onOpen={...} onClose={...} />` + `useSelectedPlayer()` zustand-стор (или React state на странице).

## Full Page Routes (без изменений с v2)

| Текущая модалка | Новый route | Шагов |
|---|---|---|
| `CloseShiftDialog` | `/cage/close-shift` | 4 (Chips → Cash → Cashless → Review) |
| `CloseTableWizard` | `/tables/:id/close` | 2 (Chip Count → Result) |
| `NewPlayerDialog` (cage) | `/players/register` | 1-2 |
| `CloseBusinessDayButton` | `/business-day/close` | 1 + confirm |
| `OpenShiftScreen` | `/cage/open-shift` | 1 |
| `PlayerEditDialog` | **убирается** — заменяется Sticky Preview Header + кнопкой Open profile (`/players/:id` уже редактируем там же) |
| `UserEditorDialog` | `/admin/users/:id` (`new`) | 1 |
| `UserPermissionsDialog` | `/admin/users/:id/permissions` | 1 |
| `InterCasinoTransfers` create | `/finance/transfers/new` | 2 |
| `WalletsView` edit | `/finance/wallets/:id` | 1 |
| `ChipTransferDialog` | `/players/:id/chip-transfer` | 1 |
| `EditOpeningChipsDialog` | `/cage/shift/:id/edit-opening` | 1 |

## Inline (без изменений)

`FloatManagement`, `BudgetCategories`, `FinanceExpenses`, `BankChecks`, `Groups`, `TableSeatingDialog` (в FloorTableCard), `ChipCountPanel` (встраиваем в страницу стола).

## Остаются Dialog (с авто-reset)

`LogoutButton`, `ManagerOverrideDialog`, `BlacklistPlayerDialog`, `ChipEmissionDialog`, `ServerPushUpdateDialog`, `EmployeePhotoCell` lightbox, alert-dialog confirms.

## Технические артефакты

1. `<WizardShell>` — шаги, sessionStorage draft, Cancel-confirm.
2. `<InlineEditor>` — раскрываемая строка таблицы.
3. `<PlayerPreviewHeader>` + `useSelectedPlayer` — sticky header для игроков.
4. `useDraft(key)` — autosave/restore wizard.
5. `useResetOnClose` — глобально на `ResponsiveDialog` для мгновенной победы над «осталось состояние».
6. Обновить `route-module-map.ts` для новых routes.

## Порядок (по итерациям, упаковано с density-rollout)

- **M0 — Фундамент**: WizardShell, InlineEditor, PlayerPreviewHeader, useDraft, useResetOnClose глобально.
- **M1 — Cashier**: `/cage/close-shift`, `/cage/open-shift`, edit-opening, `/players/register`. Density: cashier.
- **M2 — Tables/Pit**: `/tables/:id/close`, TableSeating inline, ChipCountPanel inline. Density: pit/manager.
- **M3 — Players**: PlayerPreviewHeader везде где списки игроков, `/players/:id/chip-transfer`, удалить PlayerEditDialog.
- **M4 — Finance**: `/finance/transfers/new`, `/finance/wallets/:id`, BudgetCategories/Expenses/FloatManagement inline. Density: finance.
- **M5 — Admin**: `/admin/users/:id`, `/admin/users/:id/permissions`. Density: admin/HR.
- **M6 — Business Day**: `/business-day/close`.

## Что подтвердить

1. **PlayerPreviewHeader — поведение по умолчанию**: всегда виден сверху списка (даже без выбора, в виде «Select a player to preview»), или появляется только после клика и сворачивается крестиком?
2. **Стартуем с M0 + M1 (Cashier)** в одной итерации?
3. **WizardShell drafts**: всегда восстанавливать введённое при возврате (sessionStorage), или чистый старт каждый раз?
