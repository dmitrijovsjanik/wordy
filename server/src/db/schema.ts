import {
  pgTable,
  serial,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
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

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'bigint' }).unique().notNull(),
  username: varchar('username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 1024 }),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  streakDays: integer('streak_days').default(0).notNull(),
  lastActivityAt: timestamp('last_activity_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Words ───────────────────────────────────────────────────────────────────

export const words = pgTable('words', {
  id: serial('id').primaryKey(),
  text: varchar('text', { length: 255 }).notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
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
  partOfSpeech: partOfSpeechEnum('part_of_speech').notNull(),
  contextExample: varchar('context_example', { length: 500 }),
  difficulty: difficultyEnum('difficulty').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
  price: integer('price'),
  isPublished: boolean('is_published').default(false).notNull(),
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
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_word_progress_uniq').on(table.userId, table.meaningId),
    index('user_word_progress_user_idx').on(table.userId),
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
    translation: varchar('translation', { length: 255 }).notNull(),
    partOfSpeech: partOfSpeechEnum('part_of_speech').default('noun').notNull(),
    contextExample: varchar('context_example', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('user_custom_words_collection_idx').on(table.collectionId),
  ],
);

// ─── Relations ──────────────────────────────────────────────────────────────

export const wordsRelations = relations(words, ({ many }) => ({
  meanings: many(wordMeanings),
}));

export const wordMeaningsRelations = relations(wordMeanings, ({ one }) => ({
  word: one(words, { fields: [wordMeanings.wordId], references: [words.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  quizSessions: many(quizSessions),
  challengedDuels: many(duels, { relationName: 'duelChallenger' }),
  opponentDuels: many(duels, { relationName: 'duelOpponent' }),
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

export const userCustomWordsRelations = relations(userCustomWords, ({ one }) => ({
  user: one(users, { fields: [userCustomWords.userId], references: [users.id] }),
  collection: one(collections, { fields: [userCustomWords.collectionId], references: [collections.id] }),
}));
