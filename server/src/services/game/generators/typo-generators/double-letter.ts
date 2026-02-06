import type { TypoGenerator, TypoGeneratorContext, TypoResult } from './types.js';

// Буквы, которые часто удваиваются в английском
const DOUBABLE_CONSONANTS = /[bcdfgklmnprst]/;

/**
 * Генератор опечаток с удвоением/упрощением букв
 * Примеры: hello→helo, necessary→neccessary, balloon→baloon
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

    // 2. Удвоение одиночных согласных (l→ll, t→tt, n→nn)
    // НО только в СЕРЕДИНЕ слова (не в начале/конце)
    for (let i = 1; i < word.length - 1; i++) {
      const char = word[i]!;
      // Пропускаем если уже удвоена или не подходит
      if (!DOUBABLE_CONSONANTS.test(char)) continue;
      if (word[i - 1] === char || word[i + 1] === char) continue;

      const variant = word.slice(0, i + 1) + char + word.slice(i + 1);

      // Проверяем что нет 3 букв подряд
      const hasTriple = /([a-z])\1{2,}/.test(variant);
      if (!hasTriple && !seen.has(variant)) {
        seen.add(variant);
        results.push({
          variant,
          type: 'double-add',
          confidence: 0.75,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
