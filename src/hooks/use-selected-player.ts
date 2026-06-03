import { useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

/**
 * useSelectedPlayer — minimal global store (no zustand) for the
 * Sticky Preview Header pattern. Lists call `select(id)` on row click;
 * the <PlayerPreviewHeader /> on the same surface reads it and renders.
 */
let _id: string | null = null;
let _route: string | null = null;
const _listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  _listeners.add(l);
  return () => _listeners.delete(l);
};
const getSnapshot = () => _id;
const emit = () => _listeners.forEach((l) => l());

export const selectPlayer = (id: string | null) => {
  const route = typeof window !== "undefined" ? window.location.pathname : null;
  if (_id === id && _route === route) return;
  _id = id;
  _route = id ? route : null;
  emit();
};
export const clearSelectedPlayer = () => selectPlayer(null);

export function useSelectedPlayer() {
  const location = useLocation();
  const playerId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return {
    playerId: _route === location.pathname ? playerId : null,
    select: selectPlayer,
    clear: clearSelectedPlayer,
  };
}
