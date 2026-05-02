import {
  pgTable,
  serial,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  text,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const partOfSpeechEnum = pgEnum('part_of_speech', [
  'noun',
  'verb',
  'adj',
  'adv',
  'phrase',
]);

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);

export const cefrLevelEnum = pgEnum('cefr_level', ['a1', 'a2', 'b1', 'b2', 'c1']);

export const quizTypeEnum = pgEnum('quiz_type', ['solo', 'duel']);

export const duelStatusEnum = pgEnum('duel_status', [
  'waiting',
  'active',
  'finished',
  'cancelled',
]);

export const collectionTypeEnum = pgEnum('collection_type', [
  'system',
  'user',
  'auto',
]);

export const leagueTierEnum = pgEnum('league_tier', [
  'bronze',
  'silver',
  'gold',
  'amber',
  'sapphire',
  'amethyst',
  'topaz',
  'ruby',
  'legend',
]);

export const aiContentTypeEnum = pgEnum('ai_content_type', [
  'examples',
  'mnemonic',
  'hints',
  'grammar',
  'common_errors',
]);

export const leagueNotificationTypeEnum = pgEnum('league_notification_type', [
  'season_started',
  'safe_zone_reached',
  'competition_entered',
  'top5_reached',
  'overtaken',
  'season_ending',
  'season_finished',
  'promoted',
  'demoted',
  'maintained',
]);

// Уровень освоения слова на лестнице (используется в learning_events и в user_word_progress (фаза 2)).
// encounter — первое знакомство; passive — узнавание; active — активное припоминание;
// production — слово в предложении (отложено в MVP); review — после освоения, интервальные повторения.
export const learningTierEnum = pgEnum('learning_tier', [
  'encounter',
  'passive',
  'active',
  'production',
  'review',
]);

// Состояние записи user_word_progress.
// `learning` — слово в очереди обучения, идёт по лестнице.
// `known_from_review` — отмечено «знаю» в обзоре или через bulk-mark из плейсмента; не учим.
// `snoozed` — отложено в обзоре, вернётся после snoozed_until.
export const learningStateEnum = pgEnum('learning_state', [
  'learning',
  'known_from_review',
  'snoozed',
]);

// Append-only лог обучающих событий. Источник правды для retention/funnel-аналитики.
export const learningEventTypeEnum = pgEnum('learning_event_type', [
  // Сессии (текущие — solo/duel; в будущем — learning-session из learning-service)
  'session_started',
  'session_finished',
  // Жизненный цикл вопроса
  'question_shown',
  'question_answered',
  'question_skipped',
  // Лестница (заработают после фазы 2)
  'tier_advanced',
  'tier_reset',
  'meaning_learned',
  'meaning_relearn',
  // Свайпы в обзоре (заработают после фазы 4)
  'review_swiped_known',
  'review_swiped_unknown',
  'review_swiped_snooze',
  // Откат свайпа в обзоре (жест «вниз»). payload.original_action хранит
  // что именно откатили: 'known' | 'unknown' | 'snooze'.
  'review_undo',
  // Раскрытие мнемоники по кнопке на passive-recall карточке. Пишем для
  // оценки полезности AI-мнемоник (доля раскрытий vs показов).
  'mnemonic_revealed',
  // Онбординг (плейсмент-тест)
  'onboarding_step',
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'bigint' }).unique(),
  vkId: bigint('vk_id', { mode: 'bigint' }).unique(),
  username: varchar('username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 1024 }),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  streakDays: integer('streak_days').default(0).notNull(),
  maxStreakDays: integer('max_streak_days').default(0).notNull(),
  bestAnswerStreak: integer('best_answer_streak').default(0).notNull(),
  streakFreezes: integer('streak_freezes').default(0).notNull(),
  gems: integer('gems').default(0).notNull(),
  nativeLanguage: varchar('native_language', { length: 10 }).default('ru').notNull(),
  learningLanguage: varchar('learning_language', { length: 10 }).default('en').notNull(),
  repeatMastered: boolean('repeat_mastered').default(false).notNull(),
  ttsVoice: varchar('tts_voice', { length: 64 }).default('en-US-EmmaMultilingualNeural').notNull(),
  friendCode: varchar('friend_code', { length: 12 }).unique(),
  lastActivityAt: timestamp('last_activity_at'),
  lastLoginDate: timestamp('last_login_date'), // Дата последнего входа для streak (без времени)
  dailyCorrectCount: integer('daily_correct_count').default(0).notNull(),
  dailyCorrectDate: timestamp('daily_correct_date'), // Дата для сброса счётчика правильных ответов за день
  dailyStreakMilestonesDone: varchar('daily_streak_milestones_done', { length: 255 }).default('').notNull(),
  dailyCorrectMilestonesDone: varchar('daily_correct_milestones_done', { length: 255 }).default('').notNull(),
  shownMilestones: jsonb('shown_milestones').$type<string[]>().default([]).notNull(),
  estimatedCefr: cefrLevelEnum('estimated_cefr'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  premiumUntil: timestamp('premium_until'),
  premiumPlan: varchar('premium_plan', { length: 20 }),
  autoRenew: boolean('auto_renew').default(false).notNull(),
  savedPaymentMethodId: varchar('saved_payment_method_id', { length: 64 }),
  // Жизни (Hearts)
  lives: integer('lives').default(5).notNull(),
  livesRestoredAt: timestamp('lives_restored_at'), // null = жизни полные (5)
  // XP Boost
  xpBoostUntil: timestamp('xp_boost_until'), // null = нет активного буста
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Streak Activity Days ────────────────────────────────────────────────────

export const streakActivityDays = pgTable(
  'streak_activity_days',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: timestamp('date').notNull(),
    type: varchar('type', { length: 10 }).notNull(), // 'play' | 'freeze'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('streak_activity_day_uniq').on(table.userId, table.date),
    index('streak_activity_days_user_date_idx').on(table.userId, table.date),
  ],
);

// ─── Words ───────────────────────────────────────────────────────────────────

export const words = pgTable('words', {
  id: serial('id').primaryKey(),
  text: varchar('text', { length: 255 }).notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  frequencyRank: integer('frequency_rank'),
  // Транскрипция из Yandex API (ts): [ɡʊd]
  transcription: varchar('transcription', { length: 100 }),
  // Лемма (словарная форма): shoes → shoe, ran → run
  // Если слово уже в словарной форме — null
  lemma: varchar('lemma', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Word Meanings ───────────────────────────────────────────────────────────

export const wordMeanings = pgTable('word_meanings', {
  id: serial('id').primaryKey(),
  wordId: integer('word_id')
    .references(() => words.id, { onDelete: 'cascade' })
    .notNull(),
  translation: varchar('translation', { length: 255 }).notNull(),
  translationLanguage: varchar('translation_language', { length: 10 }).default('ru').notNull(),
  partOfSpeech: partOfSpeechEnum('part_of_speech').notNull(),
  contextExample: varchar('context_example', { length: 500 }),
  difficulty: difficultyEnum('difficulty').notNull(),
  cefr: cefrLevelEnum('cefr'),
  alternativeTranslations: text('alternative_translations').array(),
  // Ранг популярности перевода (1 = самый популярный, из Yandex Dictionary API)
  popularityRank: integer('popularity_rank'),
  // Частотность из Yandex API (fr): 1-10, чем выше — тем популярнее перевод
  frequency: integer('frequency'),
  // Английские слова-уточнения контекста (mean из Yandex API)
  // Например: good → "полезный" имеет hints: ["useful", "helpful"]
  meaningHints: text('meaning_hints').array(),
  // Синонимы перевода из Yandex API (syn)
  // Например: good → "хороший" имеет synonyms: ["добротный", "неплохой"]
  synonyms: text('synonyms').array(),
  // Часть речи перевода (tr[].pos из Yandex API)
  // Может отличаться от части речи слова: run (verb) → бег (noun)
  translationPartOfSpeech: varchar('translation_part_of_speech', { length: 50 }),
  // Примеры использования с переводами (ex из Yandex API)
  // Формат: [{ text: "good boy", translation: "хороший мальчик" }, ...]
  examples: jsonb('examples').$type<{ text: string; translation: string }[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Topics ─────────────────────────────────────────────────────────────────

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  iconName: varchar('icon_name', { length: 100 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Word Meaning Topics ────────────────────────────────────────────────────

export const wordMeaningTopics = pgTable(
  'word_meaning_topics',
  {
    id: serial('id').primaryKey(),
    meaningId: integer('meaning_id')
      .references(() => wordMeanings.id, { onDelete: 'cascade' })
      .notNull(),
    topicId: integer('topic_id')
      .references(() => topics.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('word_meaning_topic_uniq').on(table.meaningId, table.topicId),
    index('word_meaning_topics_topic_idx').on(table.topicId),
  ],
);

// ─── Quiz Sessions ───────────────────────────────────────────────────────────

export const quizSessions = pgTable('quiz_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: quizTypeEnum('type').notNull(),
  score: integer('score').default(0).notNull(),
  correctCount: integer('correct_count').default(0).notNull(),
  totalCount: integer('total_count').default(0).notNull(),
  xpEarned: integer('xp_earned').default(0).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Quiz Answers ────────────────────────────────────────────────────────────

export const quizAnswers = pgTable('quiz_answers', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => quizSessions.id, { onDelete: 'cascade' })
    .notNull(),
  meaningId: integer('meaning_id')
    .references(() => wordMeanings.id, { onDelete: 'restrict' })
    .notNull(),
  selectedMeaningId: integer('selected_meaning_id').references(
    () => wordMeanings.id,
    { onDelete: 'set null' },
  ),
  isCorrect: boolean('is_correct').notNull(),
  answerTimeMs: integer('answer_time_ms').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Duels ───────────────────────────────────────────────────────────────────

export const duels = pgTable('duels', {
  id: serial('id').primaryKey(),
  challengerId: integer('challenger_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  opponentId: integer('opponent_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  status: duelStatusEnum('status').default('waiting').notNull(),
  winnerId: integer('winner_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  challengerSessionId: integer('challenger_session_id').references(
    () => quizSessions.id,
    { onDelete: 'set null' },
  ),
  opponentSessionId: integer('opponent_session_id').references(
    () => quizSessions.id,
    { onDelete: 'set null' },
  ),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Collections ────────────────────────────────────────────────────────────

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  type: collectionTypeEnum('type').notNull(),
  creatorId: integer('creator_id').references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
  iconName: varchar('icon_name', { length: 100 }),
  cefrLevel: cefrLevelEnum('cefr_level'),
  price: integer('price'),
  isPublished: boolean('is_published').default(false).notNull(),
  category: varchar('category', { length: 50 }),
  totalWords: integer('total_words').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ─── Collection Words ───────────────────────────────────────────────────────

export const collectionWords = pgTable(
  'collection_words',
  {
    id: serial('id').primaryKey(),
    collectionId: integer('collection_id')
      .references(() => collections.id, { onDelete: 'cascade' })
      .notNull(),
    meaningId: integer('meaning_id')
      .references(() => wordMeanings.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('collection_word_uniq').on(table.collectionId, table.meaningId),
    index('collection_words_collection_idx').on(table.collectionId),
  ],
);

// ─── User Collections ───────────────────────────────────────────────────────

export const userCollections = pgTable(
  'user_collections',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    collectionId: integer('collection_id')
      .references(() => collections.id, { onDelete: 'cascade' })
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_collection_uniq').on(table.userId, table.collectionId),
    index('user_collections_user_idx').on(table.userId),
  ],
);

// ─── User Word Progress ─────────────────────────────────────────────────────

export const userWordProgress = pgTable(
  'user_word_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    meaningId: integer('meaning_id')
      .references(() => wordMeanings.id, { onDelete: 'cascade' })
      .notNull(),
    correctCount: integer('correct_count').default(0).notNull(),
    incorrectCount: integer('incorrect_count').default(0).notNull(),
    srsStage: integer('srs_stage').default(0).notNull(), // 0-3 learning progress (3 = learned). LEGACY (заменяется на learning_tier).
    hasPenalty: boolean('has_penalty').default(false).notNull(),
    reviewStage: integer('review_stage').default(0).notNull(), // index into review intervals after learned
    nextReviewAt: timestamp('next_review_at'),
    masteredAt: timestamp('mastered_at'), // set when learning_tier reaches 'review'
    fromPlacement: boolean('from_placement').default(false).notNull(), // true = слово помечено через онбординг
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
    // Phase 2: новые поля под лестницу освоения.
    learningTier: learningTierEnum('learning_tier').default('encounter').notNull(),
    tierCorrectCount: integer('tier_correct_count').default(0).notNull(),
    state: learningStateEnum('state').default('learning').notNull(),
    snoozedUntil: timestamp('snoozed_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_word_progress_uniq').on(table.userId, table.meaningId),
    index('user_word_progress_user_idx').on(table.userId),
    index('user_word_progress_review_idx').on(table.userId, table.nextReviewAt),
    index('user_word_progress_state_idx').on(table.userId, table.state),
    index('user_word_progress_snoozed_idx').on(table.userId, table.snoozedUntil),
  ],
);

// ─── User Custom Words ──────────────────────────────────────────────────────

export const userCustomWords = pgTable(
  'user_custom_words',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    collectionId: integer('collection_id')
      .references(() => collections.id, { onDelete: 'cascade' })
      .notNull(),
    wordText: varchar('word_text', { length: 255 }).notNull(),
    language: varchar('language', { length: 10 }).default('en').notNull(),
    translation: varchar('translation', { length: 255 }).notNull(),
    translationLanguage: varchar('translation_language', { length: 10 }).default('ru').notNull(),
    partOfSpeech: partOfSpeechEnum('part_of_speech').default('noun').notNull(),
    contextExample: varchar('context_example', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('user_custom_words_collection_idx').on(table.collectionId),
  ],
);

// ─── User Custom Word Progress ──────────────────────────────────────────────

export const userCustomWordProgress = pgTable(
  'user_custom_word_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    customWordId: integer('custom_word_id')
      .references(() => userCustomWords.id, { onDelete: 'cascade' })
      .notNull(),
    correctCount: integer('correct_count').default(0).notNull(),
    incorrectCount: integer('incorrect_count').default(0).notNull(),
    srsStage: integer('srs_stage').default(0).notNull(), // 0-3 learning progress (3 = learned)
    hasPenalty: boolean('has_penalty').default(false).notNull(),
    reviewStage: integer('review_stage').default(0).notNull(), // index into review intervals after learned
    nextReviewAt: timestamp('next_review_at'),
    masteredAt: timestamp('mastered_at'), // set when srsStage reaches 3 (learned)
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_custom_word_progress_uniq').on(table.userId, table.customWordId),
    index('user_custom_word_progress_user_idx').on(table.userId),
    index('user_custom_word_progress_review_idx').on(table.userId, table.nextReviewAt),
  ],
);

// ─── Friend Requests ────────────────────────────────────────────────────────

export const friendRequestStatusEnum = pgEnum('friend_request_status', [
  'pending',
  'accepted',
  'declined',
]);

export const friendRequests = pgTable(
  'friend_requests',
  {
    id: serial('id').primaryKey(),
    fromUserId: integer('from_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    toUserId: integer('to_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: friendRequestStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('friend_request_pair_uniq').on(table.fromUserId, table.toUserId),
    index('friend_requests_to_user_idx').on(table.toUserId, table.status),
  ],
);

// ─── Friendships ────────────────────────────────────────────────────────────

export const friendships = pgTable(
  'friendships',
  {
    id: serial('id').primaryKey(),
    userId1: integer('user_id_1')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    userId2: integer('user_id_2')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('friendship_pair_uniq').on(table.userId1, table.userId2),
    index('friendships_user1_idx').on(table.userId1),
    index('friendships_user2_idx').on(table.userId2),
  ],
);

// ─── Invite Tokens ──────────────────────────────────────────────────────────

export const inviteTokens = pgTable('invite_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  token: varchar('token', { length: 64 }).unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Payments ───────────────────────────────────────────────────────────

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'canceled',
  'refunded',
]);

export const paymentItemTypeEnum = pgEnum('payment_item_type', [
  'freeze_1',
  'freeze_2',
  'freeze_7',
  'freeze_14',
  'premium_month',
  'premium_year',
  'gem_pack_100',
  'gem_pack_500',
  'gem_pack_1500',
]);

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    yookassaPaymentId: varchar('yookassa_payment_id', { length: 64 }).unique().notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 64 }).unique().notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    itemType: paymentItemTypeEnum('item_type').notNull(),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    fulfilledAt: timestamp('fulfilled_at'),
    yookassaStatus: varchar('yookassa_status', { length: 50 }),
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payments_user_idx').on(table.userId),
    index('payments_yookassa_id_idx').on(table.yookassaPaymentId),
  ],
);

// ─── AI Content ─────────────────────────────────────────────────────────────

export const wordAiContent = pgTable(
  'word_ai_content',
  {
    id: serial('id').primaryKey(),
    meaningId: integer('meaning_id')
      .references(() => wordMeanings.id, { onDelete: 'cascade' })
      .notNull(),
    contentType: aiContentTypeEnum('content_type').notNull(),
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('word_ai_content_meaning_type_uniq').on(table.meaningId, table.contentType),
    index('word_ai_content_meaning_idx').on(table.meaningId),
  ],
);

// ─── Learning Events ────────────────────────────────────────────────────────

// Append-only event log для аналитики обучающего потока.
// Никогда не редактируется. Один источник правды для D1/D7 retention,
// funnel первой сессии и распределения типов вопросов.
export const learningEvents = pgTable(
  'learning_events',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: learningEventTypeEnum('event_type').notNull(),
    meaningId: integer('meaning_id').references(() => wordMeanings.id, { onDelete: 'set null' }),
    tierBefore: learningTierEnum('tier_before'),
    tierAfter: learningTierEnum('tier_after'),
    questionType: varchar('question_type', { length: 32 }),
    isCorrect: boolean('is_correct'),
    answerTimeMs: integer('answer_time_ms'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('learning_events_user_created_idx').on(table.userId, table.createdAt),
    index('learning_events_type_created_idx').on(table.eventType, table.createdAt),
    index('learning_events_meaning_idx').on(table.meaningId),
  ],
);

// ─── Relations ──────────────────────────────────────────────────────────────

export const wordsRelations = relations(words, ({ many }) => ({
  meanings: many(wordMeanings),
}));

export const wordMeaningsRelations = relations(wordMeanings, ({ one, many }) => ({
  word: one(words, { fields: [wordMeanings.wordId], references: [words.id] }),
  topics: many(wordMeaningTopics),
  aiContent: many(wordAiContent),
}));

export const wordAiContentRelations = relations(wordAiContent, ({ one }) => ({
  meaning: one(wordMeanings, { fields: [wordAiContent.meaningId], references: [wordMeanings.id] }),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  wordMeanings: many(wordMeaningTopics),
}));

export const wordMeaningTopicsRelations = relations(wordMeaningTopics, ({ one }) => ({
  meaning: one(wordMeanings, { fields: [wordMeaningTopics.meaningId], references: [wordMeanings.id] }),
  topic: one(topics, { fields: [wordMeaningTopics.topicId], references: [topics.id] }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  quizSessions: many(quizSessions),
  streakActivityDays: many(streakActivityDays),
  payments: many(payments),
  placementResult: one(placementResults),
  challengedDuels: many(duels, { relationName: 'duelChallenger' }),
  opponentDuels: many(duels, { relationName: 'duelOpponent' }),
  sentFriendRequests: many(friendRequests, { relationName: 'sentRequests' }),
  receivedFriendRequests: many(friendRequests, { relationName: 'receivedRequests' }),
  friendshipsAsUser1: many(friendships, { relationName: 'friendshipUser1' }),
  friendshipsAsUser2: many(friendships, { relationName: 'friendshipUser2' }),
}));

export const streakActivityDaysRelations = relations(streakActivityDays, ({ one }) => ({
  user: one(users, { fields: [streakActivityDays.userId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

export const quizSessionsRelations = relations(quizSessions, ({ one, many }) => ({
  user: one(users, { fields: [quizSessions.userId], references: [users.id] }),
  answers: many(quizAnswers),
}));

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  session: one(quizSessions, { fields: [quizAnswers.sessionId], references: [quizSessions.id] }),
  meaning: one(wordMeanings, { fields: [quizAnswers.meaningId], references: [wordMeanings.id] }),
}));

export const duelsRelations = relations(duels, ({ one }) => ({
  challenger: one(users, { fields: [duels.challengerId], references: [users.id], relationName: 'duelChallenger' }),
  opponent: one(users, { fields: [duels.opponentId], references: [users.id], relationName: 'duelOpponent' }),
  challengerSession: one(quizSessions, { fields: [duels.challengerSessionId], references: [quizSessions.id] }),
  opponentSession: one(quizSessions, { fields: [duels.opponentSessionId], references: [quizSessions.id] }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  creator: one(users, { fields: [collections.creatorId], references: [users.id] }),
  words: many(collectionWords),
  customWords: many(userCustomWords),
  subscribers: many(userCollections),
}));

export const collectionWordsRelations = relations(collectionWords, ({ one }) => ({
  collection: one(collections, { fields: [collectionWords.collectionId], references: [collections.id] }),
  meaning: one(wordMeanings, { fields: [collectionWords.meaningId], references: [wordMeanings.id] }),
}));

export const userCollectionsRelations = relations(userCollections, ({ one }) => ({
  user: one(users, { fields: [userCollections.userId], references: [users.id] }),
  collection: one(collections, { fields: [userCollections.collectionId], references: [collections.id] }),
}));

export const userWordProgressRelations = relations(userWordProgress, ({ one }) => ({
  user: one(users, { fields: [userWordProgress.userId], references: [users.id] }),
  meaning: one(wordMeanings, { fields: [userWordProgress.meaningId], references: [wordMeanings.id] }),
}));

export const userCustomWordsRelations = relations(userCustomWords, ({ one, many }) => ({
  user: one(users, { fields: [userCustomWords.userId], references: [users.id] }),
  collection: one(collections, { fields: [userCustomWords.collectionId], references: [collections.id] }),
  progress: many(userCustomWordProgress),
}));

export const userCustomWordProgressRelations = relations(userCustomWordProgress, ({ one }) => ({
  user: one(users, { fields: [userCustomWordProgress.userId], references: [users.id] }),
  customWord: one(userCustomWords, { fields: [userCustomWordProgress.customWordId], references: [userCustomWords.id] }),
}));

// ─── Placement Results ─────────────────────────────────────────────────────

export const placementResults = pgTable('placement_results', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  selfAssessment: cefrLevelEnum('self_assessment'),
  resultCefr: cefrLevelEnum('result_cefr').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  correctCount: integer('correct_count').notNull(),
  estimatedVocabulary: integer('estimated_vocabulary').notNull(),
  answersJson: jsonb('answers_json').$type<{ meaningId: number; cefrLevel: string; isCorrect: boolean; answerTimeMs: number }[]>().notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── League Seasons ─────────────────────────────────────────────────────────

export const leagueSeasons = pgTable(
  'league_seasons',
  {
    id: serial('id').primaryKey(),
    weekNumber: integer('week_number').notNull(),
    year: integer('year').notNull(),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    isActive: boolean('is_active').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('league_season_week_year_uniq').on(table.weekNumber, table.year)],
);

// ─── User League Progress ───────────────────────────────────────────────────

export const userLeagueProgress = pgTable('user_league_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  tier: leagueTierEnum('tier').default('bronze').notNull(),
  division: integer('division').default(3).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── User Season Stats ──────────────────────────────────────────────────────

export const userSeasonStats = pgTable(
  'user_season_stats',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    seasonId: integer('season_id')
      .references(() => leagueSeasons.id, { onDelete: 'cascade' })
      .notNull(),
    leaguePoints: integer('league_points').default(0).notNull(),
    correctAnswers: integer('correct_answers').default(0).notNull(),
    quizzesCompleted: integer('quizzes_completed').default(0).notNull(),
    duelsWon: integer('duels_won').default(0).notNull(),
    streakBonus: integer('streak_bonus').default(0).notNull(),
    tierAtStart: leagueTierEnum('tier_at_start').notNull(),
    divisionAtStart: integer('division_at_start').notNull(),
    tierAtEnd: leagueTierEnum('tier_at_end'),
    divisionAtEnd: integer('division_at_end'),
    divisionChange: integer('division_change'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_season_stats_uniq').on(table.userId, table.seasonId),
    index('user_season_stats_season_idx').on(table.seasonId),
    index('user_season_stats_lp_idx').on(table.seasonId, table.leaguePoints),
  ],
);

// ─── Daily League Snapshots ──────────────────────────────────────────────────

export const dailyLeagueSnapshots = pgTable(
  'daily_league_snapshots',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    seasonId: integer('season_id')
      .references(() => leagueSeasons.id, { onDelete: 'cascade' })
      .notNull(),
    date: timestamp('date').notNull(),
    leaguePoints: integer('league_points').default(0).notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('daily_league_snapshot_uniq').on(table.userId, table.seasonId, table.date),
    index('daily_league_snapshots_season_date_idx').on(table.seasonId, table.date),
  ],
);

// ─── League Notifications ───────────────────────────────────────────────────

export const leagueNotifications = pgTable(
  'league_notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    seasonId: integer('season_id')
      .references(() => leagueSeasons.id, { onDelete: 'cascade' })
      .notNull(),
    type: leagueNotificationTypeEnum('type').notNull(),
    payload: text('payload'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('league_notifications_user_idx').on(table.userId, table.isRead)],
);

// ─── League Relations ───────────────────────────────────────────────────────

export const placementResultsRelations = relations(placementResults, ({ one }) => ({
  user: one(users, { fields: [placementResults.userId], references: [users.id] }),
}));

export const leagueSeasonsRelations = relations(leagueSeasons, ({ many }) => ({
  userStats: many(userSeasonStats),
  notifications: many(leagueNotifications),
}));

export const userLeagueProgressRelations = relations(userLeagueProgress, ({ one }) => ({
  user: one(users, { fields: [userLeagueProgress.userId], references: [users.id] }),
}));

export const userSeasonStatsRelations = relations(userSeasonStats, ({ one }) => ({
  user: one(users, { fields: [userSeasonStats.userId], references: [users.id] }),
  season: one(leagueSeasons, { fields: [userSeasonStats.seasonId], references: [leagueSeasons.id] }),
}));

export const leagueNotificationsRelations = relations(leagueNotifications, ({ one }) => ({
  user: one(users, { fields: [leagueNotifications.userId], references: [users.id] }),
  season: one(leagueSeasons, { fields: [leagueNotifications.seasonId], references: [leagueSeasons.id] }),
}));

export const dailyLeagueSnapshotsRelations = relations(dailyLeagueSnapshots, ({ one }) => ({
  user: one(users, { fields: [dailyLeagueSnapshots.userId], references: [users.id] }),
  season: one(leagueSeasons, { fields: [dailyLeagueSnapshots.seasonId], references: [leagueSeasons.id] }),
}));

// ─── Friends Relations ──────────────────────────────────────────────────────

export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
  fromUser: one(users, { fields: [friendRequests.fromUserId], references: [users.id], relationName: 'sentRequests' }),
  toUser: one(users, { fields: [friendRequests.toUserId], references: [users.id], relationName: 'receivedRequests' }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user1: one(users, { fields: [friendships.userId1], references: [users.id], relationName: 'friendshipUser1' }),
  user2: one(users, { fields: [friendships.userId2], references: [users.id], relationName: 'friendshipUser2' }),
}));

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  user: one(users, { fields: [inviteTokens.userId], references: [users.id] }),
}));
