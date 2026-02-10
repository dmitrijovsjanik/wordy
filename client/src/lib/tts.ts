// Edge TTS via server endpoint, with browser speechSynthesis fallback

const BLOB_CACHE_MAX = 100;
const FETCH_TIMEOUT = 8000;

// Blob URL cache: normalized text → blob URL
const blobCache = new Map<string, string>();

function blobCacheKey(text: string): string {
  return text.trim().toLowerCase();
}

function blobCacheSet(key: string, url: string) {
  if (blobCache.size >= BLOB_CACHE_MAX) {
    const firstKey = blobCache.keys().next().value;
    if (firstKey !== undefined) {
      URL.revokeObjectURL(blobCache.get(firstKey)!);
      blobCache.delete(firstKey);
    }
  }
  blobCache.set(key, url);
}

// Current playback state
let currentAudio: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;

/**
 * Speak text via Edge TTS server endpoint.
 * Returns the HTMLAudioElement for duration/events tracking.
 * Falls back to browser speechSynthesis on server error.
 * Throws if both server and fallback fail.
 */
export async function speakText(text: string, rate = 1): Promise<HTMLAudioElement> {
  // Stop any previous playback
  stopAudio();

  const key = blobCacheKey(text);

  // Check blob cache first
  const cachedUrl = blobCache.get(key);
  if (cachedUrl) {
    const audio = new Audio(cachedUrl);
    audio.playbackRate = rate;
    currentAudio = audio;
    await audio.play();
    return audio;
  }

  // Fetch from server with timeout
  const abort = new AbortController();
  currentAbort = abort;
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`, {
      signal: abort.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`TTS server error: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    blobCacheSet(key, url);

    const audio = new Audio(url);
    audio.playbackRate = rate;
    currentAudio = audio;
    currentAbort = null;
    await audio.play();
    return audio;
  } catch (err) {
    clearTimeout(timer);
    currentAbort = null;

    // If abort was intentional (stopAudio called), don't fallback
    if (abort.signal.aborted && err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }

    // Fallback to browser speechSynthesis
    console.warn('Edge TTS failed, falling back to speechSynthesis:', err);
    return fallbackSpeak(text, rate);
  }
}

function fallbackSpeak(text: string, rate: number): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('TTS недоступен'));
      return;
    }

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;

    // Create a fake Audio element for compatibility with use-speech hook
    const fakeAudio = new Audio();
    // Estimate duration: ~80ms per character
    const estimatedDuration = (text.length * 0.08);
    Object.defineProperty(fakeAudio, 'duration', { get: () => estimatedDuration });
    Object.defineProperty(fakeAudio, 'currentTime', {
      get: () => {
        // Approximate current position
        return 0;
      },
    });

    utterance.onend = () => {
      fakeAudio.dispatchEvent(new Event('ended'));
    };
    utterance.onerror = (e) => {
      if (e.error === 'canceled') return;
      reject(new Error('Ошибка озвучки'));
    };

    currentAudio = fakeAudio;
    speechSynthesis.speak(utterance);
    resolve(fakeAudio);
  });
}

/**
 * Stop any currently playing audio and abort in-flight fetch.
 */
export function stopAudio() {
  // Abort in-flight fetch
  if (currentAbort) {
    currentAbort.abort();
    currentAbort = null;
  }

  // Stop HTML Audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // Stop speechSynthesis fallback
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}
