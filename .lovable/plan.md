## Цель

1. Reception одной кнопкой **Verify** переводит игрока в `verified` (с заполнением минимума полей). Игрок логинится через OTP по своему телефону — никаких SMS-паролей не отправляем.
2. AM получает 3-tab рабочее место с приоритизацией: club-app-очередь, контроль reception-verify, и общий хвост unverified+pending.
3. AM может **Revoke** reception-verify с обязательной причиной — событие пишется в `kyc_reviews` (audit + видно в истории игрока).

---

## Backend

### 1. Новый enum-значение и поля

- `kyc_review_source`: добавить `'reception'` (если ещё нет — проверим в миграции).
- `kyc_reviews.status`: добавить `'revoked'` (статус для отменённых reception-verify, чтобы они оставались в истории).
- `players`: новые колонки
  - `verified_by` uuid null — кто перевёл в verified (employees.id или auth.users.id)
  - `verified_at` timestamptz null
  - `verified_source` text null — `'reception' | 'club_app'`

### 2. RPC `reception_verify_player(_player_id uuid, _first text, _last text, _dob date, _id_number text, _photo_url text, _id_doc_url text)`
- SECURITY DEFINER, доступ ролям `reception | manager | super_admin | floor_manager`.
- Валидация: имя/фамилия/dob/id_number обязательны; 18+; duplicate id_number блокируется.
- `UPDATE players SET ... verification_status='verified', verified_source='reception', verified_by=auth.uid(), verified_at=now()`.
- `INSERT INTO kyc_reviews (player_id, casino_id, source='reception', status='approved', am_decision_at=now(), am_user_id=auth.uid(), ai_result=jsonb_build_object('verified_by_reception',true))` — чтобы AM видел запись в "Verified by Reception".

### 3. RPC `kyc_revoke_reception(_player_id uuid, _reason text)`
- Доступ: `account_manager | manager | super_admin`.
- `_reason` обязателен (length > 0).
- Если `players.verified_source <> 'reception'` → exception `not_reception_verified` (revoke касается только этого источника; club_app KYC откатывается через стандартный reject существующей `kyc_decide`).
- `UPDATE players SET verification_status='unverified', verified_source=null, verified_by=null, verified_at=null`.
- `INSERT INTO kyc_reviews (player_id, casino_id, source='reception', status='revoked', am_user_id=auth.uid(), am_decision_at=now(), am_notes=_reason)`.

### 4. RLS / Grants
- `EXECUTE` на обе RPC — `authenticated`.
- Существующая RLS на `kyc_reviews` уже разрешает чтение AM-ролям; новые `revoked`/`reception` записи попадут под те же policy.

### 5. Edge function `club-wallet`
- Уже возвращает `verification_status`. Добавить `verified_source` чтобы UI club-app мог отличить «verified at reception» (показывать "Verified at <Casino Name>").

---

## Frontend

### A. Reception side

В существующий `RegisterPlayerPage` (или его эквивалент в Cage) добавляем:
- Кнопку **"Verify & Save"** рядом с обычным Save — показывается только когда заполнены: first, last, dob, id_number, фото селфи, фото документа.
- Подтверждение через `ResponsiveDialog`: "This player will be marked verified. The Account Manager will be notified for QA."
- Вызывает `reception_verify_player`. На успех — toast "Verified. Player can log in via OTP."

### B. AM workspace — `KycReviewsPage` reworked

Три таба (`Tabs` shadcn внутри PageShell, без раздельных страниц):

**Tab 1 — Queue (club app)** *(default, badge с count pending)*
- Источник: `kyc_reviews.source='club_app' AND status='pending'`.
- Действия: Approve / Reject (существующая `kyc_decide` RPC).
- Сортировка: oldest first.

**Tab 2 — Verified by Reception** *(badge с count last 30 days)*
- Источник: `players.verified_source='reception' AND verification_status='verified'`, JOIN на последнюю `kyc_reviews` где source='reception' для verified_at/verified_by.
- Колонки: Name, Phone, ID number, Casino, Verified at, Verified by (employee name).
- Действие на строке: **Revoke** → диалог с обязательным `Textarea` (reason, min 5 chars) → `kyc_revoke_reception`.
- Фильтр: select по casino, search по name/phone, date range.

**Tab 3 — Not Verified** *(badge с total)*
- Источник: `players WHERE verification_status IN ('unverified','pending')`.
- Колонки: Status badge (Unverified / Pending review), Name, Phone, DOB, Created at, Source (`club_app` если есть `club_accounts` для этого игрока, иначе `reception_stub`).
- Действие: открыть профиль игрока в новой вкладке (для дальнейшей работы вне этой страницы).
- Priority sort: pending → unverified, oldest first.

Realtime: подписка на `players` и `kyc_reviews` для текущего casino, чтобы badge counts обновлялись live.

### C. Club app

В `ClubProfile` если `verified_source='reception'` — мелкий tagline под "Verified" badge: "Verified at reception · <date>".

---

## Migration policy

- Существующие игроки с `verification_status='verified'` без `verified_source` — оставляем как есть; в Tab 2 они **не** покажутся (фильтр требует `verified_source='reception'`). Это правильно: AM ревьюит только новые reception-verify, исторические остаются нетронутыми.

---

## Не входит в этот план (отдельно)

- SMS-нотификации игроку об изменении статуса.
- Email-уведомления AM о новых заявках.
- Tier-badge в Club app (отдельный таск из прошлого обсуждения).
- Bulk-actions (массовый approve/revoke).

---

## Файлы

**Новые**
- `supabase/migrations/<ts>_reception_verify_and_revoke.sql`

**Изменяются**
- `src/pages/admin/KycReviewsPage.tsx` — переписать с 3-tab структурой.
- `src/pages/cage/RegisterPlayerPage.tsx` — кнопка "Verify & Save".
- `supabase/functions/club-wallet/index.ts` — отдать `verified_source`.
- `src/pages/club/ClubProfile.tsx` — tagline под badge.
- `package.json` — bump patch.
