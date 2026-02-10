import { useState, useCallback, useRef, useEffect } from 'react';
import { speakText, stopAudio } from '@/lib/tts';

type UseSpeechOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
};

type UseSpeechReturn = {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
  progress: number;
  opacity: number;
  error: string | null;
  isSupported: true;
};

const ERROR_CLEAR_MS = 3000;

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { rate = 0.9 } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const fadeAnimationRef = useRef<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  // Karaoke progress animation
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

  // Fade-out animation
  useEffect(() => {
    if (!isFading) return;

    const fadeDuration = 600;

    const animateFade = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newOpacity = Math.max(1 - elapsed / fadeDuration, 0);
      setOpacity(newOpacity);

      if (newOpacity > 0) {
        fadeAnimationRef.current = requestAnimationFrame(animateFade);
      } else {
        setIsFading(false);
        setProgress(0);
      }
    };

    startTimeRef.current = Date.now();
    fadeAnimationRef.current = requestAnimationFrame(animateFade);

    return () => {
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
    };
  }, [isFading]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (fadeAnimationRef.current) cancelAnimationFrame(fadeAnimationRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      stopAudio();
    };
  }, []);

  const finishSpeaking = useCallback(() => {
    if (!mountedRef.current) return;
    setIsSpeaking(false);
    setProgress(1);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    audioRef.current = null;
    // Start fade-out
    setIsFading(true);
  }, []);

  const showError = useCallback((msg: string) => {
    if (!mountedRef.current) return;
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setError(null);
    }, ERROR_CLEAR_MS);
  }, []);

  const speak = useCallback(
    (text: string) => {
      // Reset state
      stopAudio();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (fadeAnimationRef.current) cancelAnimationFrame(fadeAnimationRef.current);
      audioRef.current = null;

      setIsLoading(true);
      setIsSpeaking(false);
      setProgress(0);
      setOpacity(1);
      setIsFading(false);
      setError(null);

      speakText(text, rate)
        .then((audio) => {
          if (!mountedRef.current) return;
          setIsLoading(false);
          audioRef.current = audio;

          // Get real duration or estimate
          const realDuration = audio.duration;
          const estimatedMs = text.length * 80;
          durationRef.current = (realDuration && isFinite(realDuration) && realDuration > 0)
            ? realDuration * 1000
            : estimatedMs;

          setIsSpeaking(true);
          startTimeRef.current = Date.now();

          // Update duration when metadata loads (for more accurate progress)
          audio.addEventListener('loadedmetadata', () => {
            if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
              durationRef.current = audio.duration * 1000;
            }
          });

          audio.addEventListener('ended', () => {
            finishSpeaking();
          });
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setIsLoading(false);
          setIsSpeaking(false);
          setProgress(0);
          setOpacity(0);
          // Don't show error for intentional abort
          if (err instanceof DOMException && err.name === 'AbortError') return;
          showError('Не удалось загрузить озвучку');
        });
    },
    [rate, finishSpeaking, showError],
  );

  const stop = useCallback(() => {
    stopAudio();
    audioRef.current = null;
    setIsLoading(false);
    setIsSpeaking(false);
    setProgress(0);
    setOpacity(0);
    setIsFading(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (fadeAnimationRef.current) cancelAnimationFrame(fadeAnimationRef.current);
  }, []);

  return { speak, stop, isSpeaking, isLoading, progress, opacity, error, isSupported: true };
}
