import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { duels, quizSessions, users } from '../db/schema.js';
import { generateQuestion } from './quiz-service.js';
import { addLpForDuelWin } from './league-service.js';

const XP_DUEL_WIN = 50;

export async function createDuel(challengerId: number) {
  const [session] = await db
    .insert(quizSessions)
    .values({ userId: challengerId, type: 'duel' })
    .returning();

  const [duel] = await db
    .insert(duels)
    .values({
      challengerId,
      challengerSessionId: session!.id,
    })
    .returning();

  return duel!;
}

export async function joinDuel(duelId: number, opponentId: number) {
  const duel = await db.query.duels.findFirst({
    where: eq(duels.id, duelId),
  });

  if (!duel) throw new Error('Дуэль не найдена');
  if (duel.status !== 'waiting') throw new Error('Дуэль уже началась или завершена');
  if (duel.challengerId === opponentId) throw new Error('Нельзя присоединиться к своей дуэли');

  const [session] = await db
    .insert(quizSessions)
    .values({ userId: opponentId, type: 'duel' })
    .returning();

  const [updated] = await db
    .update(duels)
    .set({
      opponentId,
      opponentSessionId: session!.id,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(duels.id, duelId))
    .returning();

  return updated!;
}

export async function getDuel(duelId: number) {
  const duel = await db.query.duels.findFirst({
    where: eq(duels.id, duelId),
    with: {
      challenger: { columns: { id: true, firstName: true, username: true, avatarUrl: true } },
      opponent: { columns: { id: true, firstName: true, username: true, avatarUrl: true } },
      challengerSession: { columns: { correctCount: true, totalCount: true, score: true, finishedAt: true } },
      opponentSession: { columns: { correctCount: true, totalCount: true, score: true, finishedAt: true } },
    },
  });

  if (!duel) throw new Error('Дуэль не найдена');
  return duel;
}

export async function startDuelQuiz(duelId: number, userId: number) {
  const duel = await db.query.duels.findFirst({
    where: eq(duels.id, duelId),
  });

  if (!duel) throw new Error('Дуэль не найдена');

  let sessionId: number;
  if (duel.challengerId === userId) {
    if (!duel.challengerSessionId) throw new Error('Сессия создателя не найдена');
    sessionId = duel.challengerSessionId;
  } else if (duel.opponentId === userId) {
    if (!duel.opponentSessionId) throw new Error('Сессия оппонента не найдена');
    sessionId = duel.opponentSessionId;
  } else {
    throw new Error('Вы не участник этой дуэли');
  }

  const question = await generateQuestion();
  return { sessionId, question };
}

export async function finishDuel(duelId: number) {
  const duel = await db.query.duels.findFirst({
    where: eq(duels.id, duelId),
    with: {
      challengerSession: true,
      opponentSession: true,
    },
  });

  if (!duel) throw new Error('Дуэль не найдена');

  // Idempotent: if already finished, return existing result
  if (duel.status === 'finished') {
    return { winnerId: duel.winnerId };
  }

  if (!duel.challengerSession?.finishedAt || !duel.opponentSession?.finishedAt) {
    throw new Error('Оба игрока должны завершить квиз');
  }

  const cScore = duel.challengerSession.correctCount;
  const oScore = duel.opponentSession.correctCount;

  let winnerId: number | null = null;

  if (cScore > oScore) {
    winnerId = duel.challengerId;
  } else if (oScore > cScore) {
    winnerId = duel.opponentId;
  } else {
    // При равенстве — сравниваем сумму answer_time_ms
    const cAnswers = await db.query.quizAnswers.findMany({
      where: eq(quizSessions.id, duel.challengerSession.id),
      columns: { answerTimeMs: true },
    });
    const oAnswers = await db.query.quizAnswers.findMany({
      where: eq(quizSessions.id, duel.opponentSession.id),
      columns: { answerTimeMs: true },
    });

    const cTime = cAnswers.reduce((s, a) => s + a.answerTimeMs, 0);
    const oTime = oAnswers.reduce((s, a) => s + a.answerTimeMs, 0);

    winnerId = cTime <= oTime ? duel.challengerId : duel.opponentId;
  }

  await db
    .update(duels)
    .set({ status: 'finished', winnerId, updatedAt: new Date() })
    .where(eq(duels.id, duelId));

  // Начислить XP и LP победителю
  if (winnerId) {
    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${XP_DUEL_WIN}`,
        level: sql`floor(sqrt((${users.xp} + ${XP_DUEL_WIN}) / 100)) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, winnerId));

    // League Points за победу в дуэли
    await addLpForDuelWin(winnerId);
  }

  return { winnerId };
}
