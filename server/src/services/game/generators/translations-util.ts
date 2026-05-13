/**
 * Shared utility, оставленная после архивирования legacy quiz-generators.
 * Используется в free-recall.ts для построения acceptableAnswers.
 */
export function getAllTranslations(
  meaning: { translation: string; alternativeTranslations: string[] | null },
): string[] {
  return [meaning.translation, ...(meaning.alternativeTranslations ?? [])];
}
