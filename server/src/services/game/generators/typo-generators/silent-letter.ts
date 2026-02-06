import type { TypoGenerator, TypoGeneratorContext, TypoResult } from './types.js';

// ─── Silent Letter Rules ─────────────────────────────────────────────────────

type SilentRule = {
  pattern: RegExp;
  replacement: string;
  confidence: number;
  isRemoval: boolean; // true = удаление немой буквы, false = добавление
};

// Правила удаления немых букв
const REMOVAL_RULES: SilentRule[] = [
  { pattern: /^kn/, replacement: 'n', confidence: 0.8, isRemoval: true },    // knight → night
  { pattern: /^wr/, replacement: 'r', confidence: 0.8, isRemoval: true },    // write → rite
  { pattern: /^gn/, replacement: 'n', confidence: 0.75, isRemoval: true },   // gnome → nome
  { pattern: /^ps/, replacement: 's', confidence: 0.7, isRemoval: true },    // psychology → sychology
  { pattern: /^pn/, replacement: 'n', confidence: 0.7, isRemoval: true },    // pneumonia → neumonia
  { pattern: /mb$/, replacement: 'm', confidence: 0.85, isRemoval: true },   // climb → clim
  { pattern: /bt$/, replacement: 't', confidence: 0.8, isRemoval: true },    // debt → det
  { pattern: /mn$/, replacement: 'n', confidence: 0.75, isRemoval: true },   // autumn → autun
  { pattern: /gn$/, replacement: 'n', confidence: 0.75, isRemoval: true },   // sign → sin
  { pattern: /lk$/, replacement: 'k', confidence: 0.7, isRemoval: true },    // walk → wak
  { pattern: /lm$/, replacement: 'm', confidence: 0.7, isRemoval: true },    // calm → cam
  { pattern: /e$/, replacement: '', confidence: 0.5, isRemoval: true },      // make → mak (silent e)
];

// Правила добавления немых букв (обратные ошибки)
const ADDITION_RULES: SilentRule[] = [
  { pattern: /^n(?=[aeiou])/, replacement: 'kn', confidence: 0.6, isRemoval: false }, // night → knight
  { pattern: /^r(?=[aeiou])/, replacement: 'wr', confidence: 0.6, isRemoval: false }, // ring → wring
  { pattern: /m$/, replacement: 'mb', confidence: 0.65, isRemoval: false },           // clim → climb
  { pattern: /t$/, replacement: 'bt', confidence: 0.6, isRemoval: false },            // det → debt
  { pattern: /n$/, replacement: 'gn', confidence: 0.55, isRemoval: false },           // sin → sign
];

const ALL_RULES = [...REMOVAL_RULES, ...ADDITION_RULES];

/**
 * Генератор опечаток с немыми буквами
 * Примеры: knight→night, write→rite, climb→clim
 */
export class SilentLetterGenerator implements TypoGenerator {
  readonly id = 'silent-letter';
  readonly priority = 6;

  generate(ctx: TypoGeneratorContext): TypoResult[] {
    const { word } = ctx;
    const results: TypoResult[] = [];
    const seen = new Set<string>();

    for (const rule of ALL_RULES) {
      if (!rule.pattern.test(word)) continue;

      const variant = word.replace(rule.pattern, rule.replacement);
      if (variant === word || seen.has(variant)) continue;
      if (variant.length < 2) continue;

      seen.add(variant);
      results.push({
        variant,
        type: rule.isRemoval ? 'silent-remove' : 'silent-add',
        confidence: rule.confidence,
      });
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
