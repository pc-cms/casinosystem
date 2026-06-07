## Что делаем

Единый брендовый знак (золотой слон-R на круге):
- **Club** (`club.casinosystem.app`) — **красный** круг (загруженные PNG как есть).
- **Все остальные субдомены системы** (`arusha`, `mwanza`, `dodoma`, `mbeya`, `premier` + on-prem `aru`, `mwz`, `dod`, `mbi` + preview `*.lovable.app`) — **чёрный** круг (красная заливка → `#000000`, золотой слон и кольцо остаются).
- **Landing** (`casinosystem.app` / `www.casinosystem.app`) — иконки и manifest полностью убираем.

## Отрисовка чёрной версии

Через `imagegen--edit_image` на `user-uploads://RED_512.png`: «Replace red circular fill (#A0000D) with solid black (#000000). Keep the gold elephant-R glyph and gold outer ring identical, same proportions, flat colors, no shadows.» Получаю `BLACK_512.png`, визуально проверяю, далее ImageMagick downscale до 384/192/180. Если edit-модель искажает форму — fallback на чистую цветовую замену через ImageMagick (`-fuzz 25% -fill black -opaque red`) прямо на исходных RED PNG.

## Файлы в `public/` (перезаписываем)

**Красный набор — Club:**
- `favicon-club.png` ← RED_192
- `apple-touch-icon-club.png` ← RED_180 (на квадратной чёрной подложке 180×180 для iOS)
- `icon-192-club.png` ← RED_192, `icon-512-club.png` ← RED_512
- `icon-192-club-maskable.png`, `icon-512-club-maskable.png` ← те же (круг full-bleed безопасен для маски)

**Чёрный набор — System (arusha/mwanza/dodoma/mbeya/premier + on-prem + preview):**
- `favicon.png` ← BLACK_192
- `apple-touch-icon.png` ← BLACK_180 на чёрной квадратной подложке
- `icon-192.png`, `icon-512.png` ← BLACK_192/512
- `icon-192-maskable.png`, `icon-512-maskable.png` ← те же
- `icon-192-local.png`, `icon-512-local.png` (+ maskable) ← те же BLACK (для on-prem)
- `arusha-logo.png` ← BLACK_192 (переходит на общий чёрный знак, отдельного брендинга больше нет)

## Landing без иконок

В `index.html` в существующем js-блоке брендинга добавляю ветку для host = `casinosystem.app` / `www.casinosystem.app`: на runtime удаляю `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<link rel="manifest">`, `<meta name="theme-color">` и `apple-mobile-web-app-*` теги. SEO meta (title, description, og:*, canonical, JSON-LD) — не трогаю.

## Версия

Чисто визуальные ассеты + runtime-правка `index.html` — `package.json` не бампаю.

Готов переключаться в build mode и начинать с генерации чёрного 512.
