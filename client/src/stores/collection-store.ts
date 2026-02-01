import { create } from 'zustand';
import type {
  MarketplaceCollection,
  LibraryCollection,
  CollectionDetail,
} from '@/types/api';
import {
  getMarketplace,
  getLibrary,
  getCollectionDetail,
  subscribeCollection,
  unsubscribeCollection,
  toggleCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  getAllWords,
} from '@/lib/api';

type CollectionState = {
  marketplace: MarketplaceCollection[];
  library: LibraryCollection[];
  allWords: { word: string; translation: string }[];
  currentDetail: CollectionDetail | null;
  isLoading: boolean;
  error: string | null;

  fetchMarketplace: () => Promise<void>;
  fetchLibrary: () => Promise<void>;
  fetchAllWords: () => Promise<void>;
  fetchDetail: (id: number) => Promise<void>;
  subscribe: (id: number) => Promise<void>;
  unsubscribe: (id: number) => Promise<void>;
  toggle: (id: number, isActive: boolean) => Promise<void>;
  create: (data: {
    title: string;
    description?: string;
    words?: { wordText: string; translation: string; partOfSpeech?: string }[];
  }) => Promise<number>;
  update: (id: number, data: {
    title?: string;
    description?: string;
    words?: { wordText: string; translation: string; partOfSpeech?: string }[];
  }) => Promise<void>;
  remove: (id: number) => Promise<void>;
};

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  marketplace: [],
  library: [],
  allWords: [],
  currentDetail: null,
  isLoading: false,
  error: null,

  fetchMarketplace: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await getMarketplace();
      set({ marketplace: res.collections, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить каталог' });
    }
  },

  fetchLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await getLibrary();
      set({ library: res.collections, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить библиотеку' });
    }
  },

  fetchAllWords: async () => {
    try {
      const res = await getAllWords();
      set({ allWords: res.words });
    } catch {
      // ignore
    }
  },

  fetchDetail: async (id) => {
    set({ isLoading: true, error: null, currentDetail: null });
    try {
      const res = await getCollectionDetail(id);
      set({ currentDetail: res, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить коллекцию' });
    }
  },

  subscribe: async (id) => {
    await subscribeCollection(id);
    await get().fetchLibrary();
    // Обновляем маркетплейс тоже
    const { marketplace } = get();
    set({
      marketplace: marketplace.map((c) =>
        c.id === id ? { ...c, isInLibrary: true } : c,
      ),
    });
  },

  unsubscribe: async (id) => {
    await unsubscribeCollection(id);
    await get().fetchLibrary();
    const { marketplace } = get();
    set({
      marketplace: marketplace.map((c) =>
        c.id === id ? { ...c, isInLibrary: false } : c,
      ),
    });
  },

  toggle: async (id, isActive) => {
    await toggleCollection(id, isActive);
    const { library } = get();
    set({
      library: library.map((c) =>
        c.id === id ? { ...c, isActive } : c,
      ),
    });
  },

  create: async (data) => {
    const res = await createCollection(data);
    await get().fetchLibrary();
    return res.collectionId;
  },

  update: async (id, data) => {
    await updateCollection(id, data);
    await Promise.all([get().fetchDetail(id), get().fetchLibrary()]);
  },

  remove: async (id) => {
    await deleteCollection(id);
    await get().fetchLibrary();
  },
}));
