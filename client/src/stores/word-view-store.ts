import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WordViewMode = 'list' | 'badges';
type WordSortMode = 'alphabetical' | 'progress' | 'popularity';

type WordViewState = {
  viewMode: WordViewMode;
  sortMode: WordSortMode;
  setViewMode: (mode: WordViewMode) => void;
  setSortMode: (mode: WordSortMode) => void;
};

export const useWordViewStore = create<WordViewState>()(
  persist(
    (set) => ({
      viewMode: 'list',
      sortMode: 'popularity',
      setViewMode: (mode) => set({ viewMode: mode }),
      setSortMode: (mode) => set({ sortMode: mode }),
    }),
    { name: 'word-view-mode' }
  )
);

export type { WordSortMode };
