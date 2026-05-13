import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mic01Icon, VolumeHighIcon, Tick01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { levenshtein } from '@/lib/levenshtein';
import { speakText, stopAudio } from '@/lib/tts';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';

type PronunciationCheckProps = {
  word: string;
  transcription: string | null;
  onDismiss: () => void;
};

type CheckState = 'idle' | 'listening' | 'result';
type ResultType = 'exact' | 'close' | 'far';

const MAX_ATTEMPTS = 3;

function speakWord(word: string) {
  stopAudio();
  speakText(word, 0.85).catch(() => {});
}

function evaluateResult(transcript: string, targetWord: string): ResultType {
  const normalizedTranscript = transcript.toLowerCase().trim();
  const normalizedTarget = targetWord.toLowerCase().trim();

  if (normalizedTranscript === normalizedTarget) {
    return 'exact';
  }

  const distance = levenshtein(normalizedTranscript, normalizedTarget);
  if (distance <= 2) {
    return 'close';
  }

  return 'far';
}

export function PronunciationCheck({ word, transcription, onDismiss }: PronunciationCheckProps) {
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [resultType, setResultType] = useState<ResultType | null>(null);
  const [attempts, setAttempts] = useState(0);
  const hasPlayedRef = useRef(false);

  const {
    start: startRecognition,
    stop: stopRecognition,
    transcript,
    isListening,
    error,
  } = useSpeechRecognition('en-US');

  // Auto-play TTS on mount
  useEffect(() => {
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      const timer = setTimeout(() => speakWord(word), 300);
      return () => clearTimeout(timer);
    }
  }, [word]);

  // Watch for recognition results
  useEffect(() => {
    if (transcript && checkState === 'listening') {
      const result = evaluateResult(transcript, word);
      setResultType(result);
      setCheckState('result');
      setAttempts((prev) => prev + 1);
    }
  }, [transcript, word, checkState]);

  // Handle recognition ending without result (e.g. no speech detected)
  useEffect(() => {
    if (!isListening && checkState === 'listening' && !transcript) {
      // Recognition ended but no transcript — go back to idle
      setCheckState('idle');
    }
  }, [isListening, checkState, transcript]);

  // Handle recognition errors
  useEffect(() => {
    if (error && checkState === 'listening') {
      setCheckState('idle');
    }
  }, [error, checkState]);

  const handleMicPress = useCallback(() => {
    if (checkState === 'listening') {
      stopRecognition();
      setCheckState('idle');
      return;
    }
    setCheckState('listening');
    startRecognition();
  }, [checkState, startRecognition, stopRecognition]);

  const handleRetry = useCallback(() => {
    setResultType(null);
    setCheckState('idle');
  }, []);

  const handlePlayTTS = useCallback(() => {
    speakWord(word);
  }, [word]);

  const canRetry = resultType === 'far' && attempts < MAX_ATTEMPTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--gray-3)] px-4 py-4"
    >
      {/* Word + transcription */}
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-base font-bold text-[var(--gray-12)]">{word}</p>
        {transcription && (
          <p className="text-xs text-[var(--gray-10)]">[{transcription}]</p>
        )}
      </div>

      {/* Controls row: TTS button, Mic button, Dismiss button */}
      <div className="flex items-center gap-4">
        {/* TTS button */}
        <button
          onClick={handlePlayTTS}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gray-4)] text-[var(--gray-11)] transition-colors active:bg-[var(--gray-5)]"
        >
          <HugeiconsIcon icon={VolumeHighIcon} size={18} />
        </button>

        {/* Microphone button */}
        <button
          onClick={handleMicPress}
          disabled={checkState === 'result'}
          className={cn(
            'relative flex h-14 w-14 items-center justify-center rounded-full transition-colors',
            checkState === 'listening'
              ? 'bg-[var(--red-9)] text-white'
              : 'bg-[var(--brand-9)] text-white active:bg-[var(--brand-10)]',
            checkState === 'result' && 'opacity-40',
          )}
        >
          {/* Pulsing ring when listening */}
          {checkState === 'listening' && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-[var(--red-9)]"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}
          <HugeiconsIcon icon={Mic01Icon} size={24} />
        </button>

        {/* Dismiss / Next button */}
        <button
          onClick={onDismiss}
          className="flex h-9 items-center justify-center rounded-full px-3 text-xs text-[var(--gray-10)] transition-colors active:text-[var(--gray-12)]"
        >
          Далее
        </button>
      </div>

      {/* Listening hint */}
      {checkState === 'listening' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-[var(--gray-10)]"
        >
          Говорите...
        </motion.p>
      )}

      {/* Result feedback */}
      <AnimatePresence>
        {checkState === 'result' && resultType !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="flex w-full flex-col items-center gap-2"
          >
            {resultType === 'exact' && (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--green-3)] px-4 py-2">
                <HugeiconsIcon icon={Tick01Icon} size={18} className="text-[var(--green-11)]" />
                <span className="text-sm font-medium text-[var(--green-11)]">
                  Отлично!
                </span>
              </div>
            )}

            {resultType === 'close' && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--amber-3)] px-4 py-2">
                <span className="text-sm font-medium text-[var(--amber-11)]">
                  Почти!
                </span>
                <span className="text-xs text-[var(--amber-11)]">
                  Правильно: <span className="font-semibold">{word}</span>
                </span>
              </div>
            )}

            {resultType === 'far' && (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-xl bg-[var(--red-3)] px-4 py-2">
                  <span className="text-sm font-medium text-[var(--red-11)]">
                    Попробуйте ещё
                  </span>
                </div>
                {canRetry && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--gray-4)] px-3 py-1.5 text-xs text-[var(--gray-11)] transition-colors active:bg-[var(--gray-5)]"
                  >
                    <HugeiconsIcon icon={RefreshIcon} size={14} />
                    Ещё раз ({MAX_ATTEMPTS - attempts} осталось)
                  </button>
                )}
                {!canRetry && (
                  <p className="text-xs text-[var(--gray-10)]">
                    Попытки закончились
                  </p>
                )}
              </div>
            )}

            {/* Show what was recognized */}
            {transcript && (
              <p className="text-xs text-[var(--gray-9)]">
                Распознано: &laquo;{transcript}&raquo;
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error display */}
      {error && error !== 'no-speech' && (
        <p className="text-xs text-[var(--red-10)]">
          Ошибка распознавания
        </p>
      )}
    </motion.div>
  );
}
