import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import { speakText, stopAudio } from '@/lib/tts';
import { PronunciationCheck } from './pronunciation-check';

type ShadowingPromptProps = {
  word: string;
  transcription: string | null;
  onDismiss: () => void;
};

function speakWord(word: string) {
  stopAudio();
  speakText(word, 0.85).catch(() => {});
}

// Check for Speech Recognition support at module level (once)
const hasSpeechRecognition = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

function ShadowingPromptBase({ word, transcription, onDismiss }: ShadowingPromptProps) {
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!hasPlayed.current) {
      hasPlayed.current = true;
      // Small delay so the animation starts first
      const timer = setTimeout(() => speakWord(word), 300);
      return () => clearTimeout(timer);
    }
  }, [word]);

  const handlePlay = useCallback(() => {
    speakWord(word);
  }, [word]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex items-center gap-3 rounded-2xl bg-[var(--gray-3)] px-4 py-3"
    >
      <button
        onClick={handlePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-3)] text-[var(--brand-11)] transition-colors active:bg-[var(--brand-4)]"
      >
        <HugeiconsIcon icon={VolumeHighIcon} size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--gray-12)]">
          Повтори: <span className="font-semibold">{word}</span>
        </p>
        {transcription && (
          <p className="text-xs text-[var(--gray-10)]">{transcription}</p>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="shrink-0 text-xs text-[var(--gray-10)] underline-offset-2 hover:underline"
      >
        Далее
      </button>
    </motion.div>
  );
}

export function ShadowingPrompt({ word, transcription, onDismiss }: ShadowingPromptProps) {
  if (hasSpeechRecognition) {
    return <PronunciationCheck word={word} transcription={transcription} onDismiss={onDismiss} />;
  }
  return <ShadowingPromptBase word={word} transcription={transcription} onDismiss={onDismiss} />;
}
