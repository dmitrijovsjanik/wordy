import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import { useSpeech } from '@/hooks/use-speech';

type WordDisplayProps = {
  word: string;
  originalForm?: string | null;
  transcription?: string | null;
  meaningId: number;
  // Для отключения анимации первого вопроса
  skipInitialAnimation?: boolean;
  // Показывать ли кнопку озвучивания (только для английских слов)
  showSpeaker?: boolean;
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
}: WordDisplayProps) {
  const { speak, isSpeaking, progress, opacity, isSupported } = useSpeech({ lang: 'en-US', rate: 0.85 });

  // Показываем karaoke-слой пока идёт воспроизведение или затухание
  const showKaraoke = isSpeaking || opacity > 0;

  const handleSpeak = () => {
    // Озвучиваем оригинальную форму если есть, иначе текущее слово
    speak(originalForm ?? word);
  };

  const canSpeak = showSpeaker && isSupported;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={meaningId}
        className="flex flex-col items-center"
        initial={skipInitialAnimation ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Кликабельная зона на всё слово */}
        <button
          type="button"
          onClick={canSpeak ? handleSpeak : undefined}
          disabled={!canSpeak}
          className={`flex flex-col items-center ${
            canSpeak ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          {/* Оригинальная форма сверху мелко (shoes при word=shoe) */}
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
                <span className="relative">
                  {/* Серая иконка — база */}
                  <HugeiconsIcon
                    icon={VolumeHighIcon}
                    size={16}
                    strokeWidth={2}
                  />
                  {/* Синяя иконка — поверх, с opacity */}
                  {showKaraoke && (
                    <span
                      className="absolute inset-0 text-[var(--brand-11)]"
                      style={{ opacity }}
                    >
                      <HugeiconsIcon
                        icon={VolumeHighIcon}
                        size={16}
                        strokeWidth={2}
                      />
                    </span>
                  )}
                </span>
              )}
              <span className="relative">
                {/* Фоновый слой — серый текст */}
                <span>[{transcription}]</span>

                {/* Karaoke-слой — заполняется цветом при проигрывании, затем плавно затухает */}
                {showKaraoke && (
                  <span
                    className="absolute inset-0 overflow-hidden text-[var(--brand-11)]"
                    style={{
                      width: `${progress * 100}%`,
                      opacity: opacity,
                    }}
                  >
                    [{transcription}]
                  </span>
                )}
              </span>
            </span>
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
