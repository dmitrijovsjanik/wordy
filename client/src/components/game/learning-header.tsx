import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowDown01Icon,
  LeftToRightListStarIcon,
} from '@hugeicons/core-free-icons';
import { useUserStore } from '@/stores/user-store';
import { useCollectionStore } from '@/stores/collection-store';
import { useLearningStore } from '@/stores/learning-store';
import { xpForLevel } from '@/lib/progression-config';
import { CollectionsSheet } from '@/components/game/collections-sheet';

type LearningHeaderProps = {
  onHistoryClick: () => void;
  /** Куда вести по клику «Назад». По умолчанию — главная. */
  backTo?: string;
};

/**
 * Общий хедер для экранов изучения (L0/L2/L3). Дизайн Wordy 2.2 (Figma 5120:7273).
 *
 *   [← назад]   [Повторение ▾  (Lv-ring)]   [≡ история]
 *
 * - «Назад» — secondary-кнопка (gray-3).
 * - По центру: имя активной коллекции (по клику — bottom-sheet выбора, TODO макет
 *   5152:7577) + кольцо уровня пользователя с прогрессом XP внутри текущего уровня.
 * - История ответов — secondary-кнопка справа.
 *
 * Streak ответов подряд и недельный streak здесь НЕ показываются (по дизайну
 * новой страницы изучения).
 */
export function LearningHeader({ onHistoryClick, backTo = '/' }: LearningHeaderProps) {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const library = useCollectionStore((s) => s.library);
  // Источник правды — collectionId в learning-store, а не library.isActive.
  // library.isActive отражает БД (несколько коллекций могут быть active одновременно),
  // а реальная учебная сессия идёт по одной — той, что в learning-store.
  const currentCollectionId = useLearningStore((s) => s.collectionId);
  const activeCollection = library.find((c) => c.id === currentCollectionId);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  // Кольцо уровня — параметры идентичны прежним в vocabulary-screen.
  const currentLevelXp = user ? xpForLevel(user.level) : 0;
  const nextLevelXp = user ? xpForLevel(user.level + 1) : 1;
  const xpProgress = user ? ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 : 0;
  const lvlRingSize = 36;
  const lvlStroke = 2.5;
  const lvlRadius = (lvlRingSize - lvlStroke) / 2;
  const lvlCircumference = 2 * Math.PI * lvlRadius;
  const lvlDashoffset = lvlCircumference - (Math.min(100, Math.max(0, xpProgress)) / 100) * lvlCircumference;

  return (
    <header className="flex shrink-0 items-center gap-2 px-8 py-4">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        aria-label="Назад"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--gray-3)] active:bg-[var(--gray-4)]"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
      </button>

      <div className="flex flex-1 items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setCollectionsOpen(true)}
          aria-label="Выбрать коллекцию"
          className="flex max-w-full items-center gap-1 rounded-full bg-[var(--brand-3)] px-3 py-2 active:bg-[var(--brand-4)]"
        >
          <span className="truncate text-sm font-medium leading-5 text-[var(--brand-11)]">
            {activeCollection?.title ?? 'Повторение'}
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0 text-[var(--brand-11)]" strokeWidth={2} />
        </button>

        {user && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label={`Уровень ${user.level}`}
            className="relative flex shrink-0 items-center justify-center"
            style={{ width: lvlRingSize, height: lvlRingSize }}
          >
            <svg width={lvlRingSize} height={lvlRingSize} className="absolute inset-0 -rotate-90">
              <circle
                cx={lvlRingSize / 2}
                cy={lvlRingSize / 2}
                r={lvlRadius}
                fill="var(--gray-3)"
                stroke="var(--gray-5)"
                strokeWidth={lvlStroke}
              />
              <circle
                cx={lvlRingSize / 2}
                cy={lvlRingSize / 2}
                r={lvlRadius}
                fill="none"
                stroke="var(--brand-9)"
                strokeWidth={lvlStroke}
                strokeLinecap="round"
                strokeDasharray={lvlCircumference}
                strokeDashoffset={lvlDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="relative text-xs font-bold text-[var(--gray-12)]">{user.level}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onHistoryClick}
        aria-label="История ответов"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--gray-3)] active:bg-[var(--gray-4)]"
      >
        <HugeiconsIcon icon={LeftToRightListStarIcon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
      </button>

      <CollectionsSheet open={collectionsOpen} onOpenChange={setCollectionsOpen} />
    </header>
  );
}
