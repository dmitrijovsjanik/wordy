import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding-store';

export function WelcomeStep() {
  const handleStart = () => {
    useOnboardingStore.getState().setStep('self-assessment');
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="text-6xl mb-6">🎯</div>
      <h1 className="text-3xl font-bold text-[var(--gray-12)]">Привет!</h1>
      <p className="text-base text-[var(--gray-11)] text-center mt-2">
        Давай узнаем, сколько английских слов ты знаешь!
      </p>
      <p className="text-sm text-[var(--gray-10)] mt-1">
        Быстрая разминка — 12 вопросов
      </p>
      <div className="mt-auto w-full px-4 pb-8">
        <Button className="w-full" onClick={handleStart}>
          Начнём!
        </Button>
      </div>
    </div>
  );
}
