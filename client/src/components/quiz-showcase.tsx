import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { WordDisplay } from '@/components/game/word-display';
import { MultipleChoice } from '@/components/game/question-types/multiple-choice';
import { Spelling } from '@/components/game/question-types/spelling';
import { MatchPairs } from '@/components/game/question-types/match-pairs';
import { Cloze } from '@/components/game/question-types/cloze';
import { Listening } from '@/components/game/question-types/listening';
import { Dictation } from '@/components/game/question-types/dictation';
import { FreeRecall } from '@/components/game/question-types/free-recall';
import { QuizContainer } from '@/components/game/quiz-container';
import { ArticleQuiz } from '@/components/grammar/article-quiz';
import { TenseQuiz } from '@/components/grammar/tense-quiz';
import { CollocationQuiz } from '@/components/grammar/collocation-quiz';
import { FalseFriendsQuiz } from '@/components/grammar/false-friends-quiz';
import type { AnswerFeedback } from '@/types/game';

const QUESTION_TYPES = [
  'multiple-choice',
  'spelling',
  'match-pairs',
  'cloze',
  'listening',
  'dictation',
  'free-recall',
  'articles',
  'tenses',
  'collocations',
  'false-friends',
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number];

const GRAMMAR_TYPES = new Set<QuestionType>(['articles', 'tenses', 'collocations', 'false-friends']);

const TYPE_LABELS: Record<QuestionType, string> = {
  'multiple-choice': 'Выбор',
  'spelling': 'Написание',
  'match-pairs': 'Пары',
  'cloze': 'Пропуск',
  'listening': 'Аудирование',
  'dictation': 'Диктант',
  'free-recall': 'Перевод',
  'articles': 'Артикли',
  'tenses': 'Времена',
  'collocations': 'Фразы',
  'false-friends': 'Ловушки',
};

export function QuizShowcase() {
  const [activeType, setActiveType] = useState<QuestionType>('multiple-choice');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [key, setKey] = useState(0);

  const reset = useCallback(() => {
    setSelectedAnswer(null);
    setFeedback(null);
    setKey((k) => k + 1);
  }, []);

  const handleAnswer = useCallback((option: string) => {
    setSelectedAnswer(option);
    const isCorrect = option === getMockCorrectAnswer(activeType);
    setFeedback({
      isCorrect,
      correctAnswer: getMockCorrectAnswer(activeType),
    });
  }, [activeType]);

  const handleSkip = useCallback(() => {
    setSelectedAnswer(null);
    setFeedback({
      isCorrect: false,
      correctAnswer: getMockCorrectAnswer(activeType),
    });
  }, [activeType]);

  const handleMatchComplete = useCallback((results: Array<{ meaningId: number; isCorrect: boolean }>) => {
    const allCorrect = results.every((r) => r.isCorrect);
    setFeedback({
      isCorrect: allCorrect,
      correctAnswer: '',
    });
    setTimeout(reset, 1500);
  }, [reset]);

  const handleDictationAnswer = useCallback((_meaningId: number | null) => {
    // Dictation handles its own local feedback
    setTimeout(reset, 2000);
  }, [reset]);

  const handleFreeRecallAnswer = useCallback((_meaningId: number | null) => {
    setTimeout(reset, 2000);
  }, [reset]);

  const isGrammar = GRAMMAR_TYPES.has(activeType);

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      {/* Header */}
      <h1 className="mb-3 text-center text-lg font-bold text-[var(--gray-12)]">Витрина квизов</h1>

      {/* Type switcher */}
      <div className="mb-4 flex flex-wrap justify-center gap-1.5">
        {QUESTION_TYPES.map((type) => (
          <Button
            key={type}
            variant={activeType === type ? 'default' : 'secondary'}
            size="sm"
            className="text-xs"
            onClick={() => { setActiveType(type); reset(); }}
          >
            {TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      {/* Grammar quizzes — self-contained */}
      {isGrammar ? (
        <div key={`grammar-${activeType}-${key}`} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {activeType === 'articles' && <ArticleQuiz />}
          {activeType === 'tenses' && <TenseQuiz />}
          {activeType === 'collocations' && <CollocationQuiz />}
          {activeType === 'false-friends' && <FalseFriendsQuiz />}
        </div>
      ) : (
        <>
          {/* Word quiz preview */}
          <div className="flex min-h-0 flex-1 flex-col">
            <QuizContainer questionKey={`${activeType}-${key}`}>
              {/* Word area */}
              {activeType !== 'match-pairs' && activeType !== 'cloze' && activeType !== 'listening' && activeType !== 'dictation' && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                  <WordDisplay
                    word={getDisplayWord(activeType)}
                    originalForm={null}
                    transcription={getDisplayTranscription(activeType)}
                    meaningId={1}
                    skipInitialAnimation
                    showSpeaker={activeType !== 'free-recall' || true}
                  />
                </div>
              )}

              {activeType === 'match-pairs' && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                  <h2 className="mb-1 font-[Unbounded] font-bold text-[var(--gray-12)]" style={{ fontSize: 'clamp(1.75rem, 10vw, 2.25rem)' }}>Соедините пары</h2>
                  <p className="text-sm text-[var(--gray-11)]">Нажмите на слово, затем на его перевод</p>
                </div>
              )}

              {activeType === 'cloze' && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8 px-4">
                  <div className="text-center">
                    <p className="font-[Unbounded] font-bold leading-relaxed text-[var(--gray-12)]" style={{ fontSize: 'clamp(1.75rem, 10vw, 2.25rem)' }}>
                      She ___ to the store yesterday.
                    </p>
                    <p className="mt-2 text-sm text-[var(--gray-11)]">Она ходила в магазин вчера.</p>
                  </div>
                </div>
              )}

              {activeType === 'listening' && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                  <h2 className="font-[Unbounded] font-bold text-[var(--gray-12)]" style={{ fontSize: 'clamp(1.75rem, 10vw, 2.25rem)' }}>Что вы слышите?</h2>
                </div>
              )}

              {activeType === 'dictation' && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                  <WordDisplay
                    word="красивый"
                    originalForm={null}
                    transcription={null}
                    meaningId={1}
                    skipInitialAnimation
                    showSpeaker={false}
                  />
                  <p className="mt-2 text-sm text-[var(--gray-11)]">Напишите слово на английском</p>
                </div>
              )}

              {/* Answer area */}
              <div className="shrink-0">
                {activeType === 'multiple-choice' && (
                  <MultipleChoice
                    options={['команда', 'время', 'место', 'работа']}
                    questionKey={key}
                    selectedAnswer={selectedAnswer}
                    feedback={feedback}
                    onAnswer={handleAnswer}
                    onSkip={handleSkip}
                    showSkip
                  />
                )}

                {activeType === 'spelling' && (
                  <Spelling
                    options={['team', 'teem', 'tim', 'tiem']}
                    questionKey={key}
                    selectedAnswer={selectedAnswer}
                    feedback={feedback}
                    onAnswer={handleAnswer}
                    onSkip={handleSkip}
                    showSkip
                  />
                )}

                {activeType === 'match-pairs' && (
                  <MatchPairs
                    pairs={[
                      { meaningId: 1, word: 'team', translation: 'команда' },
                      { meaningId: 2, word: 'time', translation: 'время' },
                      { meaningId: 3, word: 'work', translation: 'работа' },
                      { meaningId: 4, word: 'place', translation: 'место' },
                    ]}
                    questionKey={`mp-${key}`}
                    disabled={false}
                    onComplete={handleMatchComplete}
                    onSkip={handleSkip}
                    showSkip
                  />
                )}

                {activeType === 'cloze' && (
                  <Cloze
                    options={['went', 'goes', 'going', 'gone']}
                    questionKey={key}
                    selectedAnswer={selectedAnswer}
                    feedback={feedback}
                    onAnswer={handleAnswer}
                    onSkip={handleSkip}
                    showSkip
                  />
                )}

                {activeType === 'listening' && (
                  <Listening
                    options={['команда', 'время', 'место', 'работа']}
                    questionKey={key}
                    selectedAnswer={selectedAnswer}
                    feedback={feedback}
                    onAnswer={handleAnswer}
                    onSkip={handleSkip}
                    showSkip
                    audioWord="team"
                    transcription="tiːm"
                  />
                )}

                {activeType === 'dictation' && (
                  <Dictation
                    questionKey={key}
                    audioWord="beautiful"
                    hint="красивый"
                    correctAnswer="beautiful"
                    acceptableAnswers={['beautiful']}
                    feedback={null}
                    disabled={false}
                    onAnswer={handleDictationAnswer}
                    onSkip={handleSkip}
                    showSkip
                    meaningId={1}
                  />
                )}

                {activeType === 'free-recall' && (
                  <FreeRecall
                    questionKey={key}
                    prompt="team"
                    direction="en-ru"
                    transcription="tiːm"
                    acceptableAnswers={['команда', 'коллектив', 'группа']}
                    feedback={null}
                    disabled={false}
                    meaningId={1}
                    onAnswer={handleFreeRecallAnswer}
                    onSkip={handleSkip}
                    showSkip
                  />
                )}
              </div>
            </QuizContainer>
          </div>

          {/* Reset button */}
          {feedback && activeType !== 'match-pairs' && activeType !== 'dictation' && activeType !== 'free-recall' && (
            <Button variant="secondary" onClick={reset} className="mt-3">
              Сбросить
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function getMockCorrectAnswer(type: QuestionType): string {
  switch (type) {
    case 'multiple-choice': return 'команда';
    case 'spelling': return 'team';
    case 'cloze': return 'went';
    case 'listening': return 'команда';
    default: return '';
  }
}

function getDisplayWord(type: QuestionType): string {
  switch (type) {
    case 'free-recall': return 'team';
    default: return 'team';
  }
}

function getDisplayTranscription(type: QuestionType): string | null {
  switch (type) {
    case 'free-recall': return 'tiːm';
    default: return 'tiːm';
  }
}
