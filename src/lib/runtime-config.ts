/**
 * Runtime Configuration Loader
 * ----------------------------
 * Подгружает /runtime-config.json в момент запуска приложения.
 *
 * - В Cloud режиме (lovable.app, casinosystem.app) файл содержит плейсхолдеры
 *   __RUNTIME_*__ — мы их детектируем и игнорируем (используем встроенные .env переменные).
 *
 * - В Local режиме (Docker on-prem) entrypoint.sh контейнера cms-frontend подменяет
 *   плейсхолдеры на реальные значения локального сервера (https://arusha.local/api и т.д.)
 *   ПЕРЕД запуском nginx. Тогда фронт начинает обращаться к локальному PostgREST/GoTrue.
 *
 * Использование:
 *   import { getRuntimeConfig, isLocalMode } from '@/lib/runtime-config';
 *   const cfg = await getRuntimeConfig();
 */

export interface RuntimeConfig {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  casinoId: string | null;
  casinoSlug: string | null;
  localMode: boolean;
  version: string | null;
}

const PLACEHOLDER_PATTERN = /^__RUNTIME_.*__$/;

let cached: RuntimeConfig | null = null;
let loadPromise: Promise<RuntimeConfig> | null = null;

const isPlaceholder = (v: unknown): boolean =>
  typeof v === "string" && PLACEHOLDER_PATTERN.test(v);

const cleanValue = (v: unknown): string | null =>
  isPlaceholder(v) || v == null || v === "" ? null : String(v);

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // ВАЖНО: жёсткий таймаут 3 сек. Без него после resetPWACache() при медленной
      // сети fetch /runtime-config.json висит → main.tsx не монтирует React →
      // белый экран на 2-3 минуты пока браузер не сдастся.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      let raw: any;
      try {
        const res = await fetch("/runtime-config.json", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        raw = await res.json();
      } finally {
        clearTimeout(timer);
      }

      cached = {
        supabaseUrl: cleanValue(raw.supabaseUrl),
        supabasePublishableKey: cleanValue(raw.supabasePublishableKey),
        casinoId: cleanValue(raw.casinoId),
        casinoSlug: cleanValue(raw.casinoSlug),
        localMode: raw.localMode === true || raw.localMode === "true",
        version: cleanValue(raw.version),
      };
    } catch {
      // Файл отсутствует / таймаут / невалидный — Cloud-режим, всё через .env
      cached = {
        supabaseUrl: null,
        supabasePublishableKey: null,
        casinoId: null,
        casinoSlug: null,
        localMode: false,
        version: null,
      };
    }
    return cached!;
  })();

  return loadPromise;
}

/**
 * Синхронная проверка — работает только ПОСЛЕ getRuntimeConfig().
 * Безопасный фолбэк: false (Cloud-режим).
 */
export function isLocalMode(): boolean {
  return cached?.localMode === true;
}

export function getCachedRuntimeConfig(): RuntimeConfig | null {
  return cached;
}
