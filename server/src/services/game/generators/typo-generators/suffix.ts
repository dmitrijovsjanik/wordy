import type { TypoGenerator, TypoGeneratorContext, TypoResult } from './types.js';

// ─── Suffix Rules ────────────────────────────────────────────────────────────

type SuffixRule = {
  pattern: RegExp;
  replacements: string[];
  confidence: number;
};

const SUFFIX_RULES: SuffixRule[] = [
  // Распространённые ошибки в суффиксах
  { pattern: /ful$/, replacements: ['full'], confidence: 0.9 },
  { pattern: /full$/, replacements: ['ful'], confidence: 0.85 },
  { pattern: /ly$/, replacements: ['ley', 'lly', 'li'], confidence: 0.8 },
  { pattern: /lly$/, replacements: ['ly', 'ley'], confidence: 0.8 },
  { pattern: /ness$/, replacements: ['niss', 'nes'], confidence: 0.75 },
  { pattern: /ment$/, replacements: ['mant', 'mint'], confidence: 0.7 },

  // -able/-ible путаница
  { pattern: /able$/, replacements: ['ible', 'abel'], confidence: 0.8 },
  { pattern: /ible$/, replacements: ['able', 'ibel'], confidence: 0.8 },

  // -ance/-ence путаница
  { pattern: /ance$/, replacements: ['ence', 'anse'], confidence: 0.8 },
  { pattern: /ence$/, replacements: ['ance', 'ense'], confidence: 0.8 },
  { pattern: /ant$/, replacements: ['ent'], confidence: 0.75 },
  { pattern: /ent$/, replacements: ['ant'], confidence: 0.75 },

  // -ary/-ery путаница
  { pattern: /ary$/, replacements: ['ery', 'ery'], confidence: 0.75 },
  { pattern: /ery$/, replacements: ['ary', 'ary'], confidence: 0.75 },

  // -ing ошибки
  { pattern: /ing$/, replacements: ['ign', 'in', 'eng', 'ying'], confidence: 0.7 },

  // -tion/-sion
  { pattern: /tion$/, replacements: ['sion', 'cion', 'shun'], confidence: 0.8 },
  { pattern: /sion$/, replacements: ['tion', 'cion'], confidence: 0.8 },

  // -ous ошибки
  { pattern: /ous$/, replacements: ['us', 'ious', 'eous'], confidence: 0.75 },
  { pattern: /ious$/, replacements: ['ous', 'eous'], confidence: 0.75 },

  // -ise/-ize (британский/американский)
  { pattern: /ise$/, replacements: ['ize'], confidence: 0.7 },
  { pattern: /ize$/, replacements: ['ise'], confidence: 0.7 },

  // -er/-or путаница
  { pattern: /er$/, replacements: ['or', 'ar'], confidence: 0.65 },
  { pattern: /or$/, replacements: ['er', 'ar'], confidence: 0.65 },

  // -ity ошибки
  { pattern: /ity$/, replacements: ['ety', 'aty'], confidence: 0.7 },

  // -ally/-ely
  { pattern: /ally$/, replacements: ['aly', 'elly'], confidence: 0.75 },
  { pattern: /ely$/, replacements: ['ley', 'ly'], confidence: 0.7 },

  // -ary/-ery/-ory
  { pattern: /ory$/, replacements: ['ary', 'ery'], confidence: 0.7 },

  // -ately/-itely (definitely→definately)
  { pattern: /itely$/, replacements: ['ately', 'atly'], confidence: 0.85 },
  { pattern: /ately$/, replacements: ['itely', 'atly'], confidence: 0.85 },

  // -ceed/-cede/-sede
  { pattern: /ceed$/, replacements: ['cede', 'sede'], confidence: 0.8 },
  { pattern: /cede$/, replacements: ['ceed', 'sede'], confidence: 0.8 },
];

/**
 * Генератор опечаток в суффиксах
 * Примеры: beautiful→beautifull, definitely→definately
 */
export class SuffixGenerator implements TypoGenerator {
  readonly id = 'suffix';
  readonly priority = 7;

  generate(ctx: TypoGeneratorContext): TypoResult[] {
    const { word } = ctx;
    const results: TypoResult[] = [];
    const seen = new Set<string>();

    for (const rule of SUFFIX_RULES) {
      if (!rule.pattern.test(word)) continue;

      for (const replacement of rule.replacements) {
        const variant = word.replace(rule.pattern, replacement);
        if (variant === word || seen.has(variant)) continue;
        if (variant.length < 2) continue;

        seen.add(variant);
        results.push({
          variant,
          type: 'suffix',
          confidence: rule.confidence,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
