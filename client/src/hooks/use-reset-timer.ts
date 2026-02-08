import { useState, useEffect } from 'react';

const MSK_OFFSET = 3;

/** Начало текущего дня по МСК (00:00 MSK = 21:00 UTC) */
function getMskTodayStart(): Date {
  const now = new Date();
  const mskMs = now.getTime() + MSK_OFFSET * 3600_000;
  const mskDay = new Date(mskMs);
  return new Date(
    Date.UTC(mskDay.getUTCFullYear(), mskDay.getUTCMonth(), mskDay.getUTCDate()) - MSK_OFFSET * 3600_000,
  );
}

export function useResetTimer() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      const tomorrowMskStart = new Date(getMskTodayStart().getTime() + 86400_000);
      const diff = tomorrowMskStart.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}ч ${m}м`);
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}
