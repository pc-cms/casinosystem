## Цель
Сделать страницу KYC Reviews не только списком, но и быстрой рабочей панелью AM: один клик — в профиль игрока, второй — выдать промо без ухода со страницы.

## 1. Переход в профиль игрока
Во всех 4-х табах (Queue / Verified by Reception / Trusted (AM) / Not Verified) ФИО игрока становится кликабельной ссылкой → `/players/:id` (используем уже существующий `PlayerProfile`).
- Имя — `<Link>` со стилем `hover:underline text-primary`
- Доп. иконка `ExternalLink` (она уже импортирована) рядом — открывает профиль в новой вкладке (для AM, чтобы не терять список).

## 2. Быстрая выдача промо прямо из строки
Новая кнопка **Grant** (иконка `Gift`) в колонке Actions у каждого игрока во всех табах.
Открывает компактный `ResponsiveDialog` "Quick Grant" — без поиска игрока, игрок уже выбран:

Поля (минимум, всё подставлено по умолчанию из настроек казино):
- **Amount** — число (default из `promo_grants_settings` для этого казино, либо последнее использованное AM-ом)
- **Source** — `manual` (по умолчанию) / `cashback` / `verification_bonus` / `birthday`
- **Funding pool** — `am_budget` / `house_fund` (default: `am_budget`)
- **Expiry** — пресеты-чипсы: `7 дней`, `30 дней`, `End of month`, `No expiry` (под капотом — те же параметры `am_issue_grant`)
- **Notes** — короткое поле (необязательно)

Кнопка **Issue** → вызывает существующий RPC `am_issue_grant` (тот же, что используется на `PromoGrantsPage`). После успеха — toast + dialog закрывается, страница не перезагружается.

Доступ к кнопке: `account_manager` и `super_admin` (та же роль, что выдаёт промо на `PromoGrantsPage`).

## 3. Дополнительные улучшения (предлагаю, утверди что включаем)

a) **Wallet balance в строке** — добавить колонку «Balance» (sum `promo_grants.remaining` где `status=active`) во вкладках Trusted (AM) и Verified by Reception. AM сразу видит, есть ли смысл доначислять.

b) **Last visit / Last grant** — мини-колонка «Last activity» (последний визит из `casino_visits` или дата последнего гранта). Помогает понять, кто «спит».

c) **Bulk grant** — чекбоксы в строках + кнопка «Grant to selected» (одна сумма всем выбранным). Удобно для дня рождения / праздничных акций.

d) **История грантов игрока** — кнопка-иконка `History` рядом с Grant, открывает drawer со списком последних 20 `promo_grants` + `promo_redemptions` этого игрока. AM видит, не «жирно» ли он уже давал.

e) **Inline note** — у Trusted-игрока показывать причину доверия (`kyc_reviews.notes` последней `am_trusted`-записи) тонким текстом под именем.

f) **Фильтры в Trusted (AM)** — по казино и по AM-у (кто доверил). При сети из 5-и казино — поможет.

g) **Экспорт CSV** для табов Verified by Reception и Trusted (AM) — отчётность.

## Технические детали

- Изменяемый файл: `src/pages/admin/KycReviewsPage.tsx`
- Новый компонент: `src/components/admin/QuickGrantDialog.tsx` (переиспользует логику `PromoGrantsPage` issue-мутации)
- Хук `useCasino().activeCasinoId` для casino_id (или брать `p.casino_id` игрока — у AM сетевой доступ)
- Никаких миграций БД не требуется — все RPC уже есть (`am_issue_grant`)
- Для пп. (a) и (b) — один доп. select для balance/last_visit агрегатом по списку игроков; делаем lazy (только при открытии таба)

## Вопрос
Из списка a–g — что включаем сразу, что отложим? Минимально я бы рекомендовал **a + d + f** (balance в колонке, история грантов, фильтры) — это даёт AM полную картину при выдаче. Bulk grant (c) и экспорт (g) — следующим шагом.
