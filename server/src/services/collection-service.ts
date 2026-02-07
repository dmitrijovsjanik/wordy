import { eq, and, sql, isNull, inArray, or, lte, lt, gte, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  collections,
  collectionWords,
  userCollections,
  userCustomWords,
  userCustomWordProgress,
  userWordProgress,
  wordMeanings,
  words,
} from '../db/schema.js';
import { ERRORS_EXIT_SRS_STAGE, ERRORS_COLLECTION_ID } from '../config/errors-config.js';
import { LEARNED_PROGRESS } from './srs-service.js';

// ─── Constants ──────────────────────────────────────────────────────────────

// Максимальный ранг популярности для отображения (1 = самый популярный)
const MAX_POPULARITY_RANK = 3;

// Минимальная частотность перевода (fr из Yandex API)
// fr=1 — очень редкие переводы (град=city), fr=5/10 — популярные
const MIN_FREQUENCY = 5;

// ─── Marketplace ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['level', 'pos', 'topic'] as const;
const CATEGORY_TITLES: Record<string, string> = {
  level: 'По уровню',
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

  // Group by category
  const grouped = new Map<string, typeof withLibrary>();
  for (const c of withLibrary) {
    const key = c.category ?? 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

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

  if (subs.length === 0) return [];

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

  // SRS progress per collection: count mastered words
  const progressRows = await db
    .select({
      collectionId: collectionWords.collectionId,
      masteredCount: sql<number>`count(*) filter (where ${userWordProgress.srsStage} >= 3)`,
    })
    .from(collectionWords)
    .innerJoin(
      userWordProgress,
      and(
        eq(userWordProgress.meaningId, collectionWords.meaningId),
        eq(userWordProgress.userId, userId),
      ),
    )
    .where(inArray(collectionWords.collectionId, collectionIds))
    .groupBy(collectionWords.collectionId);

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

  return cols.map((c) => ({
    ...c,
    isActive: subsMap.get(c.id)?.isActive ?? true,
    addedAt: subsMap.get(c.id)?.addedAt,
    masteredWords: (progressMap.get(c.id) ?? 0) + (customProgressMap.get(c.id) ?? 0),
  }));
}

// ─── Collection Detail ──────────────────────────────────────────────────────

export async function getCollectionDetail(collectionId: number, userId: number) {
  const col = await db.query.collections.findFirst({
    where: and(eq(collections.id, collectionId), isNull(collections.deletedAt)),
  });

  if (!col) return null;

  // Фильтр по популярности: только топ-N переводов
  const popularityFilter = or(
    isNull(wordMeanings.popularityRank),
    lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
  );

  // Системные слова с SRS-прогрессом и popularity
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
      srsStage: userWordProgress.srsStage,
      popularityRank: words.frequencyRank,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .leftJoin(
      userWordProgress,
      and(
        eq(userWordProgress.meaningId, wordMeanings.id),
        eq(userWordProgress.userId, userId),
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

// ─── Subscribe / Unsubscribe ────────────────────────────────────────────────

export async function subscribe(userId: number, collectionId: number) {
  await db
    .insert(userCollections)
    .values({ userId, collectionId, isActive: true })
    .onConflictDoNothing();
}

export async function unsubscribe(userId: number, collectionId: number) {
  await db
    .delete(userCollections)
    .where(
      and(eq(userCollections.userId, userId), eq(userCollections.collectionId, collectionId)),
    );
}

export async function toggleActive(userId: number, collectionId: number, isActive: boolean) {
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

// ─── Errors Collection (auto-collection) ────────────────────────────────────

// Слова с ошибками, которые ещё не восстановлены (srsStage < ERRORS_EXIT_SRS_STAGE)
export async function getErrorsCollection(userId: number) {
  const progress = await db
    .select({
      meaningId: userWordProgress.meaningId,
      correctCount: userWordProgress.correctCount,
      incorrectCount: userWordProgress.incorrectCount,
      srsStage: userWordProgress.srsStage,
      word: words.text,
      translation: wordMeanings.translation,
    })
    .from(userWordProgress)
    .innerJoin(wordMeanings, eq(userWordProgress.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .where(
      and(
        eq(userWordProgress.userId, userId),
        sql`${userWordProgress.incorrectCount} > 0`,
        lt(userWordProgress.srsStage, ERRORS_EXIT_SRS_STAGE),
      ),
    )
    .orderBy(sql`${userWordProgress.incorrectCount} DESC`);

  // Кастомные слова с ошибками
  const customProgress = await db
    .select({
      meaningId: sql<number>`-${userCustomWordProgress.customWordId}`,
      correctCount: userCustomWordProgress.correctCount,
      incorrectCount: userCustomWordProgress.incorrectCount,
      srsStage: userCustomWordProgress.srsStage,
      word: userCustomWords.wordText,
      translation: userCustomWords.translation,
    })
    .from(userCustomWordProgress)
    .innerJoin(userCustomWords, eq(userCustomWordProgress.customWordId, userCustomWords.id))
    .where(
      and(
        eq(userCustomWordProgress.userId, userId),
        sql`${userCustomWordProgress.incorrectCount} > 0`,
        lt(userCustomWordProgress.srsStage, ERRORS_EXIT_SRS_STAGE),
      ),
    )
    .orderBy(sql`${userCustomWordProgress.incorrectCount} DESC`);

  const allErrors = [...progress, ...customProgress].sort(
    (a, b) => b.incorrectCount - a.incorrectCount,
  );

  return {
    totalWords: allErrors.length,
    words: allErrors,
    collection: {
      id: ERRORS_COLLECTION_ID,
      type: 'auto' as const,
      title: 'Ошибки',
      description: 'Слова, в которых вы ошибались',
      iconName: 'alert-02',
    },
  };
}

// Алиас для обратной совместимости
export const getDifficultWords = getErrorsCollection;

// Пул слов для квизов из коллекции ошибок
export async function getErrorsPool(userId: number): Promise<QuizPool> {
  const progress = await db
    .select({
      meaningId: userWordProgress.meaningId,
    })
    .from(userWordProgress)
    .where(
      and(
        eq(userWordProgress.userId, userId),
        sql`${userWordProgress.incorrectCount} > 0`,
        lt(userWordProgress.srsStage, ERRORS_EXIT_SRS_STAGE),
      ),
    );

  const meaningIds = progress.map((p) => p.meaningId);

  // Кастомные слова с ошибками
  const customProgress = await db
    .select({
      id: userCustomWords.id,
      wordText: userCustomWords.wordText,
      translation: userCustomWords.translation,
    })
    .from(userCustomWordProgress)
    .innerJoin(userCustomWords, eq(userCustomWordProgress.customWordId, userCustomWords.id))
    .where(
      and(
        eq(userCustomWordProgress.userId, userId),
        sql`${userCustomWordProgress.incorrectCount} > 0`,
        lt(userCustomWordProgress.srsStage, ERRORS_EXIT_SRS_STAGE),
      ),
    );

  return {
    meaningIds,
    customWords: customProgress,
  };
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

  // System words from collections with SRS progress and popularity
  const systemWords = await db
    .select({
      id: wordMeanings.id,
      word: words.text,
      lemma: words.lemma,
      transcription: words.transcription,
      translation: wordMeanings.translation,
      alternativeTranslations: wordMeanings.alternativeTranslations,
      partOfSpeech: wordMeanings.partOfSpeech,
      srsStage: userWordProgress.srsStage,
      popularityRank: wordMeanings.popularityRank,
      frequencyRank: words.frequencyRank,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .leftJoin(
      userWordProgress,
      and(
        eq(userWordProgress.meaningId, wordMeanings.id),
        eq(userWordProgress.userId, userId),
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
  let collectionIds: number[];

  if (collectionId) {
    // Изоляция — только одна коллекция (проверяем что пользователь подписан)
    const sub = await db.query.userCollections.findFirst({
      where: and(
        eq(userCollections.userId, userId),
        eq(userCollections.collectionId, collectionId),
      ),
    });
    if (!sub) return { meaningIds: [], customWords: [] };
    collectionIds = [collectionId];
  } else {
    // Все активные коллекции
    const activeSubs = await db
      .select({ collectionId: userCollections.collectionId })
      .from(userCollections)
      .where(and(eq(userCollections.userId, userId), eq(userCollections.isActive, true)));

    if (activeSubs.length === 0) return { meaningIds: [], customWords: [] };
    collectionIds = activeSubs.map((s) => s.collectionId);
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
  const systemMeanings = await db
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

  // Получаем прогресс пользователя для определения разблокированных рангов
  let progressMap = new Map<number, number>();
  if (allMeaningIds.length > 0) {
    const progressRows = await db
      .select({ meaningId: userWordProgress.meaningId, srsStage: userWordProgress.srsStage })
      .from(userWordProgress)
      .where(and(eq(userWordProgress.userId, userId), inArray(userWordProgress.meaningId, allMeaningIds)));
    progressMap = new Map(progressRows.map((p) => [p.meaningId, p.srsStage]));
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

  // Кастомные слова (без ранговых ограничений)
  const custom = await db
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
