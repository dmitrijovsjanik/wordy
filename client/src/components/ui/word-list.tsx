import { WordItem } from '@/components/ui/word-item';
import { WordBadge } from '@/components/ui/word-badge';
import { useWordViewStore } from '@/stores/word-view-store';

type WordEntry = {
  word: string;
  translation: string;
};

type GroupedWord = {
  word: string;
  translations: string[];
};

type WordListProps = {
  words: WordEntry[];
};

function groupWords(words: WordEntry[]): GroupedWord[] {
  // Группируем по word (en-ru: "train" → [поезд, тренировать])
  // и по translation (ru-en: "привет" ← [hi, hello, hey])
  const byWord = new Map<string, Set<string>>();
  const byTranslation = new Map<string, Set<string>>();

  for (const w of words) {
    if (!byWord.has(w.word)) byWord.set(w.word, new Set());
    byWord.get(w.word)!.add(w.translation);

    if (!byTranslation.has(w.translation)) byTranslation.set(w.translation, new Set());
    byTranslation.get(w.translation)!.add(w.word);
  }

  const result: GroupedWord[] = [];
  const seen = new Set<string>();

  for (const w of words) {
    const key = `${w.word}::${w.translation}`;
    if (seen.has(key)) continue;

    const sameWord = byWord.get(w.word)!;
    const sameTranslation = byTranslation.get(w.translation)!;

    if (sameWord.size > 1) {
      // en-ru: одно англ. слово → несколько переводов
      const wordKey = `w::${w.word}`;
      if (!seen.has(wordKey)) {
        seen.add(wordKey);
        for (const t of sameWord) seen.add(`${w.word}::${t}`);
        result.push({ word: w.word, translations: [...sameWord] });
      }
    } else if (sameTranslation.size > 1) {
      // ru-en: один перевод ← несколько англ. слов
      const transKey = `t::${w.translation}`;
      if (!seen.has(transKey)) {
        seen.add(transKey);
        for (const wd of sameTranslation) seen.add(`${wd}::${w.translation}`);
        result.push({ word: [...sameTranslation].join(', '), translations: [w.translation] });
      }
    } else {
      seen.add(key);
      result.push({ word: w.word, translations: [w.translation] });
    }
  }

  return result;
}

export function WordList({ words }: WordListProps) {
  const viewMode = useWordViewStore((s) => s.viewMode);
  const grouped = groupWords(words);

  if (viewMode === 'badges') {
    return (
      <div className="flex flex-wrap gap-2">
        {grouped.map((g) => (
          <WordBadge key={g.word} word={g.word} translations={g.translations} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {grouped.map((g) => (
        <WordItem key={g.word} word={g.word} translations={g.translations} />
      ))}
    </div>
  );
}
