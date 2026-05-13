import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/ui/back-button';
import { PILOT_FEATURES } from '@/lib/pilot-config';

type RouteEntry = {
  path: string;
  label: string;
  pilotFlag?: keyof typeof PILOT_FEATURES;
};

type RouteGroup = {
  title: string;
  routes: RouteEntry[];
};

const GROUPS: RouteGroup[] = [
  {
    title: 'Основное',
    routes: [
      { path: '/', label: 'Главная' },
      { path: '/vocabulary/learn', label: 'Словарь — обучение' },
      { path: '/profile', label: 'Профиль' },
      { path: '/settings', label: 'Настройки' },
    ],
  },
  {
    title: 'Словарь',
    routes: [
      { path: '/vocabulary', label: 'Vocabulary хаб' },
      { path: '/vocabulary/phrases', label: 'Фразы' },
      { path: '/vocabulary/lexical-traps', label: 'Лексические ловушки' },
      { path: '/collections', label: 'Список коллекций' },
      { path: '/collections/create', label: 'Создать коллекцию' },
      { path: '/words', label: 'Все слова' },
    ],
  },
  {
    title: 'Под флагами пилота',
    routes: [
      { path: '/friends', label: 'Друзья', pilotFlag: 'friends' },
      { path: '/shop', label: 'Магазин', pilotFlag: 'gems' },
    ],
  },
];

export function DevRoutes() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <div>
        <BackButton to="/" />
      </div>
      <h1 className="text-xl font-bold">Все роуты приложения</h1>
      <p className="text-sm text-[var(--gray-11)]">
        Свалка для разработки. Здесь собраны все роуты, которые не выведены на новую главную.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[var(--gray-11)]">{group.title}</h2>
          <div className="flex flex-col gap-1">
            {group.routes.map((route) => {
              const flagDisabled = route.pilotFlag && !PILOT_FEATURES[route.pilotFlag];
              return (
                <button
                  key={route.path}
                  type="button"
                  onClick={() => navigate(route.path)}
                  disabled={flagDisabled}
                  className="flex items-center justify-between rounded-xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)] disabled:opacity-40"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{route.label}</span>
                    <span className="text-xs text-[var(--gray-11)]">{route.path}</span>
                  </div>
                  {route.pilotFlag && (
                    <span className="text-xs text-[var(--gray-10)]">
                      flag: {route.pilotFlag} = {String(PILOT_FEATURES[route.pilotFlag])}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
