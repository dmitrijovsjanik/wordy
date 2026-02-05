# Progression System (XP, Levels, LP)

Вся логика начисления опыта, уровней и League Points централизована в двух файлах:

## Конфигурация: `server/src/config/progression-config.ts`
Единый источник истины для всех констант и формул прогрессии:

```ts
// Базовые значения (увеличенная разрядность x10 для точных модификаторов)
XP_CORRECT_ANSWER = 100   // было 10
XP_STREAK_DAYS_BONUS = 50 // было 5
XP_DUEL_WIN = 500         // было 50

// Формула уровня
calculateLevel(xp) = floor(sqrt(xp / 10000)) + 1

// Streak-модификаторы (в процентах: 100 = x1.0)
getXpModifier(streak)  // +10% за каждый ответ после 3 подряд
getLpModifier(streak)  // +5% за каждый ответ после 5 подряд
```

## Сервис: `server/src/services/progression-service.ts`
Все начисления XP/LP должны проходить через этот сервис:

```ts
rewardCorrectAnswer(userId, streak)     // квиз: XP + LP с модификаторами
rewardDuelWin(userId)                   // дуэль: XP + LP
rewardQuizSessionComplete(userId, ...)  // завершение сессии
updateStreakDays(userId)                // обновление streak дней
```

**Важно:**
- НЕ использовать `db.update(users).set({ xp: ... })` напрямую — только через progression-service
- LP-константы живут в `league-config.ts`, но streak-функции реэкспортируются из `progression-config.ts`
- При изменении формулы уровня или XP — менять только в `progression-config.ts`
