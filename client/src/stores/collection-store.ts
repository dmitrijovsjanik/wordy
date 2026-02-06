import { create } from 'zustand';
import type {
  CollectionGroup,
  LibraryCollection,
  CollectionDetail,
  DifficultWordsResponse,
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
  getDifficultWords,
} from '@/lib/api';

const CACHE_TTL = 5 * 60 * 1000; // 5 минут

type CachedDetail = {
  data: CollectionDetail;
  fetchedAt: number;
};

type CollectionState = {
  marketplace: CollectionGroup[];
  library: LibraryCollection[];
  errorsCollection: DifficultWordsResponse | null;
  allWords: {
    id?: number;
    word: string;
    translation: string;
    alternativeTranslations?: string[];
    partOfSpeech?: string;
    srsStage?: number | null; // null/undefined = не встречалось
    popularityRank?: number;
  }[];
  currentDetail: CollectionDetail | null;
  detailCache: Map<number, CachedDetail>;
  isLoadingLibrary: boolean;
  isLoadingMarketplace: boolean;
  isLoadingErrors: boolean;
  isLoadingAllWords: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  libraryFetchedAt: number | null;
  marketplaceFetchedAt: number | null;
  errorsFetchedAt: number | null;
  allWordsFetchedAt: number | null;

  fetchMarketplace: (force?: boolean) => Promise<void>;
  fetchLibrary: (force?: boolean) => Promise<void>;
  fetchErrorsCollection: (force?: boolean) => Promise<void>;
  fetchAllWords: (force?: boolean) => Promise<void>;
  fetchDetail: (id: number, force?: boolean) => Promise<void>;
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
  removeWordsLocally: (wordIds: number[]) => void;
};

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  marketplace: [],
  library: [],
  errorsCollection: null,
  allWords: [],
  currentDetail: null,
  detailCache: new Map(),
  isLoadingLibrary: false,
  isLoadingMarketplace: false,
  isLoadingErrors: false,
  isLoadingAllWords: false,
  isLoadingDetail: false,
  error: null,
  libraryFetchedAt: null,
  marketplaceFetchedAt: null,
  errorsFetchedAt: null,
  allWordsFetchedAt: null,

  fetchMarketplace: async (force = false) => {
    const { marketplaceFetchedAt, isLoadingMarketplace } = get();
    if (!force && marketplaceFetchedAt && Date.now() - marketplaceFetchedAt < CACHE_TTL) {
      return;
    }
    if (isLoadingMarketplace) return;
    set({ isLoadingMarketplace: true, error: null });
    try {
      const res = await getMarketplace();
      set({ marketplace: res.groups, isLoadingMarketplace: false, marketplaceFetchedAt: Date.now() });
    } catch {
      set({ isLoadingMarketplace: false, error: 'Не удалось загрузить каталог' });
    }
  },

  fetchLibrary: async (force = false) => {
    const { libraryFetchedAt, isLoadingLibrary } = get();
    if (!force && libraryFetchedAt && Date.now() - libraryFetchedAt < CACHE_TTL) {
      return;
    }
    if (isLoadingLibrary) return;
    set({ isLoadingLibrary: true, error: null });
    try {
      const res = await getLibrary();
      set({ library: res.collections, isLoadingLibrary: false, libraryFetchedAt: Date.now() });
    } catch {
      set({ isLoadingLibrary: false, error: 'Не удалось загрузить библиотеку' });
    }
  },

  fetchErrorsCollection: async (force = false) => {
    const { errorsFetchedAt, isLoadingErrors } = get();
    if (!force && errorsFetchedAt && Date.now() - errorsFetchedAt < CACHE_TTL) {
      return;
    }
    if (isLoadingErrors) return;
    set({ isLoadingErrors: true });
    try {
      const res = await getDifficultWords();
      set({ errorsCollection: res, isLoadingErrors: false, errorsFetchedAt: Date.now() });
    } catch {
      set({ isLoadingErrors: false });
    }
  },

  fetchAllWords: async (force = false) => {
    const { allWordsFetchedAt, isLoadingAllWords } = get();
    if (!force && allWordsFetchedAt && Date.now() - allWordsFetchedAt < CACHE_TTL) {
      return;
    }
    if (isLoadingAllWords) return;
    set({ isLoadingAllWords: true });
    try {
      const res = await getAllWords();
      set({ allWords: res.words, isLoadingAllWords: false, allWordsFetchedAt: Date.now() });
    } catch {
      set({ isLoadingAllWords: false });
    }
  },

  fetchDetail: async (id, force = false) => {
    const { detailCache, isLoadingDetail } = get();
    const cached = detailCache.get(id);
    const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL;

    // Если есть свежий кэш и не форсируем — просто показываем
    if (isFresh && !force) {
      set({ currentDetail: cached.data, isLoadingDetail: false, error: null });
      return;
    }

    // Если есть кэш (даже устаревший) — показываем сразу, фетчим в фоне
    if (cached) {
      set({ currentDetail: cached.data, error: null });
      // Не показываем loading если уже есть данные
    } else {
      set({ isLoadingDetail: true, error: null, currentDetail: null });
    }

    // Предотвращаем параллельные запросы
    if (isLoadingDetail && cached) return;

    set({ isLoadingDetail: true });
    try {
      const res = await getCollectionDetail(id);
      const newCache = new Map(get().detailCache);
      newCache.set(id, { data: res, fetchedAt: Date.now() });
      set({ currentDetail: res, isLoadingDetail: false, detailCache: newCache });
    } catch {
      set({ isLoadingDetail: false, error: cached ? null : 'Не удалось загрузить коллекцию' });
    }
  },

  subscribe: async (id) => {
    await subscribeCollection(id);
    const { marketplace, currentDetail, detailCache } = get();
    // Оптимистичное обновление UI
    const updatedDetail = currentDetail?.collection.id === id
      ? { ...currentDetail, collection: { ...currentDetail.collection, isInLibrary: true, isActive: true } }
      : null;

    // Обновляем кэш если есть
    const newCache = new Map(detailCache);
    if (updatedDetail) {
      newCache.set(id, { data: updatedDetail, fetchedAt: Date.now() });
    }

    set({
      marketplace: marketplace.map((g) => ({
        ...g,
        collections: g.collections.map((c) =>
          c.id === id ? { ...c, isInLibrary: true } : c,
        ),
      })),
      ...(updatedDetail ? { currentDetail: updatedDetail, detailCache: newCache } : {}),
      libraryFetchedAt: null, // Инвалидировать кэш библиотеки
    });
    // Фоновое обновление библиотеки
    get().fetchLibrary(true);
  },

  unsubscribe: async (id) => {
    await unsubscribeCollection(id);
    const { marketplace, currentDetail, detailCache } = get();
    // Оптимистичное обновление UI
    const updatedDetail = currentDetail?.collection.id === id
      ? { ...currentDetail, collection: { ...currentDetail.collection, isInLibrary: false, isActive: false } }
      : null;

    // Обновляем кэш если есть
    const newCache = new Map(detailCache);
    if (updatedDetail) {
      newCache.set(id, { data: updatedDetail, fetchedAt: Date.now() });
    }

    set({
      marketplace: marketplace.map((g) => ({
        ...g,
        collections: g.collections.map((c) =>
          c.id === id ? { ...c, isInLibrary: false } : c,
        ),
      })),
      ...(updatedDetail ? { currentDetail: updatedDetail, detailCache: newCache } : {}),
      libraryFetchedAt: null, // Инвалидировать кэш библиотеки
    });
    // Фоновое обновление библиотеки
    get().fetchLibrary(true);
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
    set({ libraryFetchedAt: null });
    await get().fetchLibrary(true);
    return res.collectionId;
  },

  update: async (id, data) => {
    await updateCollection(id, data);
    // Инвалидируем кэш детали
    const newCache = new Map(get().detailCache);
    newCache.delete(id);
    set({ libraryFetchedAt: null, detailCache: newCache });
    await Promise.all([get().fetchDetail(id, true), get().fetchLibrary(true)]);
  },

  remove: async (id) => {
    await deleteCollection(id);
    // Удаляем из кэша
    const newCache = new Map(get().detailCache);
    newCache.delete(id);
    set({ libraryFetchedAt: null, detailCache: newCache, currentDetail: null });
    await get().fetchLibrary(true);
  },

  removeWordsLocally: (wordIds) => {
    const detail = get().currentDetail;
    if (!detail) return;
    const idSet = new Set(wordIds);
    const updatedDetail = {
      ...detail,
      words: detail.words.filter((w) => !idSet.has(w.id)),
      collection: {
        ...detail.collection,
        totalWords: detail.collection.totalWords - wordIds.length,
      },
    };
    // Обновляем и currentDetail и кэш
    const newCache = new Map(get().detailCache);
    newCache.set(detail.collection.id, { data: updatedDetail, fetchedAt: Date.now() });
    set({ currentDetail: updatedDetail, detailCache: newCache });
  },
}));
