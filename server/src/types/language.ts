export type LangCode = string;
export type LanguagePair = `${string}-${string}`;

export const DEFAULT_LANG_PAIR: LanguagePair = 'en-ru';

export function langPair(from: string, to: string): LanguagePair {
  return `${from}-${to}`;
}

export function reversePair(pair: LanguagePair): LanguagePair {
  const [from, to] = pair.split('-') as [string, string];
  return `${to}-${from}`;
}

export function sourceLang(pair: string): string {
  return pair.split('-')[0]!;
}

export function targetLang(pair: string): string {
  return pair.split('-')[1]!;
}
