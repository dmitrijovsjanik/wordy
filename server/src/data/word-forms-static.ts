/**
 * Статические таблицы форм для слов, которые `compromise` не обрабатывает
 * корректно (модальные глаголы, вспомогательные глаголы) или для которых
 * семантически удобнее задать формы вручную (личные местоимения, артикли).
 *
 * Используется в word-forms-service: STATIC_FORMS перекрывает результаты NLP.
 */
import type { WordForms } from '../services/word-forms-service.js';

// ─── Модальные и вспомогательные глаголы ────────────────────────────────────
// compromise ломает их: `can → canned`, `would → woulded`, и т.д.
export const MODAL_AND_AUX_FORMS: Record<string, WordForms> = {
  be: {
    base: 'be',
    partOfSpeech: 'verb',
    forms: [
      { text: 'be', label: 'инфинитив' },
      { text: 'am', label: '1 лицо ед.ч., наст.' },
      { text: 'is', label: '3 лицо ед.ч., наст.' },
      { text: 'are', label: 'мн.ч. / 2 лицо, наст.' },
      { text: 'was', label: '1/3 лицо ед.ч., прош.' },
      { text: 'were', label: 'мн.ч. / 2 лицо, прош.' },
      { text: 'being', label: 'герундий / Continuous' },
      { text: 'been', label: 'причастие прошедшее' },
    ],
  },
  have: {
    base: 'have',
    partOfSpeech: 'verb',
    forms: [
      { text: 'have', label: 'инфинитив / 1-2 лицо, наст.' },
      { text: 'has', label: '3 лицо ед.ч., наст.' },
      { text: 'had', label: 'прошедшее / Perfect' },
      { text: 'having', label: 'герундий' },
    ],
  },
  do: {
    base: 'do',
    partOfSpeech: 'verb',
    forms: [
      { text: 'do', label: 'инфинитив / 1-2 лицо, наст.' },
      { text: 'does', label: '3 лицо ед.ч., наст.' },
      { text: 'did', label: 'прошедшее' },
      { text: 'doing', label: 'герундий' },
      { text: 'done', label: 'причастие прошедшее' },
    ],
  },
  will: {
    base: 'will',
    partOfSpeech: 'modal',
    forms: [
      { text: 'will', label: 'будущее / модальный' },
      { text: 'would', label: 'сослагательное / прошедшая форма' },
      { text: "won't", label: 'отрицание (will not)' },
      { text: "wouldn't", label: 'отрицание (would not)' },
    ],
  },
  shall: {
    base: 'shall',
    partOfSpeech: 'modal',
    forms: [
      { text: 'shall', label: 'модальный (предложение)' },
      { text: 'should', label: 'сослагательное (рекомендация)' },
      { text: "shouldn't", label: 'отрицание (should not)' },
    ],
  },
  can: {
    base: 'can',
    partOfSpeech: 'modal',
    forms: [
      { text: 'can', label: 'модальный (возможность)' },
      { text: 'could', label: 'прошедшая форма / вежливый' },
      { text: "can't", label: 'отрицание (cannot)' },
      { text: 'cannot', label: 'отрицание' },
      { text: "couldn't", label: 'отрицание (could not)' },
    ],
  },
  may: {
    base: 'may',
    partOfSpeech: 'modal',
    forms: [
      { text: 'may', label: 'модальный (разрешение/возможность)' },
      { text: 'might', label: 'прошедшая форма / меньшая вероятность' },
    ],
  },
  must: {
    base: 'must',
    partOfSpeech: 'modal',
    forms: [
      { text: 'must', label: 'модальный (долженствование)' },
      { text: "mustn't", label: 'отрицание (must not)' },
    ],
  },
  ought: {
    base: 'ought',
    partOfSpeech: 'modal',
    forms: [
      { text: 'ought', label: 'модальный (долженствование, реком.)' },
    ],
  },
  // «could», «would», «should», «might» как самостоятельные lemmas (для
  // случая, когда слово в карточке = could/would/...) — указываем через
  // лемму will/can/shall/may. Покрываем алиасы:
  could: {
    base: 'can',
    partOfSpeech: 'modal',
    forms: [
      { text: 'can', label: 'настоящее / основная форма' },
      { text: 'could', label: 'прошедшая форма / вежливый' },
    ],
  },
  would: {
    base: 'will',
    partOfSpeech: 'modal',
    forms: [
      { text: 'will', label: 'будущее / основная форма' },
      { text: 'would', label: 'сослагательное / прошедшая форма' },
    ],
  },
  should: {
    base: 'shall',
    partOfSpeech: 'modal',
    forms: [
      { text: 'shall', label: 'модальный (предложение)' },
      { text: 'should', label: 'сослагательное (рекомендация)' },
    ],
  },
  might: {
    base: 'may',
    partOfSpeech: 'modal',
    forms: [
      { text: 'may', label: 'модальный (разрешение/возможность)' },
      { text: 'might', label: 'прошедшая форма / меньшая вероятность' },
    ],
  },
};

// ─── Личные и притяжательные местоимения ────────────────────────────────────
// `compromise` не выдаёт связанные формы для них.
export const PRONOUN_FORMS: Record<string, WordForms> = {
  i: {
    base: 'i',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'I', label: 'именительный (я)' },
      { text: 'me', label: 'объектный (мне/меня)' },
      { text: 'my', label: 'притяжательный (мой)' },
      { text: 'mine', label: 'абсолютный (мой собств.)' },
      { text: 'myself', label: 'возвратный (себя)' },
    ],
  },
  you: {
    base: 'you',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'you', label: 'именительный/объектный' },
      { text: 'your', label: 'притяжательный' },
      { text: 'yours', label: 'абсолютный' },
      { text: 'yourself', label: 'возвратный (ед.ч.)' },
      { text: 'yourselves', label: 'возвратный (мн.ч.)' },
    ],
  },
  he: {
    base: 'he',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'he', label: 'именительный (он)' },
      { text: 'him', label: 'объектный (его/ему)' },
      { text: 'his', label: 'притяжательный/абсолютный' },
      { text: 'himself', label: 'возвратный (себя)' },
    ],
  },
  she: {
    base: 'she',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'she', label: 'именительный (она)' },
      { text: 'her', label: 'объектный/притяжательный' },
      { text: 'hers', label: 'абсолютный' },
      { text: 'herself', label: 'возвратный (себя)' },
    ],
  },
  it: {
    base: 'it',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'it', label: 'именительный/объектный' },
      { text: 'its', label: 'притяжательный' },
      { text: 'itself', label: 'возвратный' },
    ],
  },
  we: {
    base: 'we',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'we', label: 'именительный (мы)' },
      { text: 'us', label: 'объектный (нам/нас)' },
      { text: 'our', label: 'притяжательный' },
      { text: 'ours', label: 'абсолютный' },
      { text: 'ourselves', label: 'возвратный' },
    ],
  },
  they: {
    base: 'they',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'they', label: 'именительный (они)' },
      { text: 'them', label: 'объектный (им/их)' },
      { text: 'their', label: 'притяжательный' },
      { text: 'theirs', label: 'абсолютный' },
      { text: 'themselves', label: 'возвратный' },
    ],
  },
  // Объектные/притяжательные как самостоятельные lemmas — алиасы.
  me: {
    base: 'i',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'I', label: 'именительный (я)' },
      { text: 'me', label: 'объектный' },
      { text: 'my', label: 'притяжательный' },
    ],
  },
  him: {
    base: 'he',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'he', label: 'именительный' },
      { text: 'him', label: 'объектный' },
      { text: 'his', label: 'притяжательный' },
    ],
  },
  her: {
    base: 'she',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'she', label: 'именительный' },
      { text: 'her', label: 'объектный/притяжательный' },
    ],
  },
  us: {
    base: 'we',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'we', label: 'именительный' },
      { text: 'us', label: 'объектный' },
      { text: 'our', label: 'притяжательный' },
    ],
  },
  them: {
    base: 'they',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'they', label: 'именительный' },
      { text: 'them', label: 'объектный' },
      { text: 'their', label: 'притяжательный' },
    ],
  },
  my: {
    base: 'i',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'I', label: 'именительный' },
      { text: 'me', label: 'объектный' },
      { text: 'my', label: 'притяжательный' },
    ],
  },
  your: {
    base: 'you',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'you', label: 'именительный/объектный' },
      { text: 'your', label: 'притяжательный' },
    ],
  },
  his: {
    base: 'he',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'he', label: 'именительный' },
      { text: 'him', label: 'объектный' },
      { text: 'his', label: 'притяжательный' },
    ],
  },
  its: {
    base: 'it',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'it', label: 'именительный/объектный' },
      { text: 'its', label: 'притяжательный' },
    ],
  },
  our: {
    base: 'we',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'we', label: 'именительный' },
      { text: 'us', label: 'объектный' },
      { text: 'our', label: 'притяжательный' },
    ],
  },
  their: {
    base: 'they',
    partOfSpeech: 'pronoun',
    forms: [
      { text: 'they', label: 'именительный' },
      { text: 'them', label: 'объектный' },
      { text: 'their', label: 'притяжательный' },
    ],
  },
};

// ─── Артикли ────────────────────────────────────────────────────────────────
export const ARTICLE_FORMS: Record<string, WordForms> = {
  a: {
    base: 'a',
    partOfSpeech: 'other',
    forms: [
      { text: 'a', label: 'неопр. артикль (перед согласной)' },
      { text: 'an', label: 'неопр. артикль (перед гласной)' },
    ],
  },
  an: {
    base: 'a',
    partOfSpeech: 'other',
    forms: [
      { text: 'a', label: 'неопр. артикль (перед согласной)' },
      { text: 'an', label: 'неопр. артикль (перед гласной)' },
    ],
  },
  the: {
    base: 'the',
    partOfSpeech: 'other',
    forms: [{ text: 'the', label: 'определённый артикль' }],
  },
};

// ─── Объединяющий resolver ──────────────────────────────────────────────────
export function getStaticForms(word: string): WordForms | null {
  const key = word.toLowerCase();
  return MODAL_AND_AUX_FORMS[key] ?? PRONOUN_FORMS[key] ?? ARTICLE_FORMS[key] ?? null;
}
