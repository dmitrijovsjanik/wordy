/**
 * Milestones Configuration
 *
 * Система достижений с наградами в гемах.
 * Проверка достижений будет интегрирована позже через progression-service.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type MilestoneType = 'words_learned' | 'streak_days' | 'total_answers' | 'cefr_level';

export type MilestoneConfig = {
  id: string;
  type: MilestoneType;
  threshold: number;
  title: string;
  description: string;
  gemsReward: number;
  icon: string;
};

// ─── Milestones ─────────────────────────────────────────────────────────────

export const MILESTONES: MilestoneConfig[] = [
  // ─── Выученные слова ────────────────────────────────────────────────────────
  {
    id: 'words_10',
    type: 'words_learned',
    threshold: 10,
    title: '10 слов выучено!',
    description: 'Вы выучили первые 10 слов. Отличное начало!',
    gemsReward: 5,
    icon: '\u{1F331}',
  },
  {
    id: 'words_25',
    type: 'words_learned',
    threshold: 25,
    title: '25 слов выучено!',
    description: 'Четверть сотни слов в копилке. Продолжайте!',
    gemsReward: 10,
    icon: '\u{1F33F}',
  },
  {
    id: 'words_50',
    type: 'words_learned',
    threshold: 50,
    title: '50 слов выучено!',
    description: 'Полсотни слов! Ваш словарный запас растёт.',
    gemsReward: 15,
    icon: '\u{1F333}',
  },
  {
    id: 'words_100',
    type: 'words_learned',
    threshold: 100,
    title: '100 слов выучено!',
    description: 'Сотня слов! Вы уже можете вести простой разговор.',
    gemsReward: 20,
    icon: '\u{1F3C6}',
  },
  {
    id: 'words_250',
    type: 'words_learned',
    threshold: 250,
    title: '250 слов выучено!',
    description: 'Впечатляющий словарный запас. Так держать!',
    gemsReward: 30,
    icon: '\u{2B50}',
  },
  {
    id: 'words_500',
    type: 'words_learned',
    threshold: 500,
    title: '500 слов выучено!',
    description: 'Полтысячи слов! Вы на пути к свободному владению.',
    gemsReward: 50,
    icon: '\u{1F48E}',
  },
  {
    id: 'words_1000',
    type: 'words_learned',
    threshold: 1000,
    title: '1000 слов выучено!',
    description: 'Тысяча слов! Это покрывает большинство повседневных ситуаций.',
    gemsReward: 100,
    icon: '\u{1F451}',
  },

  // ─── Стрик дней ─────────────────────────────────────────────────────────────
  {
    id: 'streak_3',
    type: 'streak_days',
    threshold: 3,
    title: '3 дня подряд!',
    description: 'Три дня без пропусков. Привычка формируется!',
    gemsReward: 5,
    icon: '\u{1F525}',
  },
  {
    id: 'streak_7',
    type: 'streak_days',
    threshold: 7,
    title: 'Неделя подряд!',
    description: 'Целая неделя занятий! Регулярность - ключ к успеху.',
    gemsReward: 10,
    icon: '\u{1F525}',
  },
  {
    id: 'streak_14',
    type: 'streak_days',
    threshold: 14,
    title: '2 недели подряд!',
    description: 'Две недели без пропусков. Вы на серьёзном пути!',
    gemsReward: 20,
    icon: '\u{1F4AA}',
  },
  {
    id: 'streak_30',
    type: 'streak_days',
    threshold: 30,
    title: 'Месяц подряд!',
    description: 'Целый месяц ежедневных занятий. Невероятная дисциплина!',
    gemsReward: 30,
    icon: '\u{26A1}',
  },
  {
    id: 'streak_60',
    type: 'streak_days',
    threshold: 60,
    title: '60 дней подряд!',
    description: 'Два месяца без перерыва. Вы — настоящий марафонец!',
    gemsReward: 50,
    icon: '\u{1F3C5}',
  },
  {
    id: 'streak_100',
    type: 'streak_days',
    threshold: 100,
    title: '100 дней подряд!',
    description: 'Сотня дней! Это легендарный результат.',
    gemsReward: 100,
    icon: '\u{1F31F}',
  },

  // ─── Общее количество ответов ───────────────────────────────────────────────
  {
    id: 'answers_100',
    type: 'total_answers',
    threshold: 100,
    title: '100 ответов!',
    description: 'Сотня ответов за всё время. Практика делает мастера!',
    gemsReward: 5,
    icon: '\u{1F4DD}',
  },
  {
    id: 'answers_500',
    type: 'total_answers',
    threshold: 500,
    title: '500 ответов!',
    description: 'Пятьсот ответов. Ваш опыт растёт!',
    gemsReward: 15,
    icon: '\u{1F4DA}',
  },
  {
    id: 'answers_1000',
    type: 'total_answers',
    threshold: 1000,
    title: '1000 ответов!',
    description: 'Тысяча ответов! Серьёзный объём практики.',
    gemsReward: 30,
    icon: '\u{1F9E0}',
  },
  {
    id: 'answers_5000',
    type: 'total_answers',
    threshold: 5000,
    title: '5000 ответов!',
    description: 'Пять тысяч ответов. Вы — эксперт!',
    gemsReward: 100,
    icon: '\u{1F680}',
  },

  // ─── CEFR уровни ────────────────────────────────────────────────────────────
  {
    id: 'cefr_a1',
    type: 'cefr_level',
    threshold: 1,
    title: 'Уровень A1 пройден!',
    description: 'Вы освоили базовый уровень английского. Отличный фундамент!',
    gemsReward: 30,
    icon: '\u{1F1EC}\u{1F1E7}',
  },
  {
    id: 'cefr_a2',
    type: 'cefr_level',
    threshold: 2,
    title: 'Уровень A2 пройден!',
    description: 'Элементарный уровень освоен. Вы можете общаться в простых ситуациях.',
    gemsReward: 50,
    icon: '\u{1F1EC}\u{1F1E7}',
  },
  {
    id: 'cefr_b1',
    type: 'cefr_level',
    threshold: 3,
    title: 'Уровень B1 пройден!',
    description: 'Средний уровень! Вы можете свободно общаться на большинство тем.',
    gemsReward: 100,
    icon: '\u{1F1EC}\u{1F1E7}',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Находит milestone по id.
 */
export function getMilestoneById(id: string): MilestoneConfig | undefined {
  return MILESTONES.find((m) => m.id === id);
}

/**
 * Находит все milestones определённого типа.
 */
export function getMilestonesByType(type: MilestoneType): MilestoneConfig[] {
  return MILESTONES.filter((m) => m.type === type);
}

/**
 * Находит непоказанные milestones, которые пользователь достиг.
 * shownMilestones — массив id уже показанных.
 */
export function getNewlyReachedMilestones(
  shownMilestones: string[],
  stats: {
    wordsLearned: number;
    streakDays: number;
    totalAnswers: number;
    cefrLevel: number;
  },
): MilestoneConfig[] {
  const shownSet = new Set(shownMilestones);

  return MILESTONES.filter((m) => {
    if (shownSet.has(m.id)) return false;

    switch (m.type) {
      case 'words_learned':
        return stats.wordsLearned >= m.threshold;
      case 'streak_days':
        return stats.streakDays >= m.threshold;
      case 'total_answers':
        return stats.totalAnswers >= m.threshold;
      case 'cefr_level':
        return stats.cefrLevel >= m.threshold;
      default:
        return false;
    }
  });
}
