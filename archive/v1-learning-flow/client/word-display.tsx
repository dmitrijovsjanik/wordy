import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import { useSpeech } from '@/hooks/use-speech';
import { MagicTextReveal } from '@/components/ui/text-spoiler';

type WordDisplayProps = {
  word: string;
  originalForm?: string | null;
  transcription?: string | null;
  meaningId: number;
  skipInitialAnimation?: boolean;
  showSpeaker?: boolean;
  blurred?: boolean;
  onRevealClick?: () => void;
};

// Адаптивный размер шрифта в зависимости от длины слова
function getFontSize(word: string): string {
  if (word.length > 14) {
    const maxSize = Math.max(1.5, 2.25 - (word.length - 14) * 0.08);
    return `clamp(1.25rem, 8vw, ${maxSize}rem)`;
  }
  if (word.length > 10) {
    const maxSize = 2.25 - (word.length - 10) * 0.05;
    return `clamp(1.5rem, 9vw, ${maxSize}rem)`;
  }
  return 'clamp(1.75rem, 10vw, 2.25rem)';
}


export function WordDisplay({
  word,
  originalForm,
  transcription,
  meaningId,
  skipInitialAnimation = false,
  showSpeaker = false,
  blurred = false,
  onRevealClick,
}: WordDisplayProps) {
  const { speak, isSpeaking, isLoading, progress, opacity } = useSpeech({ lang: 'en-US', rate: 0.85 });
  const showKaraoke = isSpeaking || opacity > 0;
  const canSpeak = showSpeaker;
  const useSpoiler = onRevealClick !== undefined;
  const [textVisible, setTextVisible] = useState(!blurred);
  const handleRevealed = useCallback(() => setTextVisible(true), []);

  const handleSpeak = () => {
    speak(originalForm ?? word);
  };

  const normalContent = (
    <button
      type="button"
      onClick={canSpeak ? handleSpeak : undefined}
      disabled={!canSpeak}
      className={`flex w-full flex-col items-center ${
        canSpeak ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {originalForm && (
        <span className="mb-1 text-xs text-[var(--gray-10)]">
          {originalForm}
        </span>
      )}

      <h2
        className="max-w-full break-words px-4 text-center font-bold"
        style={{ fontSize: getFontSize(word) }}
      >
        {word}
      </h2>

      {transcription && (
        <span className="mt-1 flex items-center gap-1.5 text-sm text-[var(--gray-10)]">
          {canSpeak && (
            <span className={`relative ${isLoading ? 'animate-pulse' : ''}`}>
              <HugeiconsIcon icon={VolumeHighIcon} size={16} strokeWidth={2} />
              {showKaraoke && (
                <span className="absolute inset-0 text-[var(--brand-11)]" style={{ opacity }}>
                  <HugeiconsIcon icon={VolumeHighIcon} size={16} strokeWidth={2} />
                </span>
              )}
            </span>
          )}
          <span className="relative">
            <span>[{transcription}]</span>
            {showKaraoke && (
              <span
                className="absolute inset-0 overflow-hidden text-[var(--brand-11)]"
                style={{ width: `${progress * 100}%`, opacity }}
              >
                [{transcription}]
              </span>
            )}
          </span>
        </span>
      )}
    </button>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={meaningId}
        className="flex w-full flex-col items-center"
        initial={skipInitialAnimation ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {useSpoiler ? (
          <button
            type="button"
            onClick={blurred ? onRevealClick : (canSpeak ? handleSpeak : undefined)}
            className={`relative flex w-full flex-col items-center ${
              blurred ? 'cursor-pointer' : canSpeak ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            {/* Visible content — ONE container, ONE opacity toggle */}
            <div className={`flex w-full flex-col items-center ${textVisible ? '' : 'opacity-0'}`}>
              {originalForm && (
                <span className="mb-1 text-xs text-[var(--gray-10)]">
                  {originalForm}
                </span>
              )}

              <h2
                className="max-w-full break-words px-4 text-center font-bold"
                style={{ fontSize: getFontSize(word) }}
              >
                {word}
              </h2>

              {transcription && (
                <span className="mt-1 flex items-center gap-1.5 text-sm text-[var(--gray-10)]">
                  {canSpeak && (
                    <span className={`relative ${isLoading ? 'animate-pulse' : ''}`}>
                      <HugeiconsIcon icon={VolumeHighIcon} size={16} strokeWidth={2} />
                      {showKaraoke && (
                        <span className="absolute inset-0 text-[var(--brand-11)]" style={{ opacity }}>
                          <HugeiconsIcon icon={VolumeHighIcon} size={16} strokeWidth={2} />
                        </span>
                      )}
                    </span>
                  )}
                  <span className="relative">
                    <span>[{transcription}]</span>
                    {showKaraoke && (
                      <span
                        className="absolute inset-0 overflow-hidden text-[var(--brand-11)]"
                        style={{ width: `${progress * 100}%`, opacity }}
                      >
                        [{transcription}]
                      </span>
                    )}
                  </span>
                </span>
              )}
            </div>

            {/* Canvas overlay — separate layer, not affected by content opacity */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <MagicTextReveal
                text={word}
                revealed={!blurred}
                onRevealed={handleRevealed}
                fontSize={getFontSize(word)}
                fontFamily="Unbounded, system-ui, sans-serif"
              />
            </div>
          </button>
        ) : (
          normalContent
        )}
      </motion.div>
    </AnimatePresence>
  );
}
