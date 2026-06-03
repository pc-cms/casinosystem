## Что сейчас происходит

В коде сейчас смешаны сразу три механизма обновления:

1. **Service Worker / PWA** сам проверяет новую версию и может вызвать reload.
2. **`main.tsx` versionBuster** при смене версии удаляет кэши, unregister service worker и делает `window.location.reload()` ещё до нормальной загрузки приложения.
3. **Force Update** вручную чистит кэши/service worker и делает hard reload.

Из-за этого получается нестабильная цепочка: один компьютер уже видит новую версию, другой держит старый HTML/JS, третий ловит авто-reload во время работы. `Ctrl+Shift+R` помогает, потому что браузер обходит кэш вручную, но затем сессия долго восстанавливается из-за холодного старта + auth/session restore.

## Правильное решение

Сделать один понятный режим обновления:

### 1. Убрать автоматические reload во время работы
- Удалить авто-принудительный reload из PWA `onNeedRefresh`.
- Убрать/переписать `versionBuster` в `main.tsx`, чтобы он не делал ранний `window.location.reload()` при старте.
- Если новая версия найдена — показывать понятное окно/баннер **"New version available"** с кнопкой **Update now**, но не перебрасывать пользователя самовольно на другую страницу.

### 2. Force Update должен быть ручным и предсказуемым
Кнопка Force Update должна делать только это:
- очистить app/service-worker кэши;
- unregister только app service worker;
- очистить stale React Query offline cache;
- **не трогать auth/session localStorage**;
- перезагрузить текущий URL с cache-buster.

То есть пользователь остаётся залогинен, но получает свежий frontend.

### 3. HTML не должен долго держаться старым
В PWA Workbox нужно сделать навигации более безопасными для обновлений:
- убрать короткий `NetworkFirst timeout 3s`, который может быстро отдать старый HTML;
- для HTML/navigation использовать network-first без агрессивного fallback или более строгую стратегию;
- assets с hash-файлами можно кешировать как сейчас.

Цель: свежая версия подтягивается сервером, а не случайно из старого app-shell.

### 4. Версию проверять через `/runtime-config.json`
Для локальных серверов источник версии уже есть: `runtime-config.json` получает `FRONTEND_VERSION`.

Добавить лёгкий клиентский version check:
- периодически читать `/runtime-config.json?ts=...` с `cache: no-store`;
- сравнивать `cfg.version` с текущей отображаемой версией;
- если отличается — показать update banner/dialog;
- не делать auto reload.

### 5. Сессия не должна сбрасываться от обновления
Проверить и зафиксировать правило:
- Force Update не удаляет auth keys;
- refresh-token throttle и leader-election остаются, но обновление приложения не должно создавать лишние signOut/null session сценарии;
- если session restore зависает, app должен показывать нормальный loader/fallback, а не белый экран.

## Что поменяю в коде после подтверждения

1. `src/lib/pwa-register.ts`
   - убрать forced auto-reload loop;
   - оставить только событие/диалог новой версии;
   - сделать `resetPWACache()` более точечным и безопасным для сессии.

2. `src/main.tsx`
   - убрать destructive `versionBuster` reload при старте;
   - оставить нормальный boot deadline без двойных reload.

3. `vite.config.ts`
   - скорректировать Workbox navigation caching, чтобы старый HTML не удерживал старую версию.

4. `src/components/PWAUpdateNotification.tsx`
   - перевести текст на English-only;
   - сделать поведение: пользователь сам нажимает Update now.

5. `src/components/VersionIndicator.tsx` / новый маленький hook
   - добавить безопасную проверку версии через runtime-config;
   - при mismatch показывать update notification.

6. `package.json`
   - bump patch version, потому что это изменение deployment/update behavior.

## Итоговое правило для команды

- **Обновление сервера**: через `sudo casino-update --update` или Local Updater.
- **Обновление браузера/компьютера**: пользователь видит баннер и нажимает **Update now**.
- **Если компьютер застрял**: жмём **Force Update** — он чистит только app cache, не сессию.
- **Никаких скрытых авто-перезагрузок через 2–5 минут** во время работы.