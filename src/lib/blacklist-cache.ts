/**
 * Blacklist offline cache.
 * Stores blacklisted players + their photos in IndexedDB.
 * Photos are cached as blobs for instant offline access.
 * Designed for up to ~50 players.
 */

import { get, set, del } from "idb-keyval";

const CACHE_KEY = "cms-blacklist-cache";
const PHOTO_PREFIX = "cms-bl-photo-";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

type BlacklistEntry = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  photo_url: string | null;
  hasLocalPhoto: boolean;
};

type BlacklistCache = {
  timestamp: number;
  players: BlacklistEntry[];
};

export async function getCachedBlacklist(): Promise<BlacklistEntry[]> {
  try {
    const cache = await get<BlacklistCache>(CACHE_KEY);
    if (!cache) return [];
    return cache.players;
  } catch {
    return [];
  }
}

export async function cacheBlacklist(players: BlacklistEntry[]): Promise<void> {
  try {
    // Save player list
    await set(CACHE_KEY, { timestamp: Date.now(), players } as BlacklistCache);

    // Cache photos in background
    for (const p of players) {
      if (p.photo_url) {
        cachePhoto(p.id, p.photo_url).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("[BlacklistCache] Failed to save:", e);
  }
}

async function cachePhoto(playerId: string, url: string): Promise<void> {
  try {
    // Check if already cached
    const existing = await get<Blob>(`${PHOTO_PREFIX}${playerId}`);
    if (existing) return;

    const response = await fetch(url);
    if (!response.ok) return;
    const blob = await response.blob();
    await set(`${PHOTO_PREFIX}${playerId}`, blob);
  } catch {
    // Silent fail — photo caching is best-effort
  }
}

export async function getLocalPhotoUrl(playerId: string): Promise<string | null> {
  try {
    const blob = await get<Blob>(`${PHOTO_PREFIX}${playerId}`);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function clearBlacklistCache(): Promise<void> {
  try {
    const cache = await get<BlacklistCache>(CACHE_KEY);
    if (cache) {
      for (const p of cache.players) {
        await del(`${PHOTO_PREFIX}${p.id}`).catch(() => {});
      }
    }
    await del(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isCacheStale(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_TTL;
}
