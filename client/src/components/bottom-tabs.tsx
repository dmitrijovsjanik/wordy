import { useNavigate, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen02Icon, Folder01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

type Tab = {
  path: string;
  label: string;
  icon: typeof BookOpen02Icon;
  match: (pathname: string) => boolean;
};

const tabs: Tab[] = [
  {
    path: '/',
    label: 'Квиз',
    icon: BookOpen02Icon,
    match: (p) => p === '/',
  },
  {
    path: '/collections',
    label: 'Коллекции',
    icon: Folder01Icon,
    match: (p) => p.startsWith('/collections'),
  },
  {
    path: '/profile',
    label: 'Профиль',
    icon: UserIcon,
    match: (p) => p === '/profile',
  },
];

export function BottomTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Не показываем на страницах дуэлей
  if (pathname.startsWith('/duel')) return null;

  return (
    <nav className="shrink-0 bg-[var(--gray-1)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-14 items-center justify-around mt-2 mb-2">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-1',
                isActive ? 'text-[var(--accent-9)]' : 'text-[var(--gray-11)]',
              )}
            >
              <HugeiconsIcon strokeWidth={2} icon={tab.icon} size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
