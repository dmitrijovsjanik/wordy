export function countUniqueWords(words: { word: string }[]): number {
  return new Set(words.map((w) => w.word.toLowerCase())).size;
}
