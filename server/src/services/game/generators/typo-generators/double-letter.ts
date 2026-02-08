import type { TypoGenerator, TypoGeneratorContext, TypoResult } from './types.js';

/**
 * Генератор опечаток с упрощением удвоенных букв
 * Примеры: hello→helo, balloon→baloon, better→beter
 * Только уменьшение повторяющихся букв, НЕ добавление новых
 */
export class DoubleLetterGenerator implements TypoGenerator {
  readonly id = 'double-letter';
  readonly priority = 10;

  generate(ctx: TypoGeneratorContext): TypoResult[] {
    const { word } = ctx;
    const results: TypoResult[] = [];
    const seen = new Set<string>();

    // 1. Упрощение повторяющихся букв (ll→l, ss→s, ee→e)
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1]) {
        const variant = word.slice(0, i) + word.slice(i + 1);
        if (variant.length >= 2 && !seen.has(variant)) {
          seen.add(variant);
          results.push({
            variant,
            type: 'double-simplify',
            confidence: 0.9,
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
