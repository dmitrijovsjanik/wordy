import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

export function AnalyzingStep() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate from 0 to 100 over ~2 seconds using requestAnimationFrame
    const start = performance.now();
    const duration = 2000;
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (elapsed < duration) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <div className="mb-6 animate-bounce text-5xl">🔍</div>
      <p className="text-lg font-medium text-[var(--gray-12)]">
        Анализируем результаты...
      </p>
      <p className="mt-2 text-sm text-[var(--gray-10)]">
        Подбираем программу обучения
      </p>
      <Progress value={progress} className="mx-auto mt-6 h-2 w-48" />
    </div>
  );
}
