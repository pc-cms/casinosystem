
# Architecture reset: Premier-hub star + isolated Primaries

## Confirmed decisions

1. **Cloudflare Access** — выключено на тестах, флаг в `install.sh` (`--cf-access=off|on`). Включим перед прод-запуском без пересборки.
2. **Что синхронизируется через Premier**:
   - **Двусторонне** (Local ↔ Premier ↔ другие Locals): `players`, `player_cards`, `blacklist`, `player_intelligence_*`. Это общая клиентская база сети.
   - **Только Local → Premier** (read-only консолидация): всё операционное — shifts, transactions, expenses, tables, snapshots, attendance, payroll, finance.
   - **Только Premier → Locals** (push): users/roles, версии, network-wide blacklist решения.
3. **Clone & Promote** — только `super_admin`. Manager-password в этом окне не требуется.
4. **Процедура копирования Arusha сейчас (до cutover)** — см. ниже отдельный блок.

---

## Целевая топология

```text
        ┌──────────────────────────────────────────┐
        │            Premier (Cloud)               │
        │  • Read-only консолидация операций       │
        │  • Двусторонний хаб для players/blacklist│
        │  • Push users + versions                 │
        └───────▲──────────▲──────────▲────────────┘
                │          │          │
                │ cms-sync (push ops, push+pull players/blacklist)
                │          │          │
        ┌───────┴──┐  ┌────┴─────┐  ┌─┴────────┐
        │ Arusha   │  │ Mwanza   │  │ Dodoma   │
        │ LOCAL    │  │ LOCAL    │  │ LOCAL    │
        │ Primary  │  │ Primary  │  │ Primary  │
        │ +LAN Mir │  │ +LAN Mir │  │ +LAN Mir │
        └──────────┘  └──────────┘  └──────────┘
            ▲              ▲              ▲
            └── Cloudflare Tunnel ──────────┘
                arusha.casinosystem.app → on-prem
                (Cloudflare Access — позже)
```

Локалы **не видят друг друга**. Никакого peer-mesh между казино. Premier — единственный мост.

---

## Процедура копирования Arusha СЕЙЧАС (zero-downtime cutover)

Это ответ на вопрос #4 — как перенести живую Arusha из Cloud на on-prem без остановки кассы.

```text
T-7d   Установка железа        T-0    Cutover     T+1d   Cleanup
  │                              │                  │
  ├─ Step 1: Install on-prem ────┤                  │
  ├─ Step 2: Full seed ──────────┤                  │
  ├─ Step 3: Delta catch-up ─────┤                  │
  │                              ├─ Step 4: Freeze  │
  │                              ├─ Step 5: Drain   │
  │                              ├─ Step 6: Promote │
  │                              ├─ Step 7: DNS swap│
  │                              │                  ├─ Step 8: Cloud→archive
```

**Step 1 — Install on-prem (любой день, фоном).**
`curl -fsSL https://casinosystem.app/install | sudo bash -s -- --casino arusha --role primary-staging`
Поднимает Postgres+стек, режим `primary-staging` = принимает только seed/replication, операционные UI заблокированы read-only баннером.

**Step 2 — Full seed из Cloud (1 раз, ~5–15 минут).**
Используем существующий `cloud-seed-export` edge function + `seed-import.js`. На on-prem появляется полная копия Arusha на момент T-snapshot. Cloud в это время продолжает обслуживать кассу — ничего не замечают.

**Step 3 — Continuous delta catch-up (часы/дни до cutover).**
`cms-sync` на on-prem подписывается на `sync_outbox` Cloud и применяет дельту в реальном времени. Лаг отображается в Admin → Node → Replication Lag. Готовы к cutover, когда lag стабильно < 2 сек.

**Step 4 — Freeze (T-0, 30 секунд).**
Super_admin жмёт **Cutover Arusha → On-Prem** в Premier. Cloud Arusha переводится в `replication_freeze`: операционные триггеры начинают отбивать INSERT/UPDATE с ошибкой "Cutover in progress, retry in 10s". Кассир видит спиннер. Это безопасно — write-and-sync cashier ретраит автоматически.

**Step 5 — Drain (5–20 секунд).**
Premier ждёт, пока `sync_outbox.max_id` Cloud дойдёт до on-prem (`last_apply_cursor`). Прогресс-бар в Premier.

**Step 6 — Promote (мгновенно).**
On-prem переключается с `primary-staging` → `primary`, снимает read-only баннер. Cloud для Arusha переходит в `archive-readonly` — операционные триггеры теперь блокируют все писатели кроме `cms-sync` pull от Premier.

**Step 7 — DNS swap (10–60 сек распространения).**
Cloudflare API вызов из Premier: `arusha.casinosystem.app` → Cloudflare Tunnel ID нового on-prem. Браузеры/PWA переподключаются (уже умеют — `useReplicationMode` + Supabase realtime reconnect).

**Step 8 — Cloud cleanup (на следующий день).**
Cloud-копия Arusha остаётся read-only архивом 30 дней (страховка отката), потом дроп таблиц через миграцию.

**Откат**, если что-то пошло не так в окне T-0..T+1h:
- Premier → **Rollback Arusha → Cloud** → шаги 4-7 в обратную сторону. Окно отката 1 час, после чего считаем cutover финальным.

**Ожидаемое время даунтайма для кассира:** 5–30 секунд спиннера, не больше.

---

## Что меняется в коде

### Удаляется
- `node_modes` toggle и UI вокруг него.
- `SyncMirrorPanel` "Clone from Cloud" (заменён на Cutover Wizard в Premier).
- `MirrorCutoverPanel`, кросс-казино peer links в `PeerLinksPanel`.
- Cloud операционные writers (через единый `_enforce_premier_readonly` trigger на операционных таблицах после Step 6).

### Добавляется
- **`CutoverWizardPanel`** в Premier (Admin → Network → Casino → Cutover). Шаги 4–7 одной кнопкой, real-time прогресс.
- **`ClonePromotePanel`** в Admin → Node (для будущих LAN failover): Live Clone и Drain & Promote между двумя боксами одного казино.
- **`PremierLinkPanel`** заменяет multi-peer таблицу: одна строка — статус канала к Premier.
- **Двусторонний sync для `players`+`blacklist`**: новая роль таблицы в `sync_outbox` — `bidir_global`. Premier ретранслирует изменения всем локалам, конфликт = LWW по `updated_at`.
- **Cloudflare Tunnel + Access (опциональный)** в `install.sh`: флаги `--cf-tunnel-token=…`, `--cf-access=off` (по умолчанию off, включим перед продом).
- **Postgres streaming replication** скаффолд в `deploy/postgres/init/` для LAN mirror (опционально, для HA внутри одного казино).
- **keepalived** preset для LAN VIP, оставляем optional.

### Без изменений
- Все операционные модули (Pit, Cage, Finance, Reception, Players) — те же URL и тот же Supabase client.
- `useReplicationMode` — продолжает рулить read-only баннером во время Step 4–6.
- Локальные бэкапы (6h pg_dump, daily basebackup, 30d retention).
- Premier отчёты и Network admin UI.

---

## DNS / hostnames после миграции

| Hostname | До | После |
|---|---|---|
| `premier.casinosystem.app` | Premier (Cloud) | Без изменений |
| `arusha.casinosystem.app` | Cloud-копия Arusha | Cloudflare Tunnel → on-prem Arusha |
| `mwanza/dodoma/mbeya.casinosystem.app` | Cloud-копии | Cloudflare Tunnel → on-prem каждого |
| LAN `https://192.168.x.50` | Работает внутри казино | Без изменений |

Один URL — снаружи и изнутри одна и та же база.

---

## Порядок поставки (без big-bang)

1. **Sprint A** — `bidir_global` для players/blacklist + миграция, Premier sync engine обновление, push в Premier для остальных таблиц. (Backend only, без visible UI изменений.)
2. **Sprint B** — `CutoverWizardPanel` в Premier + `replication_freeze` / `archive-readonly` режимы в Postgres триггерах.
3. **Sprint C** — Arusha pilot: Step 1 → 8. Неделя обкатки.
4. **Sprint D** — Mwanza, Dodoma, Mbeya по тому же сценарию.
5. **Sprint E** — Strip Cloud operational write paths, включить Cloudflare Access перед прод-запуском.
6. **Sprint F** — `ClonePromotePanel` для LAN HA (для тех казино, кто захочет второй бокс).

Каждый Sprint A–B бампит `package.json` (миграции/триггеры).

---

## Открытых вопросов больше нет

Если всё ок — переключай в build mode, начну со Sprint A (двусторонняя sync для players/blacklist + push-only outbox для операций).
