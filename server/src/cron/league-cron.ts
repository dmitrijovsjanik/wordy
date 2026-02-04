import cron from 'node-cron';
import {
  getCurrentSeason,
  createSeason,
  finalizeSeason,
  sendSeasonEndingReminders,
} from '../services/league-service.js';
import {
  SEASON_CRON_EXPRESSION,
  REMINDER_CRON_EXPRESSION,
  SEASON_SCHEDULE,
} from '../config/league-config.js';

// Подведение итогов сезона и создание нового
// По умолчанию: воскресенье 21:00 UTC = понедельник 00:00 MSK
cron.schedule(
  SEASON_CRON_EXPRESSION,
  async () => {
    console.log('[League Cron] Starting season finalization...');
    try {
      const season = await getCurrentSeason();
      if (season) {
        await finalizeSeason(season.id);
        console.log(`[League Cron] Season ${season.id} finalized`);
      }

      const newSeason = await createSeason();
      console.log(`[League Cron] New season ${newSeason.id} created`);
    } catch (error) {
      console.error('[League Cron] Error during season finalization:', error);
    }
  },
  { timezone: 'UTC' },
);

// Напоминание о конце сезона (за 24 часа)
// По умолчанию: суббота 21:00 UTC = воскресенье 00:00 MSK
cron.schedule(
  REMINDER_CRON_EXPRESSION,
  async () => {
    console.log('[League Cron] Sending season ending reminders...');
    try {
      const season = await getCurrentSeason();
      if (season) {
        await sendSeasonEndingReminders(season.id);
        console.log('[League Cron] Season ending reminders sent');
      }
    } catch (error) {
      console.error('[League Cron] Error sending reminders:', error);
    }
  },
  { timezone: 'UTC' },
);

console.log(`[League Cron] Scheduled:`);
console.log(`  - Season finalization: "${SEASON_CRON_EXPRESSION}" UTC (${SEASON_SCHEDULE.cronHourUTC}:00 UTC = 00:00 MSK)`);
console.log(`  - Reminders: "${REMINDER_CRON_EXPRESSION}" UTC (${SEASON_SCHEDULE.reminderHoursBeforeEnd}h before end)`);
