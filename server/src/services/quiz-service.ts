import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, quizSessions, quizAnswers, users, userWordProgress, userCustomWords, userCustomWordProgress } from '../db/schema.js';
import { getQuizPool, type CustomWordForQuiz } from './collection-service.js';
import { computeNextReview, LEARNED_PROGRESS } from './srs-service.js';
import {
  rewardCorrectAnswer,
  rewardQuizSessionComplete,
  updateStreakDays,
  addGems,
  XP_CORRECT_ANSWER,
} from './progression-service.js';
import { ANSWER_STREAK_MILESTONES, DAILY_CORRECT_MILESTONES } from '../config/gems-config.js';
import { getAiExamples, getAiMnemonic } from './ai-content-service.js';
import {
  generateRandom,
  generateFromMeaning,
  generateFromCustomWord,
  getAllTranslations,
} from './game/generators/multiple-choice.js';
import {
  generateSpellingFromMeaning,
  generateSpellingFromCustomWord,
  canGenerateSpelling,
} from './game/generators/spelling.js';
import { generateMatchPairsFromPool } from './game/generators/match-pairs.js';
import { canGenerateCloze, generateClozeFromMeaning } from './game/generators/cloze.js';
import { generateListeningFromMeaning } from './game/generators/listening.js';
import { canGenerateDictation, generateDictationFromMeaning } from './game/generators/dictation.js';
import { generateFreeRecallFromMeaning } from './game/generators/free-recall.js';
import type { PooledMeaning, LegacyQuestion, LanguagePair, SpellingQuestion, MatchPairsQuestion, GeneratorType, ClozeQuestion, ListeningQuestion, DictationQuestion, FreeRecallQuestion } from './game/types.js';
import { DEFAULT_LANG_PAIR, pickGenerator } from './game/types.js';
import { DOUBLE_XP_CHANCE, DOUBLE_XP_TIME_LIMITS, DOUBLE_XP_MULTIPLIER } from '../config/double-xp-config.js';
import { setDoubleXp, validateAndConsume, makeKey, makeMatchPairsKey } from './double-xp-tracker.js';
import { getMskTodayStart, toMskDayStart } from '../lib/msk-date.js';
import { getAdaptiveLevel } from './game/adaptive.js';
import { checkAndAwardMilestones } from './milestone-service.js';
import { generateGrammarQuestion, checkGrammarAnswer, GRAMMAR_EVERY_N, type GrammarQuestion, type GrammarType } from './game/generators/grammar.js';
import { consumeLife, getLivesStatus } from './lives-service.js';
import { recordEvent } from './analytics-service.js';

const QUESTIONS_PER_SESSION = 10;

// ─── Session Management ──────────────────────────────────────────────────────

export async function createSession(userId: number) {
  const [session] = await db
    .insert(quizSessions)
    .values({ userId, type: 'solo' })
    .returning();
  await recordEvent({
    userId,
    eventType: 'session_started',
    payload: { sessionType: 'solo', sessionId: session!.id },
  });
  return session!;
}

export async function getAnsweredMeaningIds(sessionId: number): Promise<number[]> {
  const answers = await db.query.quizAnswers.findMany({
    where: eq(quizAnswers.sessionId, sessionId),
    columns: { meaningId: true },
  });
  return answers.map(a => a.meaningId);
}

// ─── Question Generation ─────────────────────────────────────────────────────

// Генерация случайного вопроса из всей БД (для сессий без пула)
export async function generateQuestion(
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion | null> {
  return generateRandom(excludeMeaningIds, langPair, fixedDirection);
}

// Генерация вопроса из пула пользователя (infinite quiz)
type AnyQuestion = LegacyQuestion | SpellingQuestion | MatchPairsQuestion | ClozeQuestion | ListeningQuestion | DictationQuestion | FreeRecallQuestion | GrammarQuestion;

export async function generateQuestionFromPool(
  userId: number,
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  collectionId?: number,
  fixedDirection?: LanguagePair,
  questionType?: 'spelling' | 'match-pairs' | 'cloze' | 'listening' | 'dictation' | 'free-recall',
  recentGenerators: GeneratorType[] = [],
  recentCorrect: number = 0,
  recentTotal: number = 0,
  questionIndex: number = 0,
): Promise<AnyQuestion | null> {
  const question = await generateQuestionFromPoolInternal(userId, excludeMeaningIds, langPair, collectionId, fixedDirection, questionType, recentGenerators, recentCorrect, recentTotal, questionIndex);
  return maybeApplyDoubleXp(question, userId);
}

async function generateQuestionFromPoolInternal(
  userId: number,
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  collectionId?: number,
  fixedDirection?: LanguagePair,
  questionType?: 'spelling' | 'match-pairs' | 'cloze' | 'listening' | 'dictation' | 'free-recall',
  recentGenerators: GeneratorType[] = [],
  recentCorrect: number = 0,
  recentTotal: number = 0,
  questionIndex: number = 0,
): Promise<AnyQuestion | null> {
  // ─── Grammar injection: каждый N-й вопрос — грамматический ──────────────
  if (!questionType && questionIndex > 0 && questionIndex % GRAMMAR_EVERY_N === 0) {
    return generateGrammarQuestion(userId, recentGenerators);
  }

  const pool = await getQuizPool(userId, collectionId);
  const totalPool = pool.meaningIds.length + pool.customWords.length;

  if (totalPool === 0) {
    return generateRandom(excludeMeaningIds, langPair, fixedDirection);
  }

  // SRS-фильтрация для системных слов
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { repeatMastered: true },
  });
  const repeatMastered = user?.repeatMastered ?? false;

  const now = new Date();
  const skipSrsTimer = false;
  let reviewReady: number[] = [];
  let unseen: number[] = [];
  let progressMap: Map<number, { meaningId: number; srsStage: number; nextReviewAt: Date | null }> = new Map();

  if (pool.meaningIds.length > 0) {
    const progressRows = await db
      .select({
        meaningId: userWordProgress.meaningId,
        srsStage: userWordProgress.srsStage,
        nextReviewAt: userWordProgress.nextReviewAt,
      })
      .from(userWordProgress)
      .where(
        and(
          eq(userWordProgress.userId, userId),
          inArray(userWordProgress.meaningId, pool.meaningIds),
        ),
      );

    progressMap = new Map(progressRows.map((p) => [p.meaningId, p]));

    for (const id of pool.meaningIds) {
      const progress = progressMap.get(id);
      if (!progress) {
        unseen.push(id);
      } else if (progress.srsStage >= LEARNED_PROGRESS && !repeatMastered) {
        // выученное — пропускаем
      } else if (skipSrsTimer || !progress.nextReviewAt || progress.nextReviewAt <= now) {
        reviewReady.push(id);
      }
      // nextReviewAt > now — ещё в таймауте, пропускаем (кроме ошибок)
    }
  }

  // SRS-фильтрация для кастомных слов
  let customReviewReady: CustomWordForQuiz[] = [];
  let customUnseen: CustomWordForQuiz[] = [];
  let customProgressMap: Map<number, { customWordId: number; srsStage: number; nextReviewAt: Date | null }> = new Map();

  if (pool.customWords.length > 0) {
    const customIds = pool.customWords.map((w) => w.id);
    const customProgressRows = await db
      .select({
        customWordId: userCustomWordProgress.customWordId,
        srsStage: userCustomWordProgress.srsStage,
        nextReviewAt: userCustomWordProgress.nextReviewAt,
      })
      .from(userCustomWordProgress)
      .where(
        and(
          eq(userCustomWordProgress.userId, userId),
          inArray(userCustomWordProgress.customWordId, customIds),
        ),
      );

    customProgressMap = new Map(customProgressRows.map((p) => [p.customWordId, p]));

    for (const cw of pool.customWords) {
      const progress = customProgressMap.get(cw.id);
      if (!progress) {
        customUnseen.push(cw);
      } else if (progress.srsStage >= LEARNED_PROGRESS && !repeatMastered) {
        // выученное — пропускаем
      } else if (skipSrsTimer || !progress.nextReviewAt || progress.nextReviewAt <= now) {
        customReviewReady.push(cw);
      }
      // nextReviewAt > now — ещё в таймауте, пропускаем (кроме ошибок)
    }
  }

  // Исключаем только конкретные показанные meaningId (без siblings),
  // чтобы полисемичные слова могли показать другое значение
  const expandedExclude = new Set(excludeMeaningIds);

  // Adaptive difficulty
  const adaptiveLevel = getAdaptiveLevel(recentCorrect, recentTotal);

  // Фильтруем уже показанные
  const availableReview = reviewReady.filter((id) => !expandedExclude.has(id));
  const availableUnseen = unseen.filter((id) => !expandedExclude.has(id));
  const srsFilteredCustom = [...customReviewReady, ...customUnseen];
  const availableCustom = srsFilteredCustom.filter((w) => !expandedExclude.has(-w.id));

  // Если всё исчерпано — сбрасываем exclude
  const finalReview = availableReview.length > 0 ? availableReview : reviewReady;
  const finalUnseen = availableUnseen.length > 0 ? availableUnseen : unseen;
  const customWords = availableCustom.length > 0 ? availableCustom : srsFilteredCustom;

  // Выбираем между review/unseen с весами 70/30
  let meaningIds: number[];
  if (finalReview.length > 0 && finalUnseen.length > 0) {
    meaningIds = Math.random() < 0.7 ? finalReview : finalUnseen;
  } else {
    meaningIds = finalReview.length > 0 ? finalReview : finalUnseen;
  }
  const totalAvailable = meaningIds.length + customWords.length;

  // Случайно выбираем источник (взвешенно по количеству)
  const useCustom = totalAvailable > 0 && Math.random() < customWords.length / totalAvailable;

  // ─── Явный выбор генератора (ручной режим) ────────────────────────────
  if (questionType === 'spelling') {
    return generateSpellingQuestion(customWords, meaningIds, useCustom);
  }

  if (questionType === 'match-pairs') {
    return generateMatchPairsFromPool(meaningIds, customWords);
  }

  if (fixedDirection) {
    return generateMultipleChoiceQuestion(customWords, meaningIds, useCustom, pool.customWords, langPair, fixedDirection);
  }

  // ─── Авто-ротация генераторов ─────────────────────────────────────────
  // Match-pairs убран из авто-ротации (доступен только как отдельный режим)

  // Сначала выбираем слово, потом определяем подходящие генераторы
  if (useCustom && customWords.length > 0) {
    const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
    const customSrsStage = customProgressMap.get(correct.id)?.srsStage ?? 0;
    const applicable = getApplicableGenerators(correct.wordText, undefined, adaptiveLevel, customSrsStage);
    const generator = pickGenerator(applicable, recentGenerators);

    return generateFromCustomWord(correct, pool.customWords, langPair, generator === 'en-ru' ? 'en-ru' : 'ru-en');
  }

  if (meaningIds.length === 0) {
    if (customWords.length > 0) {
      const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
      const customSrsStage2 = customProgressMap?.get(correct.id)?.srsStage ?? 0;
      const applicable = getApplicableGenerators(correct.wordText, undefined, adaptiveLevel, customSrsStage2);
      const generator = pickGenerator(applicable, recentGenerators);

      return generateFromCustomWord(correct, pool.customWords, langPair, generator === 'en-ru' ? 'en-ru' : 'ru-en');
    }
    return null;
  }

  const candidates = await db.query.wordMeanings.findMany({
    where: inArray(wordMeanings.id, meaningIds),
    with: { word: true },
    columns: {
      id: true,
      wordId: true,
      translation: true,
      alternativeTranslations: true,
      difficulty: true,
      partOfSpeech: true,
      synonyms: true,
      examples: true,
    },
    limit: 1,
    orderBy: sql`RANDOM()`,
  });

  if (candidates.length === 0) return null;

  const correct = candidates[0]! as PooledMeaning;
  const englishWord = correct.word.lemma ?? correct.word.text;
  const srsStage = progressMap.get(correct.id)?.srsStage ?? 0;
  const applicable = getApplicableGenerators(englishWord, correct, adaptiveLevel, srsStage);
  const generator = pickGenerator(applicable, recentGenerators);

  if (generator === 'cloze') {
    const result = await generateClozeFromMeaning(correct);
    if (result) return result;
  }

  if (generator === 'listening') {
    const result = await generateListeningFromMeaning(correct);
    if (result) return result;
  }

  if (generator === 'dictation') {
    const result = generateDictationFromMeaning(correct);
    if (result) return result;
  }

  if (generator === 'free-recall') {
    const result = generateFreeRecallFromMeaning(correct);
    if (result) return result;
  }

  // Fallback на multiple-choice
  return generateFromMeaning(correct, langPair, generator === 'en-ru' ? 'en-ru' : 'ru-en');
}

// ─── Double XP Wrapper ──────────────────────────────────────────────────────

function maybeApplyDoubleXp(
  question: AnyQuestion | null,
  userId: number,
): AnyQuestion | null {
  if (!question) return null;
  if (Math.random() >= DOUBLE_XP_CHANCE) return question;

  const questionType = ('type' in question && question.type) ? question.type : 'multiple-choice';
  // Грамматические вопросы не поддерживают Double XP
  if (typeof questionType === 'string' && questionType.startsWith('grammar-')) return question;
  const timeLimitMs = DOUBLE_XP_TIME_LIMITS[questionType];
  if (!timeLimitMs) return question;

  const generatedAt = Date.now();

  if (questionType === 'match-pairs' && 'pairs' in question) {
    const meaningIds = question.pairs.map(p => p.meaningId);
    setDoubleXp(makeMatchPairsKey(userId, meaningIds), { generatedAt, timeLimitMs });
  } else if ('meaningId' in question) {
    setDoubleXp(makeKey(userId, question.meaningId), { generatedAt, timeLimitMs });
  }

  return { ...question, doubleXpTimeLimitMs: timeLimitMs } as AnyQuestion;
}

// ─── Helper: определяет подходящие генераторы для слова ──────────────────────

function getApplicableGenerators(
  englishWord: string,
  meaning?: PooledMeaning,
  adaptiveLevel: 'easy' | 'normal' | 'challenge' = 'normal',
  srsStage: number = 0,
): GeneratorType[] {
  // SRS-прогрессия типов вопросов:
  // Stage 0 (новое слово): только recognition (MC, listening)
  // Stage 1 (видел 1 раз): + cloze (контекст, семантическая обработка)
  // Stage 2+ (повторение): + dictation, free-recall (active recall)

  const generators: GeneratorType[] = ['en-ru', 'ru-en'];

  // В easy-режиме + новое слово: только MC
  if (adaptiveLevel === 'easy' && srsStage === 0) {
    return generators;
  }

  // Listening доступен с stage 0 (recognition, но аудио-канал)
  generators.push('listening');

  // В easy-режиме: listening + (если srsStage >= 2, ещё dictation)
  if (adaptiveLevel === 'easy') {
    if (srsStage >= 2 && canGenerateDictation(englishWord)) {
      generators.push('dictation');
    }
    return generators;
  }

  // Stage 1+: добавляем cloze (контекстное использование)
  if (srsStage >= 1 && meaning && canGenerateCloze(meaning)) {
    generators.push('cloze');
  }

  // Stage 2+: добавляем active recall (dictation, free-recall)
  if (srsStage >= 2) {
    if (canGenerateDictation(englishWord)) {
      generators.push('dictation');
    }
    generators.push('free-recall');
  }

  // В challenge-режиме: удваиваем вес сложных генераторов
  if (adaptiveLevel === 'challenge') {
    if (srsStage >= 1 && meaning && canGenerateCloze(meaning)) {
      generators.push('cloze');
    }
    if (srsStage >= 2 && canGenerateDictation(englishWord)) {
      generators.push('dictation');
    }
  }

  return generators;
}


// ─── Helper: генерация spelling-вопроса ─────────────────────────────────────

async function generateSpellingQuestion(
  customWords: CustomWordForQuiz[],
  meaningIds: number[],
  useCustom: boolean,
): Promise<SpellingQuestion | null> {
  if (useCustom && customWords.length > 0) {
    const suitableCustom = customWords.filter((w) => canGenerateSpelling(w.wordText));
    if (suitableCustom.length > 0) {
      const correct = suitableCustom[Math.floor(Math.random() * suitableCustom.length)]!;
      return generateSpellingFromCustomWord(correct);
    }
  }

  if (meaningIds.length > 0) {
    const candidates = await db.query.wordMeanings.findMany({
      where: inArray(wordMeanings.id, meaningIds),
      with: { word: true },
      orderBy: sql`RANDOM()`,
    });

    for (const candidate of candidates) {
      const word = (candidate as PooledMeaning).word.lemma ?? (candidate as PooledMeaning).word.text;
      if (canGenerateSpelling(word)) {
        return generateSpellingFromMeaning(candidate as PooledMeaning);
      }
    }
  }

  return null;
}

// ─── Helper: генерация multiple-choice вопроса ──────────────────────────────

function generateMultipleChoiceQuestion(
  customWords: CustomWordForQuiz[],
  meaningIds: number[],
  useCustom: boolean,
  allCustomWords: CustomWordForQuiz[],
  langPair: LanguagePair,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion | null> {
  if (useCustom && customWords.length > 0) {
    const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
    return generateFromCustomWord(correct, allCustomWords, langPair, fixedDirection);
  }

  if (meaningIds.length === 0) {
    if (customWords.length > 0) {
      const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
      return generateFromCustomWord(correct, allCustomWords, langPair, fixedDirection);
    }
    return Promise.resolve(null);
  }

  return (async () => {
    const candidates = await db.query.wordMeanings.findMany({
      where: inArray(wordMeanings.id, meaningIds),
      with: { word: true },
      limit: 1,
      orderBy: sql`RANDOM()`,
    });

    if (candidates.length === 0) return null;

    const correct = candidates[0]!;
    return generateFromMeaning(correct as PooledMeaning, langPair, fixedDirection);
  })();
}

// ─── Answer Recording ────────────────────────────────────────────────────────

export async function recordAnswer(
  sessionId: number,
  meaningId: number,
  selectedMeaningId: number | null,
  answerTimeMs: number,
) {
  // Проверяем правильность
  const correctMeaning = await db.query.wordMeanings.findFirst({
    where: eq(wordMeanings.id, meaningId),
  });

  let isCorrect = false;
  if (selectedMeaningId !== null && correctMeaning) {
    const selected = await db.query.wordMeanings.findFirst({
      where: eq(wordMeanings.id, selectedMeaningId),
    });
    const validTranslations = new Set(getAllTranslations(correctMeaning));
    isCorrect = selected ? validTranslations.has(selected.translation) : false;
  }

  await db
    .insert(quizAnswers)
    .values({ sessionId, meaningId, selectedMeaningId, isCorrect, answerTimeMs })
    .returning();

  // Обновляем счётчики сессии
  await db
    .update(quizSessions)
    .set({
      totalCount: sql`${quizSessions.totalCount} + 1`,
      correctCount: isCorrect ? sql`${quizSessions.correctCount} + 1` : quizSessions.correctCount,
      score: isCorrect ? sql`${quizSessions.score} + ${XP_CORRECT_ANSWER}` : quizSessions.score,
    })
    .where(eq(quizSessions.id, sessionId));

  // Определяем, есть ли ещё вопросы
  const session = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  });

  const isFinished = (session?.totalCount ?? 0) >= QUESTIONS_PER_SESSION;

  return { isCorrect, correctTranslation: correctMeaning?.translation ?? '', isFinished };
}

export async function recordInfiniteAnswer(
  userId: number,
  meaningId: number,
  selectedMeaningId: number | null,
  streak: number = 0,
  doubleXpClaimed: boolean = false,
  skip: boolean = false,
) {
  const isCustom = meaningId < 0;
  const realId = Math.abs(meaningId);

  let correctTranslation = '';
  let isCorrect = false;
  let feedbackExamples: { en: string; ru: string }[] | undefined;
  let feedbackMnemonic: string | undefined;

  if (isCustom) {
    // Кастомное слово — проверяем по selectedMeaningId (тоже отрицательный)
    const customWord = await db.query.userCustomWords.findFirst({
      where: eq(userCustomWords.id, realId),
    });
    correctTranslation = customWord?.translation ?? '';
    isCorrect = selectedMeaningId === meaningId;

    // SRS-прогресс для кастомных слов
    const [existing] = await db
      .select()
      .from(userCustomWordProgress)
      .where(and(eq(userCustomWordProgress.userId, userId), eq(userCustomWordProgress.customWordId, realId)))
      .limit(1);

    if (existing) {
      const srs = computeNextReview({
        learningProgress: existing.srsStage,
        hasPenalty: existing.hasPenalty,
        reviewStage: existing.reviewStage,
      }, isCorrect);
      await db
        .update(userCustomWordProgress)
        .set({
          correctCount: isCorrect ? sql`${userCustomWordProgress.correctCount} + 1` : userCustomWordProgress.correctCount,
          incorrectCount: isCorrect ? 0 : sql`${userCustomWordProgress.incorrectCount} + 1`,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
          masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCustomWordProgress.id, existing.id));
    } else {
      const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
      await db.insert(userCustomWordProgress).values({
        userId,
        customWordId: realId,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        srsStage: srs.newProgress,
        hasPenalty: srs.newPenalty,
        reviewStage: srs.newReviewStage,
        nextReviewAt: srs.nextReviewAt,
      });
    }
  } else {
    const correctMeaning = await db.query.wordMeanings.findFirst({
      where: eq(wordMeanings.id, meaningId),
      columns: {
        id: true,
        translation: true,
        alternativeTranslations: true,
        examples: true,
        wordId: true,
      },
    });
    correctTranslation = correctMeaning?.translation ?? '';

    // Получаем AI-примеры (приоритет), fallback на Yandex-примеры
    const aiExamples = await getAiExamples(meaningId);
    if (aiExamples) {
      feedbackExamples = aiExamples.sentences.slice(0, 2).map(s => ({ en: s.en, ru: s.ru }));
    } else {
      const rawExamples = (correctMeaning as { examples?: { text: string; translation: string }[] | null })?.examples;
      feedbackExamples = rawExamples && rawExamples.length > 0
        ? rawExamples.slice(0, 2).map(ex => ({ en: ex.text, ru: ex.translation }))
        : undefined;
    }

    // Мнемоника
    const aiMnemonic = await getAiMnemonic(meaningId);
    feedbackMnemonic = aiMnemonic?.association;

    if (selectedMeaningId !== null && correctMeaning) {
      if (selectedMeaningId > 0) {
        const selected = await db.query.wordMeanings.findFirst({
          where: eq(wordMeanings.id, selectedMeaningId),
        });
        const validTranslations = new Set(getAllTranslations(correctMeaning));
        isCorrect = selected ? validTranslations.has(selected.translation) : false;
      } else {
        isCorrect = selectedMeaningId === meaningId;
      }
    }

    // Обновляем user_word_progress только для словарных слов
    const [existing] = await db
      .select()
      .from(userWordProgress)
      .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)))
      .limit(1);

    if (existing) {
      const srs = computeNextReview({
        learningProgress: existing.srsStage,
        hasPenalty: existing.hasPenalty,
        reviewStage: existing.reviewStage,
      }, isCorrect);
      await db
        .update(userWordProgress)
        .set({
          correctCount: isCorrect ? sql`${userWordProgress.correctCount} + 1` : userWordProgress.correctCount,
          incorrectCount: isCorrect ? 0 : sql`${userWordProgress.incorrectCount} + 1`,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
          masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
          fromPlacement: false, // реальный ответ — сбрасываем флаг онбординга
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userWordProgress.id, existing.id));
    } else {
      const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
      await db.insert(userWordProgress).values({
        userId,
        meaningId,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        srsStage: srs.newProgress,
        hasPenalty: srs.newPenalty,
        reviewStage: srs.newReviewStage,
        nextReviewAt: srs.nextReviewAt,
      });
    }
  }

  // Аналитика: пишем событие до начислений, чтобы оно осело даже если дальше упадёт
  await recordEvent({
    userId,
    eventType: skip ? 'question_skipped' : 'question_answered',
    meaningId: isCustom ? null : meaningId,
    isCorrect: skip ? null : isCorrect,
    payload: { isCustom, streak, doubleXpClaimed },
  });

  // Начисляем XP и LP с модификаторами streak через progression-service
  if (isCorrect) {
    // Double XP: проверяем серверный трекер
    let doubleXpApplied = false;
    if (doubleXpClaimed) {
      const key = isCustom ? makeKey(userId, meaningId) : makeKey(userId, meaningId);
      doubleXpApplied = validateAndConsume(key);
    }
    const baseXp = doubleXpApplied ? XP_CORRECT_ANSWER * DOUBLE_XP_MULTIPLIER : XP_CORRECT_ANSWER;
    const reward = await rewardCorrectAnswer(userId, streak, baseXp);

    // Загружаем дневные счётчики пользователя
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        dailyCorrectCount: true,
        dailyCorrectDate: true,
        dailyStreakMilestonesDone: true,
        dailyCorrectMilestonesDone: true,
        lastLoginDate: true,
      },
    });

    const now = new Date();
    const todayStart = getMskTodayStart(now);

    // Обновляем streak дней (если первый ответ за день)
    let isNewDay = !user?.lastLoginDate;
    if (user?.lastLoginDate) {
      const lastLogin = toMskDayStart(user.lastLoginDate);
      isNewDay = lastLogin.getTime() !== todayStart.getTime();
    }

    let streakGemsFromDay = 0;
    if (isNewDay) {
      const streakResult = await updateStreakDays(userId);
      streakGemsFromDay = streakResult.gemsEarned;
    }

    // Проверяем, нужно ли сбросить дневные счётчики
    let dailyCorrectCount = user?.dailyCorrectCount ?? 0;
    let streakMilestonesDone = new Set((user?.dailyStreakMilestonesDone ?? '').split(',').filter(Boolean).map(Number));
    let correctMilestonesDone = new Set((user?.dailyCorrectMilestonesDone ?? '').split(',').filter(Boolean).map(Number));

    if (user?.dailyCorrectDate) {
      const lastDate = toMskDayStart(user.dailyCorrectDate);
      if (lastDate.getTime() !== todayStart.getTime()) {
        dailyCorrectCount = 0;
        streakMilestonesDone = new Set();
        correctMilestonesDone = new Set();
      }
    } else {
      dailyCorrectCount = 0;
      streakMilestonesDone = new Set();
      correctMilestonesDone = new Set();
    }

    let milestoneGems = 0;

    // Гемы за мильники стрика ответов подряд (разово в день)
    const newStreak = streak + 1;
    for (const [threshold, gems] of ANSWER_STREAK_MILESTONES) {
      if (newStreak >= threshold && !streakMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        streakMilestonesDone.add(threshold);
      }
    }

    // Инкрементируем дневной счётчик правильных ответов
    const newDailyCorrectCount = dailyCorrectCount + 1;

    // Гемы за суммарные правильные ответы за день (разово в день)
    for (const [threshold, gems] of DAILY_CORRECT_MILESTONES) {
      if (newDailyCorrectCount >= threshold && !correctMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        correctMilestonesDone.add(threshold);
      }
    }

    // Сохраняем дневные счётчики и обновляем рекорд стрика ответов
    await db
      .update(users)
      .set({
        dailyCorrectCount: newDailyCorrectCount,
        dailyCorrectDate: todayStart,
        dailyStreakMilestonesDone: [...streakMilestonesDone].join(','),
        dailyCorrectMilestonesDone: [...correctMilestonesDone].join(','),
        bestAnswerStreak: sql`GREATEST(${users.bestAnswerStreak}, ${newStreak})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Проверяем milestones
    const newMilestones = await checkAndAwardMilestones(userId);
    const milestoneGemsFromAchievements = newMilestones.reduce((sum, m) => sum + m.gemsReward, 0);

    // Получаем текущие жизни для корректного ответа (без декремента)
    const livesStatus = await getLivesStatus(userId);

    return {
      isCorrect,
      correctTranslation,
      xpEarned: reward.xpEarned,
      xpModifier: reward.xpModifier,
      totalXp: reward.totalXp,
      level: reward.level,
      levelUp: reward.levelUp,
      lpEarned: reward.lpEarned,
      lpModifier: reward.lpModifier,
      totalLp: reward.totalLp,
      gemsEarned: reward.gemsEarned + milestoneGems + streakGemsFromDay + milestoneGemsFromAchievements,
      dailyCorrectCount: newDailyCorrectCount,
      doubleXpApplied,
      examples: feedbackExamples,
      mnemonic: feedbackMnemonic,
      milestones: newMilestones.length > 0 ? newMilestones.map(m => ({
        id: m.id,
        type: m.type,
        threshold: m.threshold,
        title: m.title,
        description: m.description,
        gemsReward: m.gemsReward,
        icon: m.icon,
      })) : undefined,
      lives: livesStatus.lives,
      livesRestoredAt: livesStatus.livesRestoredAt,
      livesExhausted: false,
    };
  }

  // Неправильный ответ — тратим жизнь (кроме пропуска)
  if (skip) {
    const livesStatus = await getLivesStatus(userId);
    return {
      isCorrect,
      correctTranslation,
      xpEarned: 0,
      totalXp: undefined,
      level: undefined,
      levelUp: undefined,
      lpEarned: 0,
      totalLp: undefined,
      gemsEarned: 0,
      dailyCorrectCount: undefined,
      examples: feedbackExamples,
      mnemonic: feedbackMnemonic,
      lives: livesStatus.lives,
      livesRestoredAt: livesStatus.livesRestoredAt,
      livesExhausted: false,
    };
  }

  const livesResult = await consumeLife(userId);

  return {
    isCorrect,
    correctTranslation,
    xpEarned: 0,
    totalXp: undefined,
    level: undefined,
    levelUp: undefined,
    lpEarned: 0,
    totalLp: undefined,
    gemsEarned: 0,
    dailyCorrectCount: undefined,
    examples: feedbackExamples,
    mnemonic: feedbackMnemonic,
    lives: livesResult.lives,
    livesRestoredAt: livesResult.livesRestoredAt,
    livesExhausted: livesResult.livesExhausted,
  };
}

// ─── Match-Pairs Answer ─────────────────────────────────────────────────────

export async function recordMatchPairsAnswer(
  userId: number,
  results: Array<{ meaningId: number; isCorrect: boolean }>,
  streak: number = 0,
  doubleXpClaimed: boolean = false,
) {
  // Double XP: проверяем серверный трекер один раз для всех пар
  let doubleXpApplied = false;
  if (doubleXpClaimed) {
    const meaningIds = results.map(r => r.meaningId);
    const key = makeMatchPairsKey(userId, meaningIds);
    doubleXpApplied = validateAndConsume(key);
  }
  const baseXp = doubleXpApplied ? XP_CORRECT_ANSWER * DOUBLE_XP_MULTIPLIER : XP_CORRECT_ANSWER;

  let totalXpEarned = 0;
  let totalLpEarned = 0;
  let lastXpModifier: number | undefined;
  let lastLpModifier: number | undefined;
  let totalXp: number | undefined;
  let totalLp: number | undefined;
  let level: number | undefined;
  let levelUp: number | undefined;
  let totalGemsEarned = 0;
  let correctCount = 0;
  let currentStreak = streak;

  for (const { meaningId, isCorrect } of results) {
    const isCustom = meaningId < 0;
    const realId = Math.abs(meaningId);

    // Обновляем SRS-прогресс
    if (isCustom) {
      const [existing] = await db
        .select()
        .from(userCustomWordProgress)
        .where(and(eq(userCustomWordProgress.userId, userId), eq(userCustomWordProgress.customWordId, realId)))
        .limit(1);

      if (existing) {
        const srs = computeNextReview({
          learningProgress: existing.srsStage,
          hasPenalty: existing.hasPenalty,
          reviewStage: existing.reviewStage,
        }, isCorrect);
        await db
          .update(userCustomWordProgress)
          .set({
            correctCount: isCorrect ? sql`${userCustomWordProgress.correctCount} + 1` : userCustomWordProgress.correctCount,
            incorrectCount: isCorrect ? 0 : sql`${userCustomWordProgress.incorrectCount} + 1`,
            srsStage: srs.newProgress,
            hasPenalty: srs.newPenalty,
            reviewStage: srs.newReviewStage,
            nextReviewAt: srs.nextReviewAt,
            masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userCustomWordProgress.id, existing.id));
      } else {
        const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
        await db.insert(userCustomWordProgress).values({
          userId,
          customWordId: realId,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
        });
      }
    } else {
      const [existing] = await db
        .select()
        .from(userWordProgress)
        .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)))
        .limit(1);

      if (existing) {
        const srs = computeNextReview({
          learningProgress: existing.srsStage,
          hasPenalty: existing.hasPenalty,
          reviewStage: existing.reviewStage,
        }, isCorrect);
        await db
          .update(userWordProgress)
          .set({
            correctCount: isCorrect ? sql`${userWordProgress.correctCount} + 1` : userWordProgress.correctCount,
            incorrectCount: isCorrect ? 0 : sql`${userWordProgress.incorrectCount} + 1`,
            srsStage: srs.newProgress,
            hasPenalty: srs.newPenalty,
            reviewStage: srs.newReviewStage,
            nextReviewAt: srs.nextReviewAt,
            masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
            fromPlacement: false,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userWordProgress.id, existing.id));
      } else {
        const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
        await db.insert(userWordProgress).values({
          userId,
          meaningId,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
        });
      }
    }

    // Аналитика: каждая пара = одно событие question_answered с типом match-pairs
    await recordEvent({
      userId,
      eventType: 'question_answered',
      meaningId: isCustom ? null : meaningId,
      questionType: 'match-pairs',
      isCorrect,
      payload: { isCustom, batchSize: results.length },
    });

    // Награды за правильный ответ
    if (isCorrect) {
      correctCount++;
      const reward = await rewardCorrectAnswer(userId, currentStreak, baseXp);
      totalXpEarned += reward.xpEarned;
      totalLpEarned += reward.lpEarned;
      lastXpModifier = reward.xpModifier;
      lastLpModifier = reward.lpModifier;
      totalXp = reward.totalXp;
      totalLp = reward.totalLp;
      level = reward.level;
      if (reward.levelUp) levelUp = reward.levelUp;
      totalGemsEarned += reward.gemsEarned;
      currentStreak++;
    } else {
      currentStreak = 0;
      // Тратим жизнь за каждый неправильный ответ в match-pairs
      await consumeLife(userId);
    }
  }

  // Обновляем дневные счётчики (один раз за весь batch)
  if (correctCount > 0) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        dailyCorrectCount: true,
        dailyCorrectDate: true,
        dailyStreakMilestonesDone: true,
        dailyCorrectMilestonesDone: true,
        lastLoginDate: true,
      },
    });

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let isNewDay = !user?.lastLoginDate;
    if (user?.lastLoginDate) {
      const lastLogin = new Date(
        Date.UTC(user.lastLoginDate.getUTCFullYear(), user.lastLoginDate.getUTCMonth(), user.lastLoginDate.getUTCDate())
      );
      isNewDay = lastLogin.getTime() !== todayStart.getTime();
    }

    let streakGemsFromDay = 0;
    if (isNewDay) {
      const streakResult = await updateStreakDays(userId);
      streakGemsFromDay = streakResult.gemsEarned;
    }

    let dailyCorrectCount = user?.dailyCorrectCount ?? 0;
    let streakMilestonesDone = new Set((user?.dailyStreakMilestonesDone ?? '').split(',').filter(Boolean).map(Number));
    let correctMilestonesDone = new Set((user?.dailyCorrectMilestonesDone ?? '').split(',').filter(Boolean).map(Number));

    if (user?.dailyCorrectDate) {
      const lastDate = toMskDayStart(user.dailyCorrectDate);
      if (lastDate.getTime() !== todayStart.getTime()) {
        dailyCorrectCount = 0;
        streakMilestonesDone = new Set();
        correctMilestonesDone = new Set();
      }
    } else {
      dailyCorrectCount = 0;
      streakMilestonesDone = new Set();
      correctMilestonesDone = new Set();
    }

    let milestoneGems = 0;

    // Стрик ответов
    const finalStreak = currentStreak;
    for (const [threshold, gems] of ANSWER_STREAK_MILESTONES) {
      if (finalStreak >= threshold && !streakMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        streakMilestonesDone.add(threshold);
      }
    }

    const newDailyCorrectCount = dailyCorrectCount + correctCount;

    for (const [threshold, gems] of DAILY_CORRECT_MILESTONES) {
      if (newDailyCorrectCount >= threshold && !correctMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        correctMilestonesDone.add(threshold);
      }
    }

    await db
      .update(users)
      .set({
        dailyCorrectCount: newDailyCorrectCount,
        dailyCorrectDate: todayStart,
        dailyStreakMilestonesDone: [...streakMilestonesDone].join(','),
        dailyCorrectMilestonesDone: [...correctMilestonesDone].join(','),
        bestAnswerStreak: sql`GREATEST(${users.bestAnswerStreak}, ${finalStreak})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    totalGemsEarned += milestoneGems + streakGemsFromDay;
  }

  // Получаем статус жизней после обработки всех пар
  const matchPairsLivesStatus = await getLivesStatus(userId);

  return {
    correctCount,
    totalCount: results.length,
    totalXpEarned,
    xpModifier: lastXpModifier,
    totalLpEarned,
    lpModifier: lastLpModifier,
    totalXp,
    totalLp,
    level,
    levelUp,
    gemsEarned: totalGemsEarned,
    doubleXpApplied,
    lives: matchPairsLivesStatus.lives,
    livesRestoredAt: matchPairsLivesStatus.livesRestoredAt,
    livesExhausted: matchPairsLivesStatus.lives <= 0 && !matchPairsLivesStatus.isInfinite,
  };
}

// ─── Grammar Answer ─────────────────────────────────────────────────────────

export async function recordGrammarAnswer(
  userId: number,
  grammarType: GrammarType,
  params: {
    exerciseIndex?: number;
    blankIndex?: number;
    collocationIndex?: number;
    questionIndex?: number;
    answer: string;
  },
  streak: number = 0,
  skip: boolean = false,
) {
  const result = checkGrammarAnswer(grammarType, params);

  if (result.isCorrect) {
    const reward = await rewardCorrectAnswer(userId, streak, XP_CORRECT_ANSWER);

    // Обновляем дневные счётчики (аналогично recordInfiniteAnswer)
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        dailyCorrectCount: true,
        dailyCorrectDate: true,
        dailyStreakMilestonesDone: true,
        dailyCorrectMilestonesDone: true,
        lastLoginDate: true,
      },
    });

    const now = new Date();
    const todayStart = getMskTodayStart(now);

    let isNewDay = !user?.lastLoginDate;
    if (user?.lastLoginDate) {
      const lastLogin = toMskDayStart(user.lastLoginDate);
      isNewDay = lastLogin.getTime() !== todayStart.getTime();
    }

    let streakGemsFromDay = 0;
    if (isNewDay) {
      const streakResult = await updateStreakDays(userId);
      streakGemsFromDay = streakResult.gemsEarned;
    }

    let dailyCorrectCount = user?.dailyCorrectCount ?? 0;
    let streakMilestonesDone = new Set((user?.dailyStreakMilestonesDone ?? '').split(',').filter(Boolean).map(Number));
    let correctMilestonesDone = new Set((user?.dailyCorrectMilestonesDone ?? '').split(',').filter(Boolean).map(Number));

    if (user?.dailyCorrectDate) {
      const lastDate = toMskDayStart(user.dailyCorrectDate);
      if (lastDate.getTime() !== todayStart.getTime()) {
        dailyCorrectCount = 0;
        streakMilestonesDone = new Set();
        correctMilestonesDone = new Set();
      }
    } else {
      dailyCorrectCount = 0;
      streakMilestonesDone = new Set();
      correctMilestonesDone = new Set();
    }

    let milestoneGems = 0;
    const newStreak = streak + 1;
    for (const [threshold, gems] of ANSWER_STREAK_MILESTONES) {
      if (newStreak >= threshold && !streakMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        streakMilestonesDone.add(threshold);
      }
    }

    const newDailyCorrectCount = dailyCorrectCount + 1;
    for (const [threshold, gems] of DAILY_CORRECT_MILESTONES) {
      if (newDailyCorrectCount >= threshold && !correctMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        correctMilestonesDone.add(threshold);
      }
    }

    await db
      .update(users)
      .set({
        dailyCorrectCount: newDailyCorrectCount,
        dailyCorrectDate: todayStart,
        dailyStreakMilestonesDone: [...streakMilestonesDone].join(','),
        dailyCorrectMilestonesDone: [...correctMilestonesDone].join(','),
        bestAnswerStreak: sql`GREATEST(${users.bestAnswerStreak}, ${newStreak})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const grammarLivesStatus = await getLivesStatus(userId);

    return {
      ...result,
      xpEarned: reward.xpEarned,
      xpModifier: reward.xpModifier,
      totalXp: reward.totalXp,
      level: reward.level,
      levelUp: reward.levelUp,
      lpEarned: reward.lpEarned,
      lpModifier: reward.lpModifier,
      totalLp: reward.totalLp,
      gemsEarned: reward.gemsEarned + milestoneGems + streakGemsFromDay,
      dailyCorrectCount: newDailyCorrectCount,
      lives: grammarLivesStatus.lives,
      livesRestoredAt: grammarLivesStatus.livesRestoredAt,
      livesExhausted: false,
    };
  }

  // Неправильный ответ грамматики — тратим жизнь (кроме пропуска)
  if (skip) {
    const grammarLivesStatus = await getLivesStatus(userId);
    return {
      ...result,
      xpEarned: 0,
      totalXp: undefined,
      level: undefined,
      levelUp: undefined,
      lpEarned: 0,
      totalLp: undefined,
      gemsEarned: 0,
      dailyCorrectCount: undefined,
      lives: grammarLivesStatus.lives,
      livesRestoredAt: grammarLivesStatus.livesRestoredAt,
      livesExhausted: false,
    };
  }

  const grammarLivesResult = await consumeLife(userId);

  return {
    ...result,
    xpEarned: 0,
    totalXp: undefined,
    level: undefined,
    levelUp: undefined,
    lpEarned: 0,
    totalLp: undefined,
    gemsEarned: 0,
    dailyCorrectCount: undefined,
    lives: grammarLivesResult.lives,
    livesRestoredAt: grammarLivesResult.livesRestoredAt,
    livesExhausted: grammarLivesResult.livesExhausted,
  };
}

// ─── Session Completion ──────────────────────────────────────────────────────

export async function finishSession(sessionId: number, userId: number) {
  const session = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  });

  if (!session) throw new Error('Сессия не найдена');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new Error('Пользователь не найден');

  // Обновляем streak дней
  const streakResult = await updateStreakDays(userId);

  // Начисляем награды через progression-service
  const result = await rewardQuizSessionComplete(
    userId,
    session.correctCount,
    streakResult.streakDays > user.streakDays ? streakResult.streakDays : 0, // LP за streak только при увеличении
  );

  // Обновляем сессию
  await db
    .update(quizSessions)
    .set({ xpEarned: result.xpEarned, finishedAt: new Date() })
    .where(eq(quizSessions.id, sessionId));

  await recordEvent({
    userId,
    eventType: 'session_finished',
    payload: {
      sessionId,
      sessionType: session.type,
      correctCount: session.correctCount,
      totalCount: session.totalCount,
      xpEarned: result.xpEarned,
    },
  });

  return {
    correctCount: session.correctCount,
    totalCount: session.totalCount,
    xpEarned: result.xpEarned,
    streak: streakResult.streakDays,
    totalXp: result.totalXp,
    level: result.level,
    gemsEarned: streakResult.gemsEarned + result.gemsEarned,
    freezeUsed: streakResult.freezeUsed,
  };
}
