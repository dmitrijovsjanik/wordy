import type { FastifyInstance } from 'fastify';
import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const VOICE = 'en-US-EmmaMultilingualNeural';
const OUTPUT_FORMAT = 'audio-24khz-96kbitrate-mono-mp3';
const MAX_TEXT_LENGTH = 2000;
const TTS_TIMEOUT = 10000;
const CACHE_MAX = 200;

// LRU cache: normalized text → mp3 buffer
const cache = new Map<string, Buffer>();

function cacheKey(text: string): string {
  return text.trim().toLowerCase();
}

function cacheSet(key: string, buffer: Buffer) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, buffer);
}

export default async function ttsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { text?: string };
  }>('/api/tts', async (request, reply) => {
    const text = request.query.text?.trim();

    if (!text) {
      return reply.code(400).send({ error: 'Missing text parameter' });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return reply.code(400).send({ error: `Text too long (max ${MAX_TEXT_LENGTH} chars)` });
    }

    const key = cacheKey(text);

    // Check cache
    const cached = cache.get(key);
    if (cached) {
      return reply
        .header('Content-Type', 'audio/mpeg')
        .header('Cache-Control', 'public, max-age=86400')
        .send(cached);
    }

    const tmpFile = path.join(os.tmpdir(), `wordy-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);

    try {
      const tts = new EdgeTTS({
        voice: VOICE,
        lang: 'en-US',
        outputFormat: OUTPUT_FORMAT,
        timeout: TTS_TIMEOUT,
      });

      await tts.ttsPromise(text, tmpFile);
      const buffer = await fs.readFile(tmpFile);

      if (buffer.length === 0) {
        return reply.code(500).send({ error: 'TTS produced empty audio' });
      }

      cacheSet(key, buffer);

      return reply
        .header('Content-Type', 'audio/mpeg')
        .header('Cache-Control', 'public, max-age=86400')
        .send(buffer);
    } catch (err) {
      app.log.error(err, 'Edge TTS synthesis failed');
      return reply.code(500).send({ error: 'TTS synthesis failed' });
    } finally {
      fs.unlink(tmpFile).catch(() => {});
    }
  });
}
