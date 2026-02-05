import { useState, useCallback, useRef, useEffect } from 'react';

type UseSpeechOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
};

type UseSpeechReturn = {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  // Прогресс от 0 до 1 для karaoke-эффекта
  progress: number;
  // Opacity от 1 до 0 для плавного затухания после окончания
  opacity: number;
  isSupported: boolean;
};

/**
 * Хук для озвучивания текста через Web Speech API
 * с поддержкой прогресса для karaoke-эффекта
 */
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { lang = 'en-US', rate = 0.9, pitch = 1 } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fadeAnimationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const fadeStartTimeRef = useRef<number>(0);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Анимация прогресса через useEffect
  useEffect(() => {
    if (!isSpeaking) return;

    const animate = () => {
      if (durationRef.current === 0) return;

      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min(elapsed / durationRef.current, 1);
      setProgress(newProgress);

      if (newProgress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpeaking]);

  // Анимация затухания
  useEffect(() => {
    if (!isFading) return;

    const fadeDuration = 600; // мс

    const animateFade = () => {
      const elapsed = Date.now() - fadeStartTimeRef.current;
      const newOpacity = Math.max(1 - elapsed / fadeDuration, 0);
      setOpacity(newOpacity);

      if (newOpacity > 0) {
        fadeAnimationRef.current = requestAnimationFrame(animateFade);
      } else {
        setIsFading(false);
        setProgress(0);
      }
    };

    fadeAnimationRef.current = requestAnimationFrame(animateFade);

    return () => {
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
    };
  }, [isFading]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      // Останавливаем предыдущее воспроизведение
      window.speechSynthesis.cancel();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Оценка длительности: ~80мс на символ при rate=1
      // Корректируем на rate
      const estimatedDuration = (text.length * 80) / rate;
      durationRef.current = estimatedDuration;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setProgress(0);
        setOpacity(1);
        setIsFading(false);
        startTimeRef.current = Date.now();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setProgress(1);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        // Запускаем плавное затухание
        fadeStartTimeRef.current = Date.now();
        setIsFading(true);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setProgress(0);
        setOpacity(0);
        setIsFading(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, lang, rate, pitch],
  );

  const stop = useCallback(() => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setProgress(0);
    setOpacity(0);
    setIsFading(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (fadeAnimationRef.current) {
      cancelAnimationFrame(fadeAnimationRef.current);
    }
  }, [isSupported]);

  return { speak, stop, isSpeaking, progress, opacity, isSupported };
}
