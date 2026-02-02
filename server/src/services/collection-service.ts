import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  collections,
  collectionWords,
  userCollections,
  userCustomWords,
  userWordProgress,
  wordMeanings,
  words,
} from '../db/schema.js';

// ─── Marketplace ────────────────────────────────────────────────────────────

export async function getMarketplace(userId: number) {
  const systemCollections = await db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      iconName: collections.iconName,
      totalWords: collections.totalWords,
      price: collections.price,
    })
    .from(collections)
    .where(
      and(
        eq(collections.type, 'system'),
        eq(collections.isPublished, true),
        isNull(collections.deletedAt),
      ),
    );

  // Проверяем какие уже в библиотеке
  const userSubs = await db
    .select({ collectionId: userCollections.collectionId })
    .from(userCollections)
    .where(eq(userCollections.userId, userId));

  const subscribedIds = new Set(userSubs.map((s) => s.collectionId));

  return systemCollections.map((c) => ({
    ...c,
    isInLibrary: subscribedIds.has(c.id),
  }));
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
      totalWords: collections.totalWords,
      price: collections.price,
    })
    .from(collections)
    .where(and(inArray(collections.id, collectionIds), isNull(collections.deletedAt)));

  const subsMap = new Map(subs.map((s) => [s.collectionId, s]));

  return cols.map((c) => ({
    ...c,
    isActive: subsMap.get(c.id)?.isActive ?? true,
    addedAt: subsMap.get(c.id)?.addedAt,
  }));
}

// ─── Collection Detail ──────────────────────────────────────────────────────

export async function getCollectionDetail(collectionId: number, userId: number) {
  const col = await db.query.collections.findFirst({
    where: and(eq(collections.id, collectionId), isNull(collections.deletedAt)),
  });

  if (!col) return null;

  // Системные слова
  const systemWords = await db
    .select({
      id: wordMeanings.id,
      word: words.text,
      translation: wordMeanings.translation,
      partOfSpeech: wordMeanings.partOfSpeech,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .where(eq(collectionWords.collectionId, collectionId))
    .orderBy(collectionWords.order);

  // Кастомные слова
  const customWords = await db
    .select({
      id: userCustomWords.id,
      word: userCustomWords.wordText,
      translation: userCustomWords.translation,
      partOfSpeech: userCustomWords.partOfSpeech,
    })
    .from(userCustomWords)
    .where(eq(userCustomWords.collectionId, collectionId));

  // Проверяем подписку
  const sub = await db.query.userCollections.findFirst({
    where: and(
      eq(userCollections.userId, userId),
      eq(userCollections.collectionId, collectionId),
    ),
  });

  return {
    collection: {
      ...col,
      isInLibrary: !!sub,
      isActive: sub?.isActive ?? false,
    },
    words: [...systemWords, ...customWords],
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

// ─── Difficult Words (auto-collection) ──────────────────────────────────────

export async function getDifficultWords(userId: number) {
  const progress = await db
    .select({
      meaningId: userWordProgress.meaningId,
      correctCount: userWordProgress.correctCount,
      incorrectCount: userWordProgress.incorrectCount,
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
      ),
    )
    .orderBy(sql`${userWordProgress.incorrectCount} DESC`);

  return {
    totalWords: progress.length,
    words: progress,
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

  // System words from collections
  const systemWords = await db
    .select({
      word: words.text,
      translation: wordMeanings.translation,
    })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .where(inArray(collectionWords.collectionId, collectionIds));

  // Custom words from collections
  const customWordRows = await db
    .select({
      word: userCustomWords.wordText,
      translation: userCustomWords.translation,
    })
    .from(userCustomWords)
    .where(
      and(
        eq(userCustomWords.userId, userId),
        inArray(userCustomWords.collectionId, collectionIds),
      ),
    );

  // Deduplicate by word+translation
  const seen = new Set<string>();
  const result: { word: string; translation: string }[] = [];

  for (const w of [...systemWords, ...customWordRows]) {
    const key = `${w.word}::${w.translation}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(w);
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

  // Словарные слова
  const systemMeanings = await db
    .select({ meaningId: collectionWords.meaningId })
    .from(collectionWords)
    .where(inArray(collectionWords.collectionId, collectionIds));

  const meaningIds = [...new Set(systemMeanings.map((m) => m.meaningId))];

  // Кастомные слова
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

  return { meaningIds, customWords: custom };
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
