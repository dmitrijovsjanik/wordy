// Edge TTS via server endpoint, with browser speechSynthesis fallback

const BLOB_CACHE_MAX = 100;
const FETCH_TIMEOUT = 8000;

// Blob URL cache: normalized text → blob URL
const blobCache = new Map<string, string>();

function blobCacheKey(text: string, voice?: string): string {
  const base = text.trim().toLowerCase();
  return voice ? `${voice}|${base}` : base;
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
let longPlaybackAbort: AbortController | null = null;

/**
 * Speak text via Edge TTS server endpoint.
 * Returns the HTMLAudioElement for duration/events tracking.
 * Falls back to browser speechSynthesis on server error.
 * Throws if both server and fallback fail.
 */
export async function speakText(text: string, rate = 1, voice?: string): Promise<HTMLAudioElement> {
  // Stop any previous playback
  stopAudio();

  const key = blobCacheKey(text, voice);

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

  const params = new URLSearchParams({ text });
  if (voice) params.set('voice', voice);

  try {
    const res = await fetch(`/api/tts?${params}`, {
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

    // Fallback to browser speechSynthesis (no voice param — browser native)
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
  // Abort long playback sequence
  if (longPlaybackAbort) {
    longPlaybackAbort.abort();
    longPlaybackAbort = null;
  }

  // Abort in-flight fetch
  if (currentAbort) {
    currentAbort.abort();
    currentAbort = null;
  }

  // Stop HTML Audio
  if (currentAudio) {
    currentAudio.pause();
    try { currentAudio.currentTime = 0; } catch { /* VK WebView: currentTime may be readonly */ }
    currentAudio = null;
  }

  // Stop speechSynthesis fallback
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

// ─── Long text: sentence-by-sentence playback with prefetch ────────────────

export type LongTextCallbacks = {
  onSentenceStart?: (index: number, total: number) => void;
  onSentenceEnd?: (index: number, total: number) => void;
  onFinish?: () => void;
  onError?: (err: unknown) => void;
};

/**
 * Speak long text by splitting into sentences and playing them sequentially.
 * Prefetches next sentence while current one plays for minimal gaps.
 * Falls back to single speakText() if text has only one sentence.
 */
export async function speakLongText(
  text: string,
  rate: number,
  callbacks: LongTextCallbacks,
  voice?: string,
): Promise<void> {
  stopAudio();

  const sentences = splitSentences(text);

  if (sentences.length <= 1) {
    // Short text — use regular speakText
    try {
      const audio = await speakText(sentences[0] ?? text, rate, voice);
      audio.addEventListener('ended', () => callbacks.onFinish?.());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      callbacks.onError?.(err);
    }
    return;
  }

  longPlaybackAbort = new AbortController();
  const signal = longPlaybackAbort.signal;

  // Prefetch queue: index → Promise<blobUrl>
  const prefetchQueue: Map<number, Promise<string>> = new Map();

  const prefetch = (idx: number) => {
    if (idx >= sentences.length || prefetchQueue.has(idx)) return;
    prefetchQueue.set(idx, fetchTtsBlob(sentences[idx], voice));
  };

  // Start prefetching first 2 sentences
  prefetch(0);
  prefetch(1);

  try {
    for (let i = 0; i < sentences.length; i++) {
      if (signal.aborted) break;

      callbacks.onSentenceStart?.(i, sentences.length);

      const blobUrl = await prefetchQueue.get(i)!;
      if (signal.aborted) break;

      // Start prefetching ahead
      prefetch(i + 2);

      await playBlobUrl(blobUrl, rate, signal);

      callbacks.onSentenceEnd?.(i, sentences.length);
    }

    if (!signal.aborted) {
      callbacks.onFinish?.();
    }
  } catch (err) {
    if (!signal.aborted) {
      callbacks.onError?.(err);
    }
  } finally {
    longPlaybackAbort = null;
  }
}

/** Fetch TTS audio and return blob URL (with caching) */
async function fetchTtsBlob(text: string, voice?: string): Promise<string> {
  const key = blobCacheKey(text, voice);
  const cached = blobCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ text });
  if (voice) params.set('voice', voice);

  const res = await fetch(`/api/tts?${params}`);
  if (!res.ok) throw new Error(`TTS error: ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  blobCacheSet(key, url);
  return url;
}

/** Play a blob URL audio, resolves when ended or aborted */
function playBlobUrl(url: string, rate: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { resolve(); return; }

    const audio = new Audio(url);
    audio.playbackRate = rate;
    currentAudio = audio;

    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };

    const onEnded = () => { cleanup(); resolve(); };
    const onError = (e: Event) => { cleanup(); reject(e); };
    const onAbort = () => { audio.pause(); cleanup(); resolve(); };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort);

    audio.play().catch((err) => { cleanup(); reject(err); });
  });
}

/** Split text into sentences, merging short fragments */
function splitSentences(text: string): string[] {
  // Match sentences ending with . ! ? (including trailing whitespace)
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g);
  if (!raw) return [text];

  const result: string[] = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    // Merge short fragments (e.g. "Mr." "Dr." "e.g.") with previous
    if (result.length > 0 && trimmed.length < 20) {
      result[result.length - 1] += ' ' + trimmed;
    } else {
      result.push(trimmed);
    }
  }

  return result.length > 0 ? result : [text];
}
