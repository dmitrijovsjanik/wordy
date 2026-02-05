import { useMemo } from 'react';
import { WordItem } from '@/components/ui/word-item';
import { WordBadge } from '@/components/ui/word-badge';
import { useWordViewStore } from '@/stores/word-view-store';

type WordEntry = {
  id?: number;
  word: string;
  lemma?: string;
  transcription?: string;
  translation: string;
  alternativeTranslations?: string[];
  partOfSpeech?: string;
  contextExample?: string;
  srsStage?: number;
  popularityRank?: number;
};

type GroupedWord = {
  ids: number[];
  word: string;
  lemma?: string;
  transcription?: string;
  translations: string[];
  alternativeTranslations: string[];
  partOfSpeech?: string;
  contextExample?: string;
  srsStage: number;
  popularityRank?: number;
};

type WordListProps = {
  words: WordEntry[];
  onDeleteWords?: (wordIds: number[]) => Promise<void>;
};

export function countUniqueWords(words: { word: string }[]): number {
  return new Set(words.map((w) => w.word.toLowerCase())).size;
}

function groupWords(words: WordEntry[]): GroupedWord[] {
  // 1. Собираем переводы для каждого слова
  const byWord = new Map<string, Set<string>>();
  const idsByWord = new Map<string, number[]>();
  const altsByWord = new Map<string, Set<string>>();
  const stageByPair = new Map<string, number>();
  const metaByWord = new Map<string, { partOfSpeech?: string; contextExample?: string; popularityRank?: number; lemma?: string; transcription?: string }>();

  for (const w of words) {
    if (!byWord.has(w.word)) byWord.set(w.word, new Set());
    byWord.get(w.word)!.add(w.translation);

    if (!idsByWord.has(w.word)) idsByWord.set(w.word, []);
    if (w.id !== undefined) idsByWord.get(w.word)!.push(w.id);

    const key = `${w.word}::${w.translation}`;
    stageByPair.set(key, Math.max(stageByPair.get(key) ?? 0, w.srsStage ?? 0));

    if (!metaByWord.has(w.word)) {
      metaByWord.set(w.word, {
        partOfSpeech: w.partOfSpeech,
        contextExample: w.contextExample,
        popularityRank: w.popularityRank,
        lemma: w.lemma,
        transcription: w.transcription,
      });
    }

    if (w.alternativeTranslations) {
      if (!altsByWord.has(w.word)) altsByWord.set(w.word, new Set());
      for (const alt of w.alternativeTranslations) {
        altsByWord.get(w.word)!.add(alt);
      }
    }
  }

  // 2. Группируем слова с одинаковым набором переводов
  const byTranslationSet = new Map<string, { words: Set<string>; translations: string[] }>();

  for (const [word, translations] of byWord) {
    const sorted = [...translations].sort();
    const tKey = sorted.join('\0');
    if (!byTranslationSet.has(tKey)) {
      byTranslationSet.set(tKey, { words: new Set(), translations: sorted });
    }
    byTranslationSet.get(tKey)!.words.add(word);
  }

  // 3. Собираем результат, сохраняя порядок первого появления
  const result: GroupedWord[] = [];
  const seenWords = new Set<string>();

  for (const w of words) {
    if (seenWords.has(w.word)) continue;

    const translations = byWord.get(w.word)!;
    const sorted = [...translations].sort();
    const tKey = sorted.join('\0');
    const group = byTranslationSet.get(tKey)!;

    for (const gw of group.words) seenWords.add(gw);

    let maxStage = 0;
    let minPopularity: number | undefined;
    const allIds: number[] = [];
    for (const gw of group.words) {
      allIds.push(...(idsByWord.get(gw) ?? []));
      for (const t of group.translations) {
        maxStage = Math.max(maxStage, stageByPair.get(`${gw}::${t}`) ?? 0);
      }
      const meta = metaByWord.get(gw);
      if (meta?.popularityRank !== undefined) {
        minPopularity = minPopularity === undefined
          ? meta.popularityRank
          : Math.min(minPopularity, meta.popularityRank);
      }
    }

    const alts: Set<string> = new Set();
    for (const gw of group.words) {
      const wordAlts = altsByWord.get(gw);
      if (wordAlts) {
        for (const alt of wordAlts) alts.add(alt);
      }
    }

    const meta = metaByWord.get(w.word);

    result.push({
      ids: allIds,
      word: [...group.words].join(', '),
      lemma: meta?.lemma,
      transcription: meta?.transcription,
      translations: group.translations,
      alternativeTranslations: [...alts],
      partOfSpeech: meta?.partOfSpeech,
      contextExample: meta?.contextExample,
      srsStage: maxStage,
      popularityRank: minPopularity,
    });
  }

  return result;
}

function sortWords(words: GroupedWord[], sortMode: string): GroupedWord[] {
  const sorted = [...words];
  switch (sortMode) {
    case 'alphabetical':
      sorted.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
      break;
    case 'progress':
      // Сначала неизученные (srsStage 0), потом в процессе, потом выученные
      sorted.sort((a, b) => a.srsStage - b.srsStage);
      break;
    case 'popularity':
    default:
      // Чем меньше rank — тем популярнее слово (1 = самое популярное)
      // Слова без rank идут в конец
      sorted.sort((a, b) => {
        const aRank = a.popularityRank ?? Infinity;
        const bRank = b.popularityRank ?? Infinity;
        return aRank - bRank;
      });
      break;
  }
  return sorted;
}

export function WordList({ words, onDeleteWords }: WordListProps) {
  const viewMode = useWordViewStore((s) => s.viewMode);
  const sortMode = useWordViewStore((s) => s.sortMode);

  const grouped = useMemo(() => groupWords(words), [words]);
  const sorted = useMemo(() => sortWords(grouped, sortMode), [grouped, sortMode]);

  if (viewMode === 'badges') {
    return (
      <div className="flex flex-wrap gap-2">
        {sorted.map((g) => (
          <WordBadge key={g.word} word={g.word} translations={g.translations} alternativeTranslations={g.alternativeTranslations} srsStage={g.srsStage} />
        ))}
      </div>
    );
  }

  // Простой рендер без виртуализации — страница сама скроллится
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((g) => (
        <WordItem
          key={g.word}
          word={g.word}
          lemma={g.lemma}
          transcription={g.transcription}
          translations={g.translations}
          alternativeTranslations={g.alternativeTranslations}
          partOfSpeech={g.partOfSpeech}
          contextExample={g.contextExample}
          srsStage={g.srsStage}
          onDelete={onDeleteWords ? () => onDeleteWords(g.ids) : undefined}
        />
      ))}
    </div>
  );
}
