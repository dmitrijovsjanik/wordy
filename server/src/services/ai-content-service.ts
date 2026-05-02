import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordAiContent } from '../db/schema.js';
import type { AiExamplesContent, AiMnemonicContent, AiHintsContent, AiContentType } from '../types/ai-content.js';

async function getAiContent<T>(meaningId: number, contentType: AiContentType): Promise<T | null> {
  const row = await db.query.wordAiContent.findFirst({
    where: and(
      eq(wordAiContent.meaningId, meaningId),
      eq(wordAiContent.contentType, contentType),
    ),
    columns: { content: true },
  });
  return (row?.content as T) ?? null;
}

export function getAiExamples(meaningId: number): Promise<AiExamplesContent | null> {
  return getAiContent<AiExamplesContent>(meaningId, 'examples');
}

export function getAiMnemonic(meaningId: number): Promise<AiMnemonicContent | null> {
  return getAiContent<AiMnemonicContent>(meaningId, 'mnemonic');
}

export function getAiHints(meaningId: number): Promise<AiHintsContent | null> {
  return getAiContent<AiHintsContent>(meaningId, 'hints');
}
