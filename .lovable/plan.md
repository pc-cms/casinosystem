# Premier Club — Self-service profile + Get Verified (KYC)

## Flow summary

1. **Registration** = только phone + password + First, Last, DOB (минимум для 18+). Создаётся stub `players` (`verification_status='unverified'`) + `club_accounts`.
2. **Profile** редактируется свободно пока `unverified`. Большая кнопка **Get Verified** запускает wizard.
3. **Wizard**: Selfie → ID front → ID back → OCR auto-fill (имя/DOB/ID) → Review → Send to verify. Создаёт `kyc_reviews(status='pending')`, `verification_status='pending'`. Профиль становится read-only с бейджем "In review" и кнопкой **Cancel review** (откатывает в `unverified`, перезаливает).
4. **AM** в CRM апрувит → `verification_status='verified'` → бейдж "Verified", всё залочено.
5. **Restrictions** для unverified+pending: блок на Shop, Lottery, promo grants. Walk-in QR и просмотр баланса доступны всегда.

## Registration (minimal)

`ClubRegister.tsx`: phone → OTP → форма (First, Last, DOB, Password). Branch выбирается потом в Profile (по умолчанию central Premier Club casino).

`club-register-player` упрощается: принимает только обязательные поля, `id_number=''`, `casino_slug` defaults to `premier`.

## Profile page (editable while unverified)

`ClubProfile.tsx` показывает форму вместо read-only сетки:

- Поля: First, Last, DOB, ID number (опц.), Home branch (dropdown).
- Status badge: `Unverified` / `In review` / `Verified`.
- **CTA**:
  - `unverified` → **Save** (silent patch) + большая **Get Verified** → `/club/verify`.
  - `pending` → форма read-only + **Cancel review** (вторичная кнопка, confirm dialog) → откат в `unverified`, kyc_reviews row → `status='cancelled'`.
  - `verified` → read-only.
- Walk-in QR остаётся сверху всегда.

Новые edge functions:
- `club-update-profile` (club token): patch first/last/dob/id_number/casino_id. Allowed только если `verification_status='unverified'`.
- `club-cancel-kyc`: переводит player → `unverified`, помечает pending kyc_review → `cancelled`.

## Get Verified wizard `/club/verify`

Полноэкранный wizard (gold/red, бренд Premier Club, не WizardShell — отдельная стилизованная обёртка). 4 шага:

1. **Selfie** — `<input type="file" accept="image/*" capture="user">`, preview + retake.
2. **ID front** — `capture="environment"`, preview + retake.
3. **ID back** — то же.
4. **Confirm details** — OCR результат (вызов `ocr-document` на ID front после upload) подставляется в форму. Поля First, Last, DOB, ID number — все editable. Review-блок с тремя миниатюрами фото.
5. **Submit** — кнопка **Send to verify**.

Photos → private bucket `club-kyc`, путь `{player_id}/selfie.jpg`, `id-front.jpg`, `id-back.jpg`. Upload через edge function (multipart) либо signed-upload URL, чтобы не давать клиенту прямой доступ к bucket.

`club-submit-kyc`:
- Валидирует player owns session, `verification_status='unverified'`.
- Сохраняет URLs в `players.photo_url` (selfie) и `players.id_document_url` (id-front).
- Patches first/last/birth_date/id_number.
- INSERT `kyc_reviews(player_id, casino_id, source='club_app', status='pending', ai_result=<ocr_json + paths>)`.
- Sets `players.verification_status='pending'`.

## Restrictions для unverified/pending

Добавить в edge functions проверку `verification_status='verified'`:
- `club-shop-order` → отказ `kyc_required`.
- `club-buy-ticket` → отказ `kyc_required`.
- AM при выдаче grant (UI в CRM) — disable кнопку для unverified/pending игроков (frontend gate; backend RPC уже проверяет AM role).

Frontend: на `/club/shop` и `/club/tickets` показывать баннер "Complete verification to unlock purchases" + disabled CTA для unverified/pending.

## DB migration

- Enum `player_verification_status`: убедиться что есть `unverified`, `pending`, `verified`, `rejected`. Добавить недостающие.
- `kyc_review_status`: добавить `cancelled` если отсутствует.
- `kyc_review_source`: добавить `club_app` если отсутствует.
- Private bucket `club-kyc` (через `storage_create_bucket`).
- RLS на `storage.objects/club-kyc`: AM/super_admin/manager — read; service role — write (uploads only через edge function).
- RPC `club_update_profile`, `club_submit_kyc`, `club_cancel_kyc` (SECURITY DEFINER, accept player_id) — вызываются из edge functions с service key, поэтому RLS не блокирует.
- Cross-casino read: `players` rows клуб-зарегистрированных игроков (имеют `club_accounts`) видимы reception/cashier на любой ветке через дополнительный SELECT policy.

## Files

**Created**
- `supabase/functions/club-update-profile/index.ts`
- `supabase/functions/club-submit-kyc/index.ts`
- `supabase/functions/club-cancel-kyc/index.ts`
- `src/pages/club/ClubVerifyWizard.tsx`
- `src/components/club/CameraCapture.tsx` — file+camera input wrapper c preview/retake

**Edited**
- `src/pages/club/ClubRegister.tsx` — добавить First/Last/DOB (убрать ID, branch)
- `src/pages/club/ClubProfile.tsx` — editable форма + статус-CTA
- `src/pages/club/ClubWallet.tsx` — баннер "Get verified" для unverified
- `src/pages/club/ClubShop.tsx`, `ClubTickets.tsx` — баннер + disabled CTA
- `src/lib/club-api.ts` — `updateProfile`, `submitKyc`, `cancelKyc`
- `src/App.tsx` — `/club/verify`
- `supabase/functions/club-register-player/index.ts` — упростить до minimal
- `supabase/functions/club-shop-order`, `club-buy-ticket` — gate by verified
- `supabase/functions/club-wallet/index.ts` — отдавать `verification_status` (уже есть)
- DB migration: enums, RPCs, bucket policies
- `package.json` — bump

## Open question

Один остался: на каком экране выбирать **Home branch**?
- (A) В Registration форме сразу dropdown (как сейчас).
- (B) В Profile после первого входа (default Premier Club central).
- (C) В Get Verified wizard на шаге Confirm.

Если без ответа — иду по (B).
