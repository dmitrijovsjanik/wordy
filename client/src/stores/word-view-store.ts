import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WordViewMode = 'list' | 'badges';

type WordViewState = {
  viewMode: WordViewMode;
  setViewMode: (mode: WordViewMode) => void;
};

export const useWordViewStore = create<WordViewState>()(
  persist(
    (set) => ({
      viewMode: 'list',
      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    { name: 'word-view-mode' }
  )
);
