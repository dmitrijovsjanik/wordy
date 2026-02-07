import { useMemo, useState, useCallback } from 'react';
import { WordItem } from '@/components/ui/word-item';
import { WordBadge } from '@/components/ui/word-badge';
import { WordDetailModal } from '@/components/ui/word-detail-modal';
import { useWordViewStore } from '@/stores/word-view-store';
import type { CollectionWord } from '@/types/api';

type WordEntry = {
  id?: number;
  word: string;
  lemma?: string;
  transcription?: string;
  translation: string;
  alternativeTranslations?: string[];
  partOfSpeech?: string;
  contextExample?: string;
  examples?: { text: string; translation: string }[];
  synonyms?: string[];
  meaningHints?: string[];
  frequency?: number;
  srsStage?: number | null; // 0-3 learning progress, null = не встречалось
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
  examples?: { text: string; translation: string }[];
  synonyms?: string[];
  meaningHints?: string[];
  frequency?: number;
  progress: number; // 0.0-1.0, агрегированный прогресс по всем meanings
  popularityRank?: number;
};

type WordListProps = {
  words: WordEntry[];
  onDeleteWords?: (wordIds: number[]) => Promise<void>;
};

function groupWords(words: WordEntry[]): GroupedWord[] {
  // 1. Собираем переводы для каждого слова
  const byWord = new Map<string, Set<string>>();
  const idsByWord = new Map<string, number[]>();
  const altsByWord = new Map<string, Set<string>>();
  const stageByPair = new Map<string, number>(); // srsStage per meaning (0-3)
  const metaByWord = new Map<string, {
    partOfSpeech?: string;
    contextExample?: string;
    popularityRank?: number;
    lemma?: string;
    transcription?: string;
    examples?: { text: string; translation: string }[];
    synonyms?: string[];
    meaningHints?: string[];
    frequency?: number;
  }>();

  // Порядок переводов по появлению (= порядок популярности из API)
  const translationOrder = new Map<string, string[]>();

  for (const w of words) {
    if (!byWord.has(w.word)) byWord.set(w.word, new Set());
    if (!byWord.get(w.word)!.has(w.translation)) {
      if (!translationOrder.has(w.word)) translationOrder.set(w.word, []);
      translationOrder.get(w.word)!.push(w.translation);
    }
    byWord.get(w.word)!.add(w.translation);

    if (!idsByWord.has(w.word)) idsByWord.set(w.word, []);
    if (w.id !== undefined) idsByWord.get(w.word)!.push(w.id);

    const key = `${w.word}::${w.translation}`;
    const stage = Math.min(Math.max(w.srsStage ?? 0, 0), 3); // clamp to 0-3
    if (!stageByPair.has(key)) {
      stageByPair.set(key, stage);
    } else {
      stageByPair.set(key, Math.min(stageByPair.get(key)!, stage));
    }

    if (!metaByWord.has(w.word)) {
      metaByWord.set(w.word, {
        partOfSpeech: w.partOfSpeech,
        contextExample: w.contextExample,
        popularityRank: w.popularityRank,
        lemma: w.lemma,
        transcription: w.transcription,
        examples: w.examples,
        synonyms: w.synonyms,
        meaningHints: w.meaningHints,
        frequency: w.frequency,
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
    // Ключ — алфавитный (для стабильной группировки), порядок — из API (по популярности)
    const tKey = [...translations].sort().join('\0');
    if (!byTranslationSet.has(tKey)) {
      byTranslationSet.set(tKey, { words: new Set(), translations: translationOrder.get(word) ?? [...translations] });
    }
    byTranslationSet.get(tKey)!.words.add(word);
  }

  // 3. Собираем результат, сохраняя порядок первого появления
  const result: GroupedWord[] = [];
  const seenWords = new Set<string>();

  for (const w of words) {
    if (seenWords.has(w.word)) continue;

    const translations = byWord.get(w.word)!;
    const tKey = [...translations].sort().join('\0');
    const group = byTranslationSet.get(tKey)!;

    for (const gw of group.words) seenWords.add(gw);

    let stageSum = 0;
    let meaningCount = 0;
    let minPopularity: number | undefined;
    const allIds: number[] = [];
    for (const gw of group.words) {
      allIds.push(...(idsByWord.get(gw) ?? []));
      for (const t of group.translations) {
        const stage = stageByPair.get(`${gw}::${t}`) ?? 0;
        stageSum += stage;
        meaningCount++;
      }
      const meta = metaByWord.get(gw);
      if (meta?.popularityRank !== undefined) {
        minPopularity = minPopularity === undefined
          ? meta.popularityRank
          : Math.min(minPopularity, meta.popularityRank);
      }
    }
    const progress = meaningCount > 0 ? stageSum / (meaningCount * 3) : 0;

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
      examples: meta?.examples,
      synonyms: meta?.synonyms,
      meaningHints: meta?.meaningHints,
      frequency: meta?.frequency,
      progress,
      popularityRank: minPopularity,
    });
  }

  return result;
}

// Сортировка по прогрессу: больше прогресс → выше в списке
function getSortWeight(progress: number): number {
  return -progress; // 1.0 → -1.0 (вверху), 0.0 → 0 (внизу)
}

function sortWords(words: GroupedWord[], sortMode: string): GroupedWord[] {
  const sorted = [...words];
  switch (sortMode) {
    case 'alphabetical':
      sorted.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
      break;
    case 'progress':
      sorted.sort((a, b) => getSortWeight(a.progress) - getSortWeight(b.progress));
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

// Конвертируем GroupedWord в CollectionWord для модалки
function toCollectionWord(g: GroupedWord): CollectionWord {
  return {
    id: g.ids[0] ?? 0,
    word: g.word,
    lemma: g.lemma,
    transcription: g.transcription,
    translation: g.translations[0] ?? '',
    alternativeTranslations: g.translations.length > 1
      ? [...g.translations.slice(1), ...g.alternativeTranslations]
      : g.alternativeTranslations,
    partOfSpeech: g.partOfSpeech ?? 'noun',
    contextExample: g.contextExample,
    examples: g.examples,
    synonyms: g.synonyms,
    meaningHints: g.meaningHints,
    frequency: g.frequency,
    srsStage: null, // progress используется вместо srsStage для отображения
    popularityRank: g.popularityRank,
  };
}

export function WordList({ words, onDeleteWords }: WordListProps) {
  const viewMode = useWordViewStore((s) => s.viewMode);
  const sortMode = useWordViewStore((s) => s.sortMode);
  const [selectedWord, setSelectedWord] = useState<CollectionWord | null>(null);

  const grouped = useMemo(() => groupWords(words), [words]);
  const sorted = useMemo(() => sortWords(grouped, sortMode), [grouped, sortMode]);

  const handleWordClick = useCallback((g: GroupedWord) => {
    setSelectedWord(toCollectionWord(g));
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedWord(null);
  }, []);

  const handleDeleteFromModal = useCallback(async () => {
    if (!selectedWord || !onDeleteWords) return;
    // Находим группу по слову и удаляем все связанные ids
    const group = sorted.find((g) => g.word === selectedWord.word);
    if (group) {
      await onDeleteWords(group.ids);
    }
  }, [selectedWord, onDeleteWords, sorted]);

  if (viewMode === 'badges') {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {sorted.map((g) => (
            <WordBadge
              key={g.word}
              word={g.word}
              translations={g.translations}
              alternativeTranslations={g.alternativeTranslations}
              progress={g.progress}
              onClick={() => handleWordClick(g)}
            />
          ))}
        </div>
        <WordDetailModal
          word={selectedWord}
          isOpen={selectedWord !== null}
          onClose={handleCloseModal}
          onDelete={onDeleteWords ? handleDeleteFromModal : undefined}
          canDelete={!!onDeleteWords}
        />
      </>
    );
  }

  // Простой рендер без виртуализации — страница сама скроллится
  return (
    <>
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
            progress={g.progress}
            onDelete={onDeleteWords ? () => onDeleteWords(g.ids) : undefined}
            onClick={() => handleWordClick(g)}
          />
        ))}
      </div>
      <WordDetailModal
        word={selectedWord}
        isOpen={selectedWord !== null}
        onClose={handleCloseModal}
        onDelete={onDeleteWords ? handleDeleteFromModal : undefined}
        canDelete={!!onDeleteWords}
      />
    </>
  );
}
