## Цель

Команда `curl ... | sudo bash` на Ubuntu-сервере должна работать для приватного репозитория `pms-cms/casinosystem`, без ручного скачивания архивов.

## Архитектура

```text
┌──────────────────────────────────────────────────────────────┐
│  GitHub: pms-cms/casinosystem (private)                      │
│  Releases: v1.0.181, v1.0.182, ... ← latest tag              │
│           └─ source code (auto, .tar.gz)                     │
└────────────┬─────────────────────────────────────────────────┘
             │ Authorization: Bearer $GH_TOKEN
             │
┌────────────▼─────────────────────────────────────────────────┐
│  Ubuntu сервер казино                                        │
│  /etc/casino-system/bootstrap.env  (GH_TOKEN, BRANCH=...)    │
│                                                              │
│  $ casino-update     ← один alias                            │
│       ↓                                                      │
│  bootstrap.sh: GET releases/latest API → tarball_url         │
│              → curl с токеном → /opt/casino-system           │
│              → exec deploy/install.sh                        │
└──────────────────────────────────────────────────────────────┘
```

## Что меняется

### 1. `public/install` (bootstrap)

Переписать так, чтобы:

- **Источник версии**: GitHub API `GET /repos/pms-cms/casinosystem/releases/latest` (с токеном).
  Если релизов ещё нет — fallback на ветку `main` через `GET /repos/.../tarball/main`.
- **Авторизация**: `Authorization: Bearer $GH_TOKEN` + `Accept: application/vnd.github+json`.
  Токен берётся из (по приоритету):
  1. env-переменная `GH_TOKEN` при запуске
  2. файл `/etc/casino-system/bootstrap.env` (создаётся при первом запуске)
- **Первый запуск без токена**: bootstrap печатает чёткую инструкцию:
  ```
  Нужен GitHub token (classic, scope: repo).
  Создай: https://github.com/settings/tokens/new?scopes=repo&description=casino-system
  Затем:  echo 'GH_TOKEN=ghp_xxx' | sudo tee /etc/casino-system/bootstrap.env
          sudo chmod 600 /etc/casino-system/bootstrap.env
  И запусти команду снова.
  ```
- **Сам tarball**: качается через
  `curl -fL -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" -o src.tar.gz "https://api.github.com/repos/pms-cms/casinosystem/tarball/<ref>"`
  (это правильный приватный endpoint, не `codeload`).
- **Сохранение состояния**: `.env` и `data/` старой установки переносятся в новую (как уже есть).
- **Установка alias**: при первом успешном запуске bootstrap кладёт скрипт-обёртку:
  `/usr/local/bin/casino-update` → `curl ... | sudo bash -s -- "$@"`.
  Дальше обновление = просто `sudo casino-update` (или `sudo casino-update --rebuild`).

### 2. `public/install.sh` и `deploy/bootstrap.sh`

Те же изменения — это копии того же файла.

### 3. CI: автоматический GitHub Release при каждом push в main (опционально, рекомендуется)

Добавить `.github/workflows/release.yml`:

```yaml
on:
  push:
    branches: [main]
    paths-ignore: ['**.md', '.github/**']
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: ver
        run: echo "v=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.ver.outputs.v }}
          name: ${{ steps.ver.outputs.v }}
          generate_release_notes: true
```

Релизы создаются автоматически, source `.tar.gz` прикрепляется GitHub-ом без участия CI.

Если не хочешь CI — можно вручную: `Releases → Draft new release → Publish` после каждого важного изменения. Bootstrap всё равно работает (использует `releases/latest`).

### 4. README / docs

Короткая шпаргалка:

```bash
# Первая установка на новом сервере
sudo mkdir -p /etc/casino-system
echo 'GH_TOKEN=ghp_xxx' | sudo tee /etc/casino-system/bootstrap.env
sudo chmod 600 /etc/casino-system/bootstrap.env
curl -fsSL https://casinosystem.app/install | sudo bash

# Обновление существующей установки
sudo casino-update
sudo casino-update --rebuild
sudo casino-update --reset
```

## Что НЕ делаем

- Не публикуем токен ни в одном файле репозитория.
- Не делаем релизы вручную каждый раз — берём `releases/latest` или fallback на `main`.
- Не меняем `deploy/install.sh` — bootstrap его только запускает.

## Технические детали (для сверки)

- GitHub API tarball endpoint для приватных репо требует scope `repo` у classic PAT (или `contents:read` у fine-grained). Fine-grained PAT привязывается к конкретному репо — безопаснее.
- Файл `/etc/casino-system/bootstrap.env` читается через `set -a; . /etc/casino-system/bootstrap.env; set +a` чтобы переменные ушли в env.
- HTTP redirect от api.github.com на codeload отрабатывается `-L`. Добавляем `--retry 3 --retry-delay 2`.
- Проверка размера tarball (>100KB) и HTTP=200 — оставляем.
- Версия bootstrap печатается в баннере (как сейчас).
- `package.json` версия будет автоматом через CI становиться тегом релиза.

## Шаги внедрения после approve

1. Переписать `public/install` (+ зеркала `public/install.sh`, `deploy/bootstrap.sh`).
2. Добавить `.github/workflows/release.yml`.
3. Бампнуть `package.json` patch.
4. Пуш в main → автоматически создаётся release v1.0.182.
5. Ты на сервере один раз кладёшь `GH_TOKEN` в `/etc/casino-system/bootstrap.env` и запускаешь `curl ... | sudo bash`.
6. Дальше — `sudo casino-update`.

## Вопрос перед стартом

Нужна ли тебе помощь с генерацией fine-grained PAT (точные галочки) — могу расписать пошагово в инструкции, которую печатает bootstrap при отсутствии токена.
