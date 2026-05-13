import { eq, and, sql, isNull, inArray, or, lte, gte, asc, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  collections,
  collectionWords,
  userCollections,
  userCustomWords,
  userCustomWordProgress,
  userWordProgressWord,
  wordMeanings,
  words,
  users,
} from '../db/schema.js';
import { FUNCTIONAL_POS, FUNCTIONAL_ENGLISH_WORDS } from '../db/word-filters.js';
import { FREE_LIMITS } from '../config/premium-config.js';
import { LEARNED_PROGRESS } from './srs-service.js';

// ─── Word-level progress helpers ────────────────────────────────────────────
//
// Прогресс L0-L3 хранится в `userWordProgressWord` (единица учёта = Word).
// Лестница (Phase D, Learning v2): pool / passive / active / review / mastered.
// known_external — слово изъято из учебного потока через свайп «Знаю» в обзоре.
// Для совместимости с клиентом, который ждёт per-meaning srsStage 0-3, маппим:
//
//   mastered / review / known_external  → 3 (выучено / изъято — UI рендерит одинаково)
//   active                              → 2
//   passive                             → 1
//   pool                                → 0
//   нет записи                          → null
const TIER_TO_SRS_STAGE_SQL = sql<number | null>`CASE
  WHEN ${userWordProgressWord.id} IS NULL THEN NULL
  WHEN ${userWordProgressWord.learningTier} = 'mastered' THEN 3
  WHEN ${userWordProgressWord.learningTier} = 'review' THEN 3
  WHEN ${userWordProgressWord.learningTier} = 'known_external' THEN 3
  WHEN ${userWordProgressWord.learningTier} = 'active' THEN 2
  WHEN ${userWordProgressWord.learningTier} = 'passive' THEN 1
  ELSE 0
END`;

// Условие «слово выучено» — для COUNT/HAVING запросов.
// known_external включаем: для аналитики разделение «реально выучил» vs
// «знал изначально» делается через прямой запрос по tier, а UI-метрика
// «слов выучено» должна показывать оба варианта.
const WORD_IS_MASTERED_SQL = sql`(
  ${userWordProgressWord.learningTier} = 'mastered'
  OR ${userWordProgressWord.learningTier} = 'review'
  OR ${userWordProgressWord.learningTier} = 'known_external'
)`;

// ─── Constants ──────────────────────────────────────────────────────────────

// Максимальный ранг популярности для отображения (1 = самый популярный)
const MAX_POPULARITY_RANK = 3;

// Минимальная частотность перевода (fr из Yandex API)
// fr=1 — очень редкие переводы (град=city), fr=5/10 — популярные
const MIN_FREQUENCY = 5;

// ─── Virtual "All Words" Collection ─────────────────────────────────────────
//
// Глобальный пул всех «учебных» wordMeanings (rank ≤ 3, без функциональных
// POS и артиклей). Не хранится в таблице `collections` — список строится
// динамически из всех wordMeanings БД. Подписка живёт в `users.allWordsSubscribed`
// и `users.allWordsActive`, чтобы не нарушать FK на `collections.id`.

export const ALL_WORDS_COLLECTION_ID = -1;

const ALL_WORDS_TITLE = 'Все слова';
const ALL_WORDS_DESCRIPTION =
  'Все слова словаря Wordy. Глобальная коллекция — расширяется автоматически при добавлении новых слов';
const ALL_WORDS_ICON = 'Database02Icon';
const ALL_WORDS_CATEGORY = 'featured';

export function isAllWordsCollection(id: number): boolean {
  return id === ALL_WORDS_COLLECTION_ID;
}

// Фильтры для глобального пула: rank ≤ 3, non-functional POS, не артикли.
const allWordsMeaningFilter = and(
  or(
    isNull(wordMeanings.popularityRank),
    lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
  ),
  or(
    isNull(wordMeanings.translationPartOfSpeech),
    notInArray(wordMeanings.translationPartOfSpeech, [...FUNCTIONAL_POS]),
  ),
  notInArray(words.text, [...FUNCTIONAL_ENGLISH_WORDS]),
);

type AllWordsSubscription = { subscribed: boolean; active: boolean };

async function getAllWordsSubscription(userId: number): Promise<AllWordsSubscription> {
  const row = await db
    .select({
      subscribed: users.allWordsSubscribed,
      active: users.allWordsActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row.length === 0) return { subscribed: false, active: false };
  return { subscribed: row[0].subscribed, active: row[0].active };
}

// Размер глобальной коллекции (количество УНИКАЛЬНЫХ слов после фильтра).
async function countAllWordsTotalWords(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${wordMeanings.wordId})::int` })
    .from(wordMeanings)
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .where(allWordsMeaningFilter);
  return row?.n ?? 0;
}

// Количество выученных слов юзера в глобальном пуле.
async function countAllWordsMastered(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${wordMeanings.wordId})::int` })
    .from(wordMeanings)
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .innerJoin(
      userWordProgressWord,
      and(
        eq(userWordProgressWord.wordId, wordMeanings.wordId),
        eq(userWordProgressWord.userId, userId),
      ),
    )
    .where(and(allWordsMeaningFilter, WORD_IS_MASTERED_SQL));
  return row?.n ?? 0;
}

// Все meaningId из глобального пула. Возвращает обычный массив.
// Используется в getActiveMeaningIds и getQuizPool.
async function getAllWordsMeaningIds(): Promise<{ meaningId: number; popularityRank: number | null }[]> {
  return db
    .select({
      meaningId: wordMeanings.id,
      popularityRank: wordMeanings.popularityRank,
    })
    .from(wordMeanings)
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .where(allWordsMeaningFilter);
}

// ─── Marketplace ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['featured', 'level', 'oxford', 'pos', 'topic'] as const;
const CATEGORY_TITLES: Record<string, string> = {
  featured: 'Главное',
  level: 'По уровню',
  oxford: 'Словари-стандарты',
  pos: 'По частям речи',
  topic: 'По темам',
};

export async function getMarketplace(userId: number) {
  const systemCollections = await db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      iconName: collections.iconName,
      cefrLevel: collections.cefrLevel,
      totalWords: collections.totalWords,
      price: collections.price,
      category: collections.category,
    })
    .from(collections)
    .where(
      and(
        eq(collections.type, 'system'),
        eq(collections.isPublished, true),
        isNull(collections.deletedAt),
      ),
    );

  const userSubs = await db
    .select({ collectionId: userCollections.collectionId })
    .from(userCollections)
    .where(eq(userCollections.userId, userId));

  const subscribedIds = new Set(userSubs.map((s) => s.collectionId));

  const withLibrary = systemCollections.map((c) => ({
    ...c,
    isInLibrary: subscribedIds.has(c.id),
  }));

  // Virtual "All Words" — динамически считаем размер пула и подписку юзера.
  const [allWordsTotal, allWordsSub] = await Promise.all([
    countAllWordsTotalWords(),
    getAllWordsSubscription(userId),
  ]);

  const virtualAllWords = {
    id: ALL_WORDS_COLLECTION_ID,
    title: ALL_WORDS_TITLE,
    description: ALL_WORDS_DESCRIPTION,
    iconName: ALL_WORDS_ICON,
    cefrLevel: null,
    totalWords: allWordsTotal,
    price: null,
    category: ALL_WORDS_CATEGORY,
    isInLibrary: allWordsSub.subscribed,
  };

  // Group by category
  const grouped = new Map<string, typeof withLibrary>();
  for (const c of withLibrary) {
    const key = c.category ?? 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }
  // Виртуальная коллекция всегда в группе `featured` первым элементом.
  grouped.set(ALL_WORDS_CATEGORY, [virtualAllWords, ...(grouped.get(ALL_WORDS_CATEGORY) ?? [])]);

  const groups: { key: string; title: string; collections: typeof withLibrary }[] = [];

  for (const key of CATEGORY_ORDER) {
    const items = grouped.get(key);
    if (items) {
      groups.push({ key, title: CATEGORY_TITLES[key] ?? key, collections: items });
    }
  }

  const other = grouped.get('other');
  if (other) {
    groups.push({ key: 'other', title: 'Другое', collections: other });
  }

  return groups;
}

// ─── User Library ───────────────────────────────────────────────────────────

export async function getLibrary(userId: number) {
  const subs = await db
    .select({
      collectionId: userCollections.collectionId,
      isActive: userCollections.isActive,
      addedAt: userCollections.addedAt,
    })
    .from(userCollections)
    .where(eq(userCollections.userId, userId));

  // Виртуальная «Все слова» — отдельная подписка в users.
  const allWordsSub = await getAllWordsSubscription(userId);
  const virtualAllWordsRow = allWordsSub.subscribed
    ? await (async () => {
        const [total, mastered] = await Promise.all([
          countAllWordsTotalWords(),
          countAllWordsMastered(userId),
        ]);
        return {
          id: ALL_WORDS_COLLECTION_ID,
          type: 'system' as const,
          title: ALL_WORDS_TITLE,
          description: ALL_WORDS_DESCRIPTION,
          iconName: ALL_WORDS_ICON,
          cefrLevel: null,
          totalWords: total,
          price: null,
          isActive: allWordsSub.active,
          addedAt: null,
          masteredWords: mastered,
        };
      })()
    : null;

  if (subs.length === 0) return virtualAllWordsRow ? [virtualAllWordsRow] : [];

  const collectionIds = subs.map((s) => s.collectionId);
  const cols = await db
    .select({
      id: collections.id,
      type: collections.type,
      title: collections.title,
      description: collections.description,
      iconName: collections.iconName,
      cefrLevel: collections.cefrLevel,
      totalWords: collections.totalWords,
      price: collections.price,
    })
    .from(collections)
    .where(and(inArray(collections.id, collectionIds), isNull(collections.deletedAt)));

  // SRS progress per collection: count mastered WORDS (через word-level прогресс).
  // Слово считается выученным когда tier IN ('review', 'mastered').
  const masteredSq = db
    .select({
      collectionId: collectionWords.collectionId,
      wordId: wordMeanings.wordId,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(
      userWordProgressWord,
      and(
        eq(userWordProgressWord.wordId, wordMeanings.wordId),
        eq(userWordProgressWord.userId, userId),
      ),
    )
    .where(and(inArray(collectionWords.collectionId, collectionIds), WORD_IS_MASTERED_SQL))
    .groupBy(collectionWords.collectionId, wordMeanings.wordId)
    .as('mastered_words');

  const progressRows = await db
    .select({
      collectionId: masteredSq.collectionId,
      masteredCount: sql<number>`count(*)`,
    })
    .from(masteredSq)
    .groupBy(masteredSq.collectionId);

  // SRS progress for custom words per collection
  const customProgressRows = await db
    .select({
      collectionId: userCustomWords.collectionId,
      masteredCount: sql<number>`count(*) filter (where ${userCustomWordProgress.srsStage} >= 3)`,
    })
    .from(userCustomWords)
    .innerJoin(
      userCustomWordProgress,
      and(
        eq(userCustomWordProgress.customWordId, userCustomWords.id),
        eq(userCustomWordProgress.userId, userId),
      ),
    )
    .where(inArray(userCustomWords.collectionId, collectionIds))
    .groupBy(userCustomWords.collectionId);

  const progressMap = new Map(progressRows.map((r) => [r.collectionId, Number(r.masteredCount)]));
  const customProgressMap = new Map(customProgressRows.map((r) => [r.collectionId, Number(r.masteredCount)]));
  const subsMap = new Map(subs.map((s) => [s.collectionId, s]));

  const realRows = cols.map((c) => ({
    ...c,
    isActive: subsMap.get(c.id)?.isActive ?? true,
    addedAt: subsMap.get(c.id)?.addedAt ?? null,
    masteredWords: (progressMap.get(c.id) ?? 0) + (customProgressMap.get(c.id) ?? 0),
  }));

  return virtualAllWordsRow ? [virtualAllWordsRow, ...realRows] : realRows;
}

// ─── Collection Detail ──────────────────────────────────────────────────────

export async function getCollectionDetail(collectionId: number, userId: number) {
  // Виртуальная «Все слова» — список строится из всех wordMeanings.
  if (isAllWordsCollection(collectionId)) {
    return getAllWordsCollectionDetail(userId);
  }

  const col = await db.query.collections.findFirst({
    where: and(eq(collections.id, collectionId), isNull(collections.deletedAt)),
  });

  if (!col) return null;

  // Фильтр по популярности: только топ-N переводов
  const popularityFilter = or(
    isNull(wordMeanings.popularityRank),
    lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
  );

  // Системные слова с SRS-прогрессом и popularity.
  // srsStage выводится из word-level tier (см. TIER_TO_SRS_STAGE_SQL вверху файла).
  const systemWords = await db
    .select({
      id: wordMeanings.id,
      word: words.text,
      lemma: words.lemma,
      transcription: words.transcription,
      translation: wordMeanings.translation,
      alternativeTranslations: wordMeanings.alternativeTranslations,
      partOfSpeech: wordMeanings.partOfSpeech,
      contextExample: wordMeanings.contextExample,
      examples: wordMeanings.examples,
      synonyms: wordMeanings.synonyms,
      meaningHints: wordMeanings.meaningHints,
      frequency: wordMeanings.frequency,
      srsStage: TIER_TO_SRS_STAGE_SQL,
      popularityRank: words.frequencyRank,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .leftJoin(
      userWordProgressWord,
      and(
        eq(userWordProgressWord.wordId, wordMeanings.wordId),
        eq(userWordProgressWord.userId, userId),
      ),
    )
    .where(and(eq(collectionWords.collectionId, collectionId), popularityFilter))
    .orderBy(collectionWords.order, asc(wordMeanings.popularityRank));

  // Кастомные слова с SRS-прогрессом
  const customWords = await db
    .select({
      id: userCustomWords.id,
      word: userCustomWords.wordText,
      translation: userCustomWords.translation,
      partOfSpeech: userCustomWords.partOfSpeech,
      contextExample: userCustomWords.contextExample,
      srsStage: userCustomWordProgress.srsStage,
    })
    .from(userCustomWords)
    .leftJoin(
      userCustomWordProgress,
      and(
        eq(userCustomWordProgress.customWordId, userCustomWords.id),
        eq(userCustomWordProgress.userId, userId),
      ),
    )
    .where(eq(userCustomWords.collectionId, collectionId));

  // Проверяем подписку
  const sub = await db.query.userCollections.findFirst({
    where: and(
      eq(userCollections.userId, userId),
      eq(userCollections.collectionId, collectionId),
    ),
  });

  const wordsWithProgress = [
    ...systemWords.map((w) => ({
      ...w,
      srsStage: w.srsStage, // null = не встречалось, number = прогресс (может быть отрицательным)
      lemma: w.lemma ?? undefined,
      transcription: w.transcription ?? undefined,
      alternativeTranslations: w.alternativeTranslations ?? undefined,
      contextExample: w.contextExample ?? undefined,
      examples: (w.examples as { text: string; translation: string }[] | null) ?? undefined,
      synonyms: w.synonyms ?? undefined,
      meaningHints: w.meaningHints ?? undefined,
      frequency: w.frequency ?? undefined,
      popularityRank: w.popularityRank ?? undefined,
    })),
    ...customWords.map((w) => ({
      ...w,
      srsStage: w.srsStage, // null = не встречалось
      lemma: undefined as string | undefined,
      transcription: undefined as string | undefined,
      alternativeTranslations: undefined as string[] | undefined,
      contextExample: w.contextExample ?? undefined,
      examples: undefined as { text: string; translation: string }[] | undefined,
      synonyms: undefined as string[] | undefined,
      meaningHints: undefined as string[] | undefined,
      frequency: undefined as number | undefined,
      popularityRank: undefined as number | undefined,
    })),
  ];

  return {
    collection: {
      ...col,
      isInLibrary: !!sub,
      isActive: sub?.isActive ?? false,
    },
    words: wordsWithProgress,
  };
}

async function getAllWordsCollectionDetail(userId: number) {
  const allWordsSub = await getAllWordsSubscription(userId);
  const totalWords = await countAllWordsTotalWords();

  // Список слов: все wordMeanings, прошедшие фильтр (rank ≤ 3, non-functional).
  // Сортировка по frequency_rank (как в обычных коллекциях).
  const systemWords = await db
    .select({
      id: wordMeanings.id,
      word: words.text,
      lemma: words.lemma,
      transcription: words.transcription,
      translation: wordMeanings.translation,
      alternativeTranslations: wordMeanings.alternativeTranslations,
      partOfSpeech: wordMeanings.partOfSpeech,
      contextExample: wordMeanings.contextExample,
      examples: wordMeanings.examples,
      synonyms: wordMeanings.synonyms,
      meaningHints: wordMeanings.meaningHints,
      frequency: wordMeanings.frequency,
      srsStage: TIER_TO_SRS_STAGE_SQL,
      popularityRank: words.frequencyRank,
    })
    .from(wordMeanings)
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .leftJoin(
      userWordProgressWord,
      and(
        eq(userWordProgressWord.wordId, wordMeanings.wordId),
        eq(userWordProgressWord.userId, userId),
      ),
    )
    .where(allWordsMeaningFilter)
    .orderBy(asc(words.frequencyRank), asc(wordMeanings.popularityRank));

  return {
    collection: {
      id: ALL_WORDS_COLLECTION_ID,
      type: 'system' as const,
      creatorId: null,
      title: ALL_WORDS_TITLE,
      description: ALL_WORDS_DESCRIPTION,
      iconName: ALL_WORDS_ICON,
      cefrLevel: null,
      price: null,
      isPublished: true,
      category: ALL_WORDS_CATEGORY,
      totalWords,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
      isInLibrary: allWordsSub.subscribed,
      isActive: allWordsSub.active,
    },
    words: systemWords.map((w) => ({
      ...w,
      lemma: w.lemma ?? undefined,
      transcription: w.transcription ?? undefined,
      alternativeTranslations: w.alternativeTranslations ?? undefined,
      contextExample: w.contextExample ?? undefined,
      examples: (w.examples as { text: string; translation: string }[] | null) ?? undefined,
      synonyms: w.synonyms ?? undefined,
      meaningHints: w.meaningHints ?? undefined,
      frequency: w.frequency ?? undefined,
      popularityRank: w.popularityRank ?? undefined,
    })),
  };
}

// ─── Subscribe / Unsubscribe ────────────────────────────────────────────────

export async function subscribe(userId: number, collectionId: number) {
  if (isAllWordsCollection(collectionId)) {
    await db
      .update(users)
      .set({ allWordsSubscribed: true, allWordsActive: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return;
  }
  await db
    .insert(userCollections)
    .values({ userId, collectionId, isActive: true })
    .onConflictDoNothing();
}

export async function unsubscribe(userId: number, collectionId: number) {
  if (isAllWordsCollection(collectionId)) {
    await db
      .update(users)
      .set({ allWordsSubscribed: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return;
  }
  await db
    .delete(userCollections)
    .where(
      and(eq(userCollections.userId, userId), eq(userCollections.collectionId, collectionId)),
    );
}

export async function toggleActive(userId: number, collectionId: number, isActive: boolean) {
  if (isAllWordsCollection(collectionId)) {
    await db
      .update(users)
      .set({ allWordsActive: isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return;
  }
  await db
    .update(userCollections)
    .set({ isActive })
    .where(
      and(eq(userCollections.userId, userId), eq(userCollections.collectionId, collectionId)),
    );
}

// ─── Create User Collection ─────────────────────────────────────────────────

type CreateCollectionInput = {
  title: string;
  description?: string;
  words?: { wordText: string; translation: string; partOfSpeech?: string; contextExample?: string }[];
};

export async function createUserCollection(userId: number, input: CreateCollectionInput) {
  // Проверяем лимит коллекций для бесплатного плана
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collections)
    .where(
      and(
        eq(collections.creatorId, userId),
        eq(collections.type, 'user'),
        isNull(collections.deletedAt),
      ),
    );

  if (existingCount >= FREE_LIMITS.MAX_CUSTOM_COLLECTIONS) {
    throw new Error('COLLECTION_LIMIT_REACHED');
  }

  const [col] = await db
    .insert(collections)
    .values({
      type: 'user',
      creatorId: userId,
      title: input.title,
      description: input.description,
      totalWords: input.words?.length ?? 0,
    })
    .returning();

  // Автоподписка
  await db.insert(userCollections).values({
    userId,
    collectionId: col!.id,
    isActive: true,
  });

  // Добавляем кастомные слова
  if (input.words && input.words.length > 0) {
    await db.insert(userCustomWords).values(
      input.words.map((w) => ({
        userId,
        collectionId: col!.id,
        wordText: w.wordText,
        translation: w.translation,
        partOfSpeech: (w.partOfSpeech ?? 'noun') as 'noun' | 'verb' | 'adj' | 'adv' | 'phrase',
        contextExample: w.contextExample,
      })),
    );
  }

  return col!.id;
}

// ─── Update User Collection ─────────────────────────────────────────────────

type UpdateCollectionInput = {
  title?: string;
  description?: string;
  words?: { wordText: string; translation: string; partOfSpeech?: string; contextExample?: string }[];
};

export async function updateUserCollection(
  userId: number,
  collectionId: number,
  input: UpdateCollectionInput,
) {
  const col = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.creatorId, userId),
      eq(collections.type, 'user'),
    ),
  });

  if (!col) throw new Error('Коллекция не найдена');

  if (input.title || input.description) {
    await db
      .update(collections)
      .set({
        ...(input.title && { title: input.title }),
        ...(input.description && { description: input.description }),
        updatedAt: new Date(),
      })
      .where(eq(collections.id, collectionId));
  }

  if (input.words) {
    // Заменяем все кастомные слова
    await db
      .delete(userCustomWords)
      .where(eq(userCustomWords.collectionId, collectionId));

    if (input.words.length > 0) {
      await db.insert(userCustomWords).values(
        input.words.map((w) => ({
          userId,
          collectionId,
          wordText: w.wordText,
          translation: w.translation,
          partOfSpeech: (w.partOfSpeech ?? 'noun') as 'noun' | 'verb' | 'adj' | 'adv' | 'phrase',
          contextExample: w.contextExample,
        })),
      );
    }

    await db
      .update(collections)
      .set({ totalWords: input.words.length, updatedAt: new Date() })
      .where(eq(collections.id, collectionId));
  }
}

// ─── Delete User Collection ─────────────────────────────────────────────────

export async function deleteUserCollection(userId: number, collectionId: number) {
  const col = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.creatorId, userId),
      eq(collections.type, 'user'),
    ),
  });

  if (!col) throw new Error('Коллекция не найдена');

  await db
    .update(collections)
    .set({ deletedAt: new Date() })
    .where(eq(collections.id, collectionId));
}

// ─── All Words (deduplicated across library) ────────────────────────────────

export async function getAllWords(userId: number) {
  const subs = await db
    .select({ collectionId: userCollections.collectionId })
    .from(userCollections)
    .where(eq(userCollections.userId, userId));

  if (subs.length === 0) return { words: [] };

  const collectionIds = subs.map((s) => s.collectionId);

  // Фильтр по популярности: только топ-N переводов
  const popularityFilter = or(
    isNull(wordMeanings.popularityRank),
    lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
  );

  // System words from collections with SRS progress and popularity.
  // srsStage выводится из word-level tier (см. TIER_TO_SRS_STAGE_SQL вверху файла).
  const systemWords = await db
    .select({
      id: wordMeanings.id,
      word: words.text,
      lemma: words.lemma,
      transcription: words.transcription,
      translation: wordMeanings.translation,
      alternativeTranslations: wordMeanings.alternativeTranslations,
      partOfSpeech: wordMeanings.partOfSpeech,
      srsStage: TIER_TO_SRS_STAGE_SQL,
      popularityRank: wordMeanings.popularityRank,
      frequencyRank: words.frequencyRank,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .leftJoin(
      userWordProgressWord,
      and(
        eq(userWordProgressWord.wordId, wordMeanings.wordId),
        eq(userWordProgressWord.userId, userId),
      ),
    )
    .where(and(inArray(collectionWords.collectionId, collectionIds), popularityFilter))
    .orderBy(asc(wordMeanings.popularityRank));

  // Custom words from collections with SRS progress
  const customWordRows = await db
    .select({
      id: userCustomWords.id,
      word: userCustomWords.wordText,
      translation: userCustomWords.translation,
      partOfSpeech: userCustomWords.partOfSpeech,
      srsStage: userCustomWordProgress.srsStage,
    })
    .from(userCustomWords)
    .leftJoin(
      userCustomWordProgress,
      and(
        eq(userCustomWordProgress.customWordId, userCustomWords.id),
        eq(userCustomWordProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(userCustomWords.userId, userId),
        inArray(userCustomWords.collectionId, collectionIds),
      ),
    );

  // Deduplicate by word+translation
  const seen = new Set<string>();
  const result: {
    id?: number;
    word: string;
    lemma?: string;
    transcription?: string;
    translation: string;
    alternativeTranslations?: string[];
    partOfSpeech?: string;
    srsStage?: number;
    popularityRank?: number;
  }[] = [];

  for (const w of [...systemWords, ...customWordRows]) {
    const key = `${w.word}::${w.translation}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        id: w.id,
        word: w.word,
        lemma: 'lemma' in w ? ((w.lemma as string | null) ?? undefined) : undefined,
        transcription: 'transcription' in w ? ((w.transcription as string | null) ?? undefined) : undefined,
        translation: w.translation,
        alternativeTranslations: 'alternativeTranslations' in w ? (w.alternativeTranslations as string[] | null) ?? undefined : undefined,
        partOfSpeech: w.partOfSpeech ?? undefined,
        srsStage: w.srsStage ?? undefined, // undefined = не встречалось
        popularityRank: 'frequencyRank' in w ? ((w.frequencyRank as number | null) ?? undefined) : undefined,
      });
    }
  }

  return { words: result };
}

// ─── Get Active Pool Meaning IDs ────────────────────────────────────────────

export async function getActiveMeaningIds(userId: number): Promise<number[]> {
  // Если активна виртуальная «Все слова» — возвращаем глобальный пул
  // (он надмножество всех остальных коллекций, дополнительные подписки не дают
  // новых meanings, поэтому их можно не запрашивать).
  const allWordsSub = await getAllWordsSubscription(userId);
  if (allWordsSub.subscribed && allWordsSub.active) {
    const rows = await getAllWordsMeaningIds();
    return [...new Set(rows.map((r) => r.meaningId))];
  }

  // Получаем активные коллекции пользователя
  const activeSubs = await db
    .select({ collectionId: userCollections.collectionId })
    .from(userCollections)
    .where(and(eq(userCollections.userId, userId), eq(userCollections.isActive, true)));

  if (activeSubs.length === 0) return [];

  const collectionIds = activeSubs.map((s) => s.collectionId);

  // Системные слова из коллекций
  const systemMeanings = await db
    .select({ meaningId: collectionWords.meaningId })
    .from(collectionWords)
    .where(inArray(collectionWords.collectionId, collectionIds));

  const meaningIds = new Set(systemMeanings.map((m) => m.meaningId));

  return Array.from(meaningIds);
}

// ─── Quiz Pool (meanings + custom words) ─────────────────────────────────────

export type CustomWordForQuiz = {
  id: number;
  wordText: string;
  translation: string;
};

export type QuizPool = {
  meaningIds: number[];
  customWords: CustomWordForQuiz[];
};

export async function getQuizPool(userId: number, collectionId?: number): Promise<QuizPool> {
  // Виртуальная «Все слова»: либо явная изоляция на -1, либо активна без указания коллекции.
  // В этом режиме источник meanings — глобальный пул, а не collectionWords.
  let useAllWordsPool = false;
  let collectionIds: number[] = [];

  if (collectionId !== undefined) {
    if (isAllWordsCollection(collectionId)) {
      const sub = await getAllWordsSubscription(userId);
      if (!sub.subscribed) return { meaningIds: [], customWords: [] };
      useAllWordsPool = true;
    } else {
      // Изоляция — только одна коллекция (проверяем что пользователь подписан)
      const sub = await db.query.userCollections.findFirst({
        where: and(
          eq(userCollections.userId, userId),
          eq(userCollections.collectionId, collectionId),
        ),
      });
      if (!sub) return { meaningIds: [], customWords: [] };
      collectionIds = [collectionId];
    }
  } else {
    // Все активные источники: виртуальная коллекция (если активна) перекрывает все обычные.
    const allWordsSub = await getAllWordsSubscription(userId);
    if (allWordsSub.subscribed && allWordsSub.active) {
      useAllWordsPool = true;
    } else {
      const activeSubs = await db
        .select({ collectionId: userCollections.collectionId })
        .from(userCollections)
        .where(and(eq(userCollections.userId, userId), eq(userCollections.isActive, true)));

      if (activeSubs.length === 0) return { meaningIds: [], customWords: [] };
      collectionIds = activeSubs.map((s) => s.collectionId);
    }
  }

  // Фильтр по популярности: только топ-N переводов
  const popularityFilter = or(
    isNull(wordMeanings.popularityRank),
    lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
  );

  // Фильтр по частотности: исключаем редкие переводы
  const frequencyFilter = or(
    isNull(wordMeanings.frequency),
    gte(wordMeanings.frequency, MIN_FREQUENCY),
  );

  // Словарные слова с popularity rank (для ранговых слоёв)
  const systemMeanings = useAllWordsPool
    ? await db
        .select({
          meaningId: wordMeanings.id,
          popularityRank: wordMeanings.popularityRank,
        })
        .from(wordMeanings)
        .innerJoin(words, eq(wordMeanings.wordId, words.id))
        .where(and(allWordsMeaningFilter, frequencyFilter))
    : await db
        .select({
          meaningId: collectionWords.meaningId,
          popularityRank: wordMeanings.popularityRank,
        })
        .from(collectionWords)
        .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
        .where(and(inArray(collectionWords.collectionId, collectionIds), popularityFilter, frequencyFilter));

  const allMeaningIds = [...new Set(systemMeanings.map((m) => m.meaningId))];

  // Ранговые слои: rank 1 → rank 2 → rank 3
  // Rank N открывается когда ВСЕ meanings rank N-1 изучены (srsStage >= LEARNED_PROGRESS)
  const byRank = new Map<number, number[]>();
  for (const m of systemMeanings) {
    const rank = m.popularityRank ?? 1;
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank)!.push(m.meaningId);
  }
  // Дедупликация внутри рангов
  for (const [rank, ids] of byRank) {
    byRank.set(rank, [...new Set(ids)]);
  }

  // Получаем прогресс пользователя для определения разблокированных рангов.
  // После word-level redesign прогресс хранится per-word; маппим в per-meaning
  // через JOIN wordMeanings → userWordProgressWord по wordId.
  let progressMap = new Map<number, number>();
  if (allMeaningIds.length > 0) {
    const progressRows = await db
      .select({
        meaningId: wordMeanings.id,
        srsStage: TIER_TO_SRS_STAGE_SQL,
      })
      .from(wordMeanings)
      .leftJoin(
        userWordProgressWord,
        and(
          eq(userWordProgressWord.wordId, wordMeanings.wordId),
          eq(userWordProgressWord.userId, userId),
        ),
      )
      .where(inArray(wordMeanings.id, allMeaningIds));
    progressMap = new Map(progressRows.map((p) => [p.meaningId, p.srsStage ?? 0]));
  }

  // Определяем разблокированные ранги
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const unlockedMeaningIds: number[] = [];

  for (const rank of ranks) {
    const rankIds = byRank.get(rank)!;
    unlockedMeaningIds.push(...rankIds);

    // Проверяем, все ли meanings текущего ранга изучены
    const allLearned = rankIds.every((id) => (progressMap.get(id) ?? 0) >= LEARNED_PROGRESS);
    if (!allLearned) break; // Не открываем следующий ранг
  }

  // Кастомные слова (без ранговых ограничений).
  // Для виртуальной «Все слова» — все кастомные слова юзера во всех его коллекциях.
  const custom = useAllWordsPool
    ? await db
        .select({
          id: userCustomWords.id,
          wordText: userCustomWords.wordText,
          translation: userCustomWords.translation,
        })
        .from(userCustomWords)
        .where(eq(userCustomWords.userId, userId))
    : await db
        .select({
          id: userCustomWords.id,
          wordText: userCustomWords.wordText,
          translation: userCustomWords.translation,
        })
        .from(userCustomWords)
        .where(
          and(
            eq(userCustomWords.userId, userId),
            inArray(userCustomWords.collectionId, collectionIds),
          ),
        );

  return { meaningIds: unlockedMeaningIds, customWords: custom };
}

// ─── Add Words to Collection ─────────────────────────────────────────────

type AddWordsInput = {
  meaningIds?: number[];
  custom?: { wordText: string; translation: string; partOfSpeech?: string }[];
};

export async function addWordsToCollection(
  userId: number,
  collectionId: number,
  input: AddWordsInput,
) {
  const col = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.creatorId, userId),
      isNull(collections.deletedAt),
    ),
  });

  if (!col) throw new Error('Коллекция не найдена');

  // Проверяем лимит слов для пользовательских коллекций (бесплатный план)
  if (col.type === 'user') {
    const [{ sysCount }] = await db
      .select({ sysCount: sql<number>`count(*)::int` })
      .from(collectionWords)
      .where(eq(collectionWords.collectionId, collectionId));

    const [{ customCount }] = await db
      .select({ customCount: sql<number>`count(*)::int` })
      .from(userCustomWords)
      .where(eq(userCustomWords.collectionId, collectionId));

    const currentTotal = sysCount + customCount;
    const toAdd = (input.meaningIds?.length ?? 0) + (input.custom?.length ?? 0);

    if (currentTotal + toAdd > FREE_LIMITS.MAX_WORDS_PER_COLLECTION) {
      throw new Error('WORD_LIMIT_REACHED');
    }
  }

  let added = 0;

  // Добавляем системные слова (из словаря)
  if (input.meaningIds && input.meaningIds.length > 0) {
    // Проверяем какие уже есть
    const existing = await db
      .select({ meaningId: collectionWords.meaningId })
      .from(collectionWords)
      .where(
        and(
          eq(collectionWords.collectionId, collectionId),
          inArray(collectionWords.meaningId, input.meaningIds),
        ),
      );
    const existingIds = new Set(existing.map((e) => e.meaningId));
    const newMeaningIds = input.meaningIds.filter((id) => !existingIds.has(id));

    if (newMeaningIds.length > 0) {
      const maxOrder = await db
        .select({ max: sql<number>`coalesce(max(${collectionWords.order}), 0)` })
        .from(collectionWords)
        .where(eq(collectionWords.collectionId, collectionId));

      let order = (maxOrder[0]?.max ?? 0) + 1;

      for (const meaningId of newMeaningIds) {
        await db
          .insert(collectionWords)
          .values({ collectionId, meaningId, order });
        order++;
        added++;
      }
    }
  }

  // Добавляем кастомные слова (ручной ввод)
  if (input.custom && input.custom.length > 0) {
    for (const w of input.custom) {
      // Проверяем дубликат
      const dup = await db
        .select({ id: userCustomWords.id })
        .from(userCustomWords)
        .where(
          and(
            eq(userCustomWords.collectionId, collectionId),
            eq(userCustomWords.wordText, w.wordText),
            eq(userCustomWords.translation, w.translation),
          ),
        )
        .limit(1);

      if (dup.length === 0) {
        await db.insert(userCustomWords).values({
          userId,
          collectionId,
          wordText: w.wordText,
          translation: w.translation,
          partOfSpeech: (w.partOfSpeech ?? 'noun') as 'noun' | 'verb' | 'adj' | 'adv' | 'phrase',
        });
        added++;
      }
    }
  }

  // Обновляем totalWords
  if (added > 0) {
    await db
      .update(collections)
      .set({
        totalWords: sql`${collections.totalWords} + ${added}`,
        updatedAt: new Date(),
      })
      .where(eq(collections.id, collectionId));
  }

  return { added };
}

// ─── Remove Word from Collection ─────────────────────────────────────────

export async function removeWordFromCollection(
  userId: number,
  collectionId: number,
  wordId: number,
  type: 'meaning' | 'custom',
) {
  const col = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.creatorId, userId),
      isNull(collections.deletedAt),
    ),
  });

  if (!col) throw new Error('Коллекция не найдена');

  let deleted = 0;

  if (type === 'meaning') {
    const result = await db
      .delete(collectionWords)
      .where(
        and(
          eq(collectionWords.collectionId, collectionId),
          eq(collectionWords.meaningId, wordId),
        ),
      )
      .returning();
    deleted = result.length;
  } else {
    const result = await db
      .delete(userCustomWords)
      .where(
        and(
          eq(userCustomWords.id, wordId),
          eq(userCustomWords.collectionId, collectionId),
          eq(userCustomWords.userId, userId),
        ),
      )
      .returning();
    deleted = result.length;
  }

  if (deleted > 0) {
    await db
      .update(collections)
      .set({
        totalWords: sql`greatest(${collections.totalWords} - ${deleted}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(collections.id, collectionId));
  }

  return { deleted };
}

export async function getActiveCustomWords(userId: number) {
  // Виртуальная «Все слова»: все кастомные слова юзера.
  const allWordsSub = await getAllWordsSubscription(userId);
  if (allWordsSub.subscribed && allWordsSub.active) {
    return db.select().from(userCustomWords).where(eq(userCustomWords.userId, userId));
  }

  const activeSubs = await db
    .select({ collectionId: userCollections.collectionId })
    .from(userCollections)
    .where(and(eq(userCollections.userId, userId), eq(userCollections.isActive, true)));

  if (activeSubs.length === 0) return [];

  const collectionIds = activeSubs.map((s) => s.collectionId);

  return db
    .select()
    .from(userCustomWords)
    .where(
      and(
        eq(userCustomWords.userId, userId),
        inArray(userCustomWords.collectionId, collectionIds),
      ),
    );
}
