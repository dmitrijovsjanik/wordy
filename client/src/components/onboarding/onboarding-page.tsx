import { useOnboardingStore } from '@/stores/onboarding-store';
import { WelcomeStep } from './welcome-step';
import { SelfAssessmentStep } from './self-assessment-step';
import { QuizStep } from './quiz-step';
import { AnalyzingStep } from './analyzing-step';
import { ResultStep } from './result-step';

export function OnboardingPage() {
  const step = useOnboardingStore((s) => s.step);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--gray-1)]">
      {step === 'welcome' && <WelcomeStep />}
      {step === 'self-assessment' && <SelfAssessmentStep />}
      {step === 'quiz' && <QuizStep />}
      {step === 'analyzing' && <AnalyzingStep />}
      {step === 'result' && <ResultStep />}
    </div>
  );
}
