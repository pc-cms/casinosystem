## Анализ модуля Club + Players + Promo + Account Manager

Аудит показал: основное всё сделано (RPC, RLS, Trusted-tab, Club App, Reception save, изоляция роли). Остались 5 мелких хвостов.

---

### Что уже работает ✅

- **AM Workspace**: все 10 пунктов меню (CRM, KYC, Promo Codes/Grants, Lotteries, Shop, Shop Orders, AM Budget, AM Performance, Campaigns, Reports) собраны в секции PROMO под `account_manager`.
- **KYC-страница**: 4 вкладки — Queue / Verified by Reception / Trusted (AM) / Not Verified.
- **RPC**: `am_trust_player` + `am_revoke_verification` (с reason ≥10 chars, аудит в `kyc_reviews`).
- **RLS network-wide для AM** на 13 таблицах: players, club_accounts, kyc_reviews, promo_*, lotteries, lottery_tickets, shop_orders, am_budgets, house_promo_fund, premier_promo_campaigns.
- **Club App** — 8 страниц: Landing, Login, Register (минимальный: phone+name+lastname+dob), Wallet, Profile, Shop, Tickets, VerifyWizard. Unverified пускает в Wallet/Profile, блокирует Shop/Tickets с понятным CTA.
- **Reception "Save"** без фото/документа разрешён (`Reception.tsx:849`), карта выдаётся, `verification_status='unverified'`.
- **Изоляция verified scope**: Pit/Cage/Stats/PlayerProfile **не** фильтруют по `verification_status` (grep = 0 совпадений).
- **AM не видит** Pit/Cage/Finance в сайдбаре.
- **Promo edge functions**: все `club-*`, `promo-expire`, `promo-generate-codes`, `cashier-redeem-by-qr`.

---

### Что нужно доработать (5 точечных фиксов)

#### 1. RLS на `player_crm` для AM ⚠️ важно
`account_manager` не указан в политиках `player_crm` и `player_notes`. AM на чужом субдомене не сможет читать/писать CRM-данные сетевых игроков.
**Фикс**: миграция — добавить `account_manager` bypass на SELECT/INSERT/UPDATE для `player_crm`, `player_notes`.

#### 2. RoleGuard path для `/admin/kyc` ⚠️ мелкое
В `App.tsx:398` использован общий ключ `path="admin"` вместо собственного → KYC-страница наследует разрешения "admin", а не KYC.
**Фикс**: заменить на `path="admin/kyc"` (отдельная запись в module map), чтобы дать `account_manager` прямой доступ без admin-флага.

#### 3. Wallet banner → прямая ссылка на Verify ⚠️ UX
`ClubWallet.tsx:106` "Get verified" ведёт на `/club/profile`, оттуда ещё клик на `/club/verify`.
**Фикс**: ссылка сразу на `/club/verify`.

#### 4. Promo Campaigns — отдельная страница под AM ⚠️ навигация
Сейчас "Campaigns" в сайдбаре AM ведёт на `/marketing/campaigns` (модуль Marketing). Для целостности AM-домена — переименовать в "Promo Campaigns" или поднять Marketing-функционал в `/admin/promo-campaigns`.
**Фикс** (минимальный): переименовать пункт сайдбара в "Promo Campaigns" и оставить роут. Полный перенос — отдельной задачей.

#### 5. Memory-проверка ⚠️ документация
`mem://features/am-trusted-players` уже создан. Сверить с core-rules в `mem://index.md` — там уже есть пункт про AM network-wide и Club-only verified scope. **Нечего менять.**

---

### Out of scope (по решению предыдущих итераций)

- Никаких `/am/*` редиректов и переноса CRM-роутов — оставляем под `/crm/*` и `/admin/*`, сайдбар группирует визуально.
- Без удаления `player_crm` или схемы изменений в promo.
- Без новых лимитов в Club App.

---

### Технические изменения

**Migration**
```sql
-- player_crm: AM network-wide access
DROP POLICY IF EXISTS "..." ON public.player_crm;
CREATE POLICY "AM full access to player_crm"
ON public.player_crm FOR ALL TO authenticated
USING (has_role(auth.uid(),'account_manager') OR <existing-casino-scope>)
WITH CHECK (has_role(auth.uid(),'account_manager') OR <existing-casino-scope>);

-- same for player_notes
```

**Frontend**
- `src/App.tsx` — RoleGuard `path="admin/kyc"` для `/admin/kyc`.
- `src/lib/route-module-map.ts` — добавить ключ `admin/kyc`.
- `src/pages/club/ClubWallet.tsx:106` — `to="/club/verify"`.
- `src/components/layout/AppSidebar.tsx` — пункт "Campaigns" → "Promo Campaigns".
- `src/lib/modules.ts` (если нужно) — дефолтные права `account_manager` на `admin/kyc`.

**Версия**: bump `package.json` (миграция backend).

---

### Acceptance

1. AM на любом субдомене редактирует CRM-карточку игрока другой казино — без ошибок RLS.
2. AM логинится → видит `/admin/kyc` напрямую, без admin-прав.
3. В Club App unverified → "Get verified" в Wallet → сразу на `/club/verify`.
4. Сайдбар AM: пункт называется "Promo Campaigns".
5. Все существующие тесты Trusted/Revoke зелёные.

После одобрения — реализую все 4 фикса в одной итерации.
