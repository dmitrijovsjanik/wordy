import type { TypoGenerator, TypoGeneratorContext, TypoResult } from './types.js';

/**
 * Генератор опечаток с перестановкой соседних букв
 * Примеры: team→taem, friend→freind, their→thier
 */
export class TranspositionGenerator implements TypoGenerator {
  readonly id = 'transposition';
  readonly priority = 8;

  generate(ctx: TypoGeneratorContext): TypoResult[] {
    const { word } = ctx;
    const results: TypoResult[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < word.length - 2; i++) {
      // Меняем местами буквы на позициях i и i+1
      const chars = word.split('');
      [chars[i], chars[i + 1]] = [chars[i + 1]!, chars[i]!];
      const variant = chars.join('');

      if (variant === word || seen.has(variant)) continue;
      seen.add(variant);

      const confidence = 0.85;

      results.push({
        variant,
        type: 'transposition',
        confidence,
      });
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
