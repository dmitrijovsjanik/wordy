import { describe, it, expect } from 'vitest';
import { getMskTodayStart, getMskDailyResetStart } from './msk-date.js';

describe('getMskTodayStart', () => {
  it('UTC 21:00 = MSK 00:00 → начало сегодняшнего дня', () => {
    const now = new Date(Date.UTC(2026, 4, 13, 21, 0)); // 13 мая 21:00 UTC = 14 мая 00:00 MSK
    const r = getMskTodayStart(now);
    expect(r.toISOString()).toBe('2026-05-13T21:00:00.000Z'); // = 14.05 00:00 MSK
  });

  it('UTC 20:59 = MSK 23:59 → начало текущего MSK дня (сегодня)', () => {
    const now = new Date(Date.UTC(2026, 4, 13, 20, 59));
    const r = getMskTodayStart(now);
    expect(r.toISOString()).toBe('2026-05-12T21:00:00.000Z'); // = 13.05 00:00 MSK
  });
});

describe('getMskDailyResetStart', () => {
  it('01:59 MSK → возвращает 02:00 MSK предыдущего дня', () => {
    // 13 мая 01:59 MSK = 12 мая 22:59 UTC
    const now = new Date(Date.UTC(2026, 4, 12, 22, 59));
    const r = getMskDailyResetStart(now);
    // Ожидаем 12 мая 02:00 MSK = 11 мая 23:00 UTC
    expect(r.toISOString()).toBe('2026-05-11T23:00:00.000Z');
  });

  it('02:00 MSK ровно → возвращает 02:00 MSK сегодня', () => {
    // 13 мая 02:00 MSK = 12 мая 23:00 UTC
    const now = new Date(Date.UTC(2026, 4, 12, 23, 0));
    const r = getMskDailyResetStart(now);
    expect(r.toISOString()).toBe('2026-05-12T23:00:00.000Z');
  });

  it('02:01 MSK → возвращает 02:00 MSK сегодня', () => {
    const now = new Date(Date.UTC(2026, 4, 12, 23, 1));
    const r = getMskDailyResetStart(now);
    expect(r.toISOString()).toBe('2026-05-12T23:00:00.000Z');
  });

  it('середина дня (15:00 MSK) → 02:00 MSK того же дня', () => {
    // 13 мая 15:00 MSK = 13 мая 12:00 UTC
    const now = new Date(Date.UTC(2026, 4, 13, 12, 0));
    const r = getMskDailyResetStart(now);
    expect(r.toISOString()).toBe('2026-05-12T23:00:00.000Z'); // = 13.05 02:00 MSK
  });

  it('переход на новый день: 23:30 MSK → 02:00 MSK сегодня', () => {
    // 13 мая 23:30 MSK = 13 мая 20:30 UTC
    const now = new Date(Date.UTC(2026, 4, 13, 20, 30));
    const r = getMskDailyResetStart(now);
    expect(r.toISOString()).toBe('2026-05-12T23:00:00.000Z'); // = 13.05 02:00 MSK
  });
});
