import type { TypoGenerator, TypoGeneratorContext, TypoResult, TypoType } from './types.js';

// ─── Phonetic Rules ──────────────────────────────────────────────────────────

type PhoneticRule = {
  pattern: RegExp;
  replacements: string[];
  confidence: number;
  type: TypoType;
};

// Гласные
const VOWEL_RULES: PhoneticRule[] = [
  { pattern: /ea/g, replacements: ['ee', 'ie', 'e', 'i'], confidence: 0.95, type: 'phonetic-vowel' },
  { pattern: /ee/g, replacements: ['ea', 'ie', 'i'], confidence: 0.9, type: 'phonetic-vowel' },
  { pattern: /ie/g, replacements: ['ei', 'y', 'ee', 'i'], confidence: 0.9, type: 'phonetic-vowel' },
  { pattern: /ei/g, replacements: ['ie', 'ee', 'ay'], confidence: 0.9, type: 'phonetic-vowel' },
  { pattern: /ou/g, replacements: ['ow', 'o', 'oo'], confidence: 0.8, type: 'phonetic-vowel' },
  { pattern: /ow/g, replacements: ['ou', 'o'], confidence: 0.8, type: 'phonetic-vowel' },
  { pattern: /oo/g, replacements: ['u', 'ou', 'o'], confidence: 0.75, type: 'phonetic-vowel' },
  { pattern: /ai/g, replacements: ['ay', 'a', 'ei'], confidence: 0.8, type: 'phonetic-vowel' },
  { pattern: /ay/g, replacements: ['ai', 'a', 'ey'], confidence: 0.8, type: 'phonetic-vowel' },
  { pattern: /au/g, replacements: ['aw', 'o'], confidence: 0.75, type: 'phonetic-vowel' },
  { pattern: /aw/g, replacements: ['au', 'o'], confidence: 0.75, type: 'phonetic-vowel' },
  { pattern: /oi/g, replacements: ['oy'], confidence: 0.8, type: 'phonetic-vowel' },
  { pattern: /oy/g, replacements: ['oi'], confidence: 0.8, type: 'phonetic-vowel' },
  { pattern: /ue/g, replacements: ['oo', 'ew'], confidence: 0.7, type: 'phonetic-vowel' },
  { pattern: /ew/g, replacements: ['ue', 'oo'], confidence: 0.7, type: 'phonetic-vowel' },
];

// Согласные
const CONSONANT_RULES: PhoneticRule[] = [
  { pattern: /ph/g, replacements: ['f'], confidence: 0.95, type: 'phonetic-consonant' },
  { pattern: /gh$/g, replacements: ['f', ''], confidence: 0.85, type: 'phonetic-consonant' },
  { pattern: /ght/g, replacements: ['t', 'te'], confidence: 0.85, type: 'phonetic-consonant' },
  { pattern: /ck/g, replacements: ['k', 'c'], confidence: 0.8, type: 'phonetic-consonant' },
  { pattern: /wh/g, replacements: ['w'], confidence: 0.7, type: 'phonetic-consonant' },
  { pattern: /wr/g, replacements: ['r'], confidence: 0.8, type: 'phonetic-consonant' },
  { pattern: /kn/g, replacements: ['n'], confidence: 0.8, type: 'phonetic-consonant' },
  { pattern: /gn/g, replacements: ['n'], confidence: 0.75, type: 'phonetic-consonant' },
  { pattern: /mb$/g, replacements: ['m'], confidence: 0.85, type: 'phonetic-consonant' },
  { pattern: /sc(?=[ei])/g, replacements: ['s'], confidence: 0.7, type: 'phonetic-consonant' },
  { pattern: /x/g, replacements: ['ks', 'cks'], confidence: 0.75, type: 'phonetic-consonant' },
  { pattern: /tch/g, replacements: ['ch'], confidence: 0.8, type: 'phonetic-consonant' },
  { pattern: /dge/g, replacements: ['ge', 'j'], confidence: 0.8, type: 'phonetic-consonant' },
  { pattern: /c(?=[ei])/g, replacements: ['s'], confidence: 0.7, type: 'phonetic-consonant' },
  { pattern: /qu/g, replacements: ['kw', 'cw'], confidence: 0.7, type: 'phonetic-consonant' },
  { pattern: /gu(?=[ei])/g, replacements: ['g'], confidence: 0.65, type: 'phonetic-consonant' },
];

// Окончания
const ENDING_RULES: PhoneticRule[] = [
  { pattern: /tion$/g, replacements: ['shun', 'sion', 'cion'], confidence: 0.9, type: 'phonetic-ending' },
  { pattern: /sion$/g, replacements: ['tion', 'shun'], confidence: 0.85, type: 'phonetic-ending' },
  { pattern: /cian$/g, replacements: ['shan', 'sian'], confidence: 0.8, type: 'phonetic-ending' },
  { pattern: /ous$/g, replacements: ['us', 'ious'], confidence: 0.75, type: 'phonetic-ending' },
  { pattern: /ious$/g, replacements: ['ous', 'eus'], confidence: 0.75, type: 'phonetic-ending' },
  { pattern: /eous$/g, replacements: ['ous', 'ius'], confidence: 0.7, type: 'phonetic-ending' },
  { pattern: /ure$/g, replacements: ['ur', 'er'], confidence: 0.7, type: 'phonetic-ending' },
  { pattern: /ough$/g, replacements: ['uff', 'off', 'ow'], confidence: 0.8, type: 'phonetic-ending' },
  { pattern: /ould$/g, replacements: ['ood', 'ud'], confidence: 0.75, type: 'phonetic-ending' },
  { pattern: /ight$/g, replacements: ['ite', 'it'], confidence: 0.85, type: 'phonetic-ending' },
  { pattern: /ough/g, replacements: ['uf', 'o', 'ow'], confidence: 0.8, type: 'phonetic-ending' },
];

const ALL_RULES = [...VOWEL_RULES, ...CONSONANT_RULES, ...ENDING_RULES];

/**
 * Генератор фонетических опечаток
 * Заменяет звуковые паттерны на альтернативные написания
 * Примеры: team→teem, phone→fone, night→nite
 */
export class PhoneticGenerator implements TypoGenerator {
  readonly id = 'phonetic';
  readonly priority = 9;

  generate(ctx: TypoGeneratorContext): TypoResult[] {
    const { word } = ctx;
    const results: TypoResult[] = [];
    const seen = new Set<string>();

    for (const rule of ALL_RULES) {
      const matches = word.match(rule.pattern);
      if (!matches) continue;

      for (const replacement of rule.replacements) {
        // Заменяем первое вхождение
        const variant = word.replace(rule.pattern, replacement);
        if (variant === word || seen.has(variant)) continue;
        if (variant.length < 2) continue;

        seen.add(variant);
        results.push({
          variant,
          type: rule.type,
          confidence: rule.confidence,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
