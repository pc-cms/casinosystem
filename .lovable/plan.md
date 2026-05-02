## План

### Часть 1. Бизнес-день — применять со следующей смены

**Поведение сейчас:** `shift_end` и `breaklist_lock` читаются из `casinos` на каждый рендер и применяются мгновенно — это опасно посреди активной смены.

**Что меняем:**

1. **БД (`casinos`):** добавляем колонки
   - `shift_end_pending text` (новое значение, ждёт активации)
   - `shift_end_pending_from date` (с какого бизнес-дня применить)
   - `breaklist_lock_pending text`
   - аналогично `breaklist_lock_pending_from date`

2. **БД-функция `get_effective_shift_end(casino_id)`** — возвращает `pending`, если сегодняшний бизнес-день ≥ `pending_from`, иначе текущий `shift_end`. При первом вызове после активации — переносит `pending → shift_end` и обнуляет pending.

3. **Frontend (`Admin.tsx` → блок настроек смены):**
   - При сохранении новые значения пишутся в `*_pending` + `*_pending_from = следующий бизнес-день`.
   - Под полями отображаем баннер: «Изменения применятся со следующей смены (с DD.MM.YYYY 18:00)».
   - Если pending уже есть — показываем текущее активное значение и pending-значение рядом, кнопкой «Отменить запланированное».

4. **Frontend (`src/lib/business-day.ts` + `useAuth`):**
   - В `AuthContext` грузим эффективный `shift_end` через RPC `get_effective_shift_end`, кэшируем в контексте.
   - Все вызовы `getBusinessDate()` берут это значение из контекста (через хук `useShiftEnd()`), не перечитывая casino напрямую.

**Эффект:** даже если менеджер сохранил настройку в 03:00 ночи, текущая смена продолжит закрываться по старому правилу; новое начнёт действовать с 18:00 следующего дня.

---

### Часть 2. Двухцветные фишки с 6 настраиваемыми вставками

**Цель:** визуал как на референсе — основной круг с 6 контрастными «вставками» по краю и внутренним диском с цифрой.

1. **БД (`chip_color_settings`):** добавить колонку
   - `edge_color text NOT NULL DEFAULT '#FFFFFF'`

2. **`src/hooks/use-chip-colors.ts`:**
   - Расширяем тип: `{ bg, edge, text }`.
   - В `DEFAULT_CHIP_HEX` добавляем `edge` для каждого номинала (по умолчанию белый, для жёлтых/белых — чёрный).
   - `useUpsertChipColor` принимает `edge_color`.

3. **`src/index.css` — переписываем `.cms-chip-token`:**
   - Внешний круг: `background: conic-gradient(var(--chip-bg) 0 30deg, var(--chip-edge) 30deg 60deg, var(--chip-bg) 60deg 90deg, ...)` — 12 секторов по 30° (6 bg + 6 edge, чередуются).
   - Псевдоэлемент `::before`: внутренний диск ~70% диаметра, `background: var(--chip-bg)`, тонкая золотая обводка.
   - Цифра поверх (`z-index`), `color: var(--chip-text)`.
   - `cms-chip-token-lg` — те же пропорции, увеличенный размер.
   - CSS-переменные `--chip-bg`, `--chip-edge`, `--chip-text` задаются inline-стилем компонента-обёртки.

4. **Компонент-обёртка `<ChipToken denom={...} />`** (новый, `src/components/ChipToken.tsx`):
   - Резолвит цвета через `resolveChipColor(denom, overrides)`.
   - Рендерит `<span class="cms-chip-token" style={{ '--chip-bg': bg, '--chip-edge': edge, '--chip-text': text }}>{label}</span>`.
   - Заменяем все ручные `<span class="cms-chip-token" style={...}>` (~6-8 мест: `ChipDenomInput`, `ChipCountPanel`, `CloseTableWizard`, `TransfersForm`, `ChipColorSettings`, превью на дашборде) на `<ChipToken/>`.

5. **`src/components/admin/ChipColorSettings.tsx`:**
   - Добавляем третий color-picker «Edge» рядом с Background / Text.
   - Превью использует новый `<ChipToken/>`.
   - Кнопка «Default» сбрасывает все три цвета.

6. **Memory:** обновить `mem://ui/visual-patterns` — упомянуть трёхцветную модель фишки (bg/edge/text).

7. **Версия:** bump `package.json` → `1.0.37`.

---

### Технические детали

```text
Фишка (упрощённо):

   ┌───── conic-gradient (12 секторов) ─────┐
   │  bg │edge│ bg │edge│ bg │edge│ ...     │
   │     ┌──────────────────┐               │
   │     │   inner disk     │               │
   │     │   = bg color     │               │
   │     │   "5K" = text    │               │
   │     └──────────────────┘               │
   └────────────────────────────────────────┘
```

**Файлы:**
- Миграция: добавить `shift_end_pending*`, `breaklist_lock_pending*` в `casinos`; добавить `edge_color` в `chip_color_settings`; создать `get_effective_shift_end()`.
- `src/lib/business-day.ts`, `src/lib/auth-context.tsx`, `src/pages/Admin.tsx`
- `src/hooks/use-chip-colors.ts`, `src/index.css`, `src/components/ChipToken.tsx` (new), `src/components/admin/ChipColorSettings.tsx`, и ~6 файлов с заменой inline-spans
- `package.json` (1.0.37)
