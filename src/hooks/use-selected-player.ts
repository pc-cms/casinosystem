import { useSyncExternalStore } from "react";

/**
 * useSelectedPlayer — minimal global store (no zustand) for the
 * Sticky Preview Header pattern. Lists call `select(id)` on row click;
 * the <PlayerPreviewHeader /> on the same surface reads it and renders.
 */
let _id: string | null = null;
const _listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  _listeners.add(l);
  return () => _listeners.delete(l);
};
const getSnapshot = () => _id;
const emit = () => _listeners.forEach((l) => l());

export const selectPlayer = (id: string | null) => {
  if (_id === id) return;
  _id = id;
  emit();
};
export const clearSelectedPlayer = () => selectPlayer(null);

export function useSelectedPlayer() {
  const playerId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return { playerId, select: selectPlayer, clear: clearSelectedPlayer };
}
