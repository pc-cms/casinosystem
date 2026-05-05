import { create } from "zustand";

/**
 * useSelectedPlayer — global selected player id for the Sticky Preview Header
 * pattern (M3 in modal redesign). Lists call `select(id)` on row click; the
 * <PlayerPreviewHeader /> on the same surface reads it and renders.
 */
interface State {
  playerId: string | null;
  select: (id: string | null) => void;
  clear: () => void;
}

export const useSelectedPlayer = create<State>((set) => ({
  playerId: null,
  select: (id) => set({ playerId: id }),
  clear: () => set({ playerId: null }),
}));
