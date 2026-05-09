# Pilot Scope

Узкая версия приложения для тестирования на ограниченной группе пользователей.
Фокус — core-механика изучения слов. Всё остальное скрывается флагами, но
не удаляется из кода.

## Принципы

- **Не удаляем код** — скрываем под флагами. Решение об удалении принимается
  по итогам пилота отдельным проходом.
- **Парные флаги** клиент↔сервер. Серверные роуты выключенных механик должны
  возвращать 404/403, чтобы устаревший клиентский бандл не пробил защиту.
- **Single source of truth** — точечные `*_ENABLED` константы в
  `*-config.ts` (серверы) и `feature-flags.ts` (клиент). Сводный реестр
  `pilot-config.ts` агрегирует их для обзора и удобного импорта.
- **База ветка** — `feature/database-redesign` (после стабилизации мерджится
  в `main`, оттуда автодеплой). Архив текущего прода — `archive/pre-pilot-prod`.

## Решения по механикам

| # | Механика | Решение | Реализация |
|---|---|---|---|
| 1 | Дуэли | ❌ скрыть | UI: routes off, OTHER_SECTIONS card off. Server: 404 на `/api/duels/*` |
| 2 | Лиги / LP | ❌ скрыть | UI: routes off, LeagueBadge скрыт в шапках. Server: 404 на `/api/leagues/*` |
| 3 | Гемы (всё) | ❌ скрыть | `addGems()` no-op. Все накопители `gemsEarned` зануляются. GemsIndicator → null. `/shop` route off. Роуты покупок (`streak-freeze/purchase`, `lives/refill`, `xp-boost/purchase`) → 403 |
| 4 | Streak дней | ✅ оставить | Без freeze (гемов нет → выкупа нет) |
| 5 | Streak ответов | ✅ оставить | Без gem-награды (гемы off) |
| 6 | Друзья | ✅ оставить | |
| 7 | XP / уровни | ✅ оставить | Без gem-награды на level up |
| 8 | Double XP / boost | ❌ скрыть | Серверный `maybeApplyDoubleXp` отключён, клиентский таймер скрыт |
| 9 | Premium / payments | ❌ скрыть | `/api/payments/create` → 403 |
| 10 | Milestones | 🔄 редизайн | `lastLoginDate` обновляется при `dailyCorrectCount >= 25` (порог `STREAK_DAY_THRESHOLD` в `pilot-config.ts`). 50/7-day milestones — гемов off, награды нет |
| 11 | Reading mode | ❌ скрыть | UI route off, server 404 на `/api/reading/*` |
| 12 | Grammar module | ❌ скрыть | UI routes off, server 404 на `/api/grammar/*` |
| 13 | Admin | ✅ оставить | По `userId == 409693570` |
| 14 | Онбординг | ❌ скрыть | В коде отдельного flow нет; первый выбор коллекции остаётся как был |
| 15 | TTS | ✅ оставить | Часть core learning loop |
| 16 | Жизни (hearts) | ❌ скрыто | `LIVES_ENABLED = false` исторически |

## Ключевая редизайн-механика: Milestone → Streak

Сейчас `lastLoginDate` обновляется при **первом ответе дня** (вход = streak++).
В пилоте `lastLoginDate` обновляется при достижении `dailyCorrectCount >= 25`
правильных ответов за день. Смысл streak меняется с «не забыл зайти» на
«реально позанимался». Это качественный метрик retention, который и тестируется.

Реализация:
- `dailyCorrectCount` уже трекается (поле в `users`, обновляется в milestone-service)
- При инкременте `dailyCorrectCount` после `>= 25` — триггерим `updateStreakDays()`
- Старая логика `updateStreakDays` на «первом ответе дня» отключается под флагом
- 50-milestone (раньше +20 gems) — убрать из конфига для пилота
- 7-day streak milestone (раньше +30 gems) — убрать из конфига для пилота

## Что такое core (точно остаётся)

- Изучение слов через квизы (multiple choice, spelling, encounter,
  passive recall, free recall — все генераторы)
- Word-level learning redesign (новая БД, ранги по коллекции)
- Коллекции слов
- Озвучка (TTS)
- Telegram авторизация и `initData`-валидация
- XP/уровни (без gem-награды)
- Streak дней (по новой логике 25-правильных) и in-session streak ответов
- Друзья
- Admin

## Что скрыто

- Дуэли, Лиги/LP, Друзья UI? нет — друзья оставлены
- Гемы целиком (UI, награды, freeze, /shop, payments)
- Double XP / boost
- Reading, Grammar
- Жизни (исторически)
- Большая часть онбординга (кроме первого выбора коллекции)

## Реестры флагов

- **Серверный**: [server/src/config/pilot-config.ts](../server/src/config/pilot-config.ts)
- **Клиентский**: [client/src/lib/pilot-config.ts](../client/src/lib/pilot-config.ts)
- **Точечные**: `server/src/config/*-config.ts`, `client/src/lib/feature-flags.ts`
