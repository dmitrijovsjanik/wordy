/**
 * Фильтры слов и значений, которые исключаются из учебного потока.
 *
 * Функциональные части речи (предлоги, союзы, частицы, междометия и т.п.)
 * плохо подходят под формат «слово → перевод → пример»: их семантика
 * грамматическая, а не лексическая. Карточка вида «on = с» с примером
 * «I went there on foot» бессмысленна для запоминания.
 *
 * Категории берутся из `word_meanings.translation_part_of_speech`
 * (granular Yandex POS, в отличие от coarse `part_of_speech` enum'а).
 *
 * Местоимения (pronoun) НЕ исключаем: I/you/he/she — базовая лексика
 * с однозначными переводами, отлично работают как карточки.
 *
 * Применять везде, где формируется пул для учебного потока:
 *   - introduceUnseenMeaning (главная)
 *   - review-feed (обзор)
 *   - placement-test (онбординг)
 *   - demo-reset (демо-режим)
 *
 * НЕ применять в:
 *   - dictionary-service (полный словарь должен показывать всё)
 *   - existing collection contents (не ломать существующие коллекции)
 */

import { sql, notInArray, isNull, or, and } from 'drizzle-orm';
import { wordMeanings, words } from './schema.js';

/**
 * Категории translation_part_of_speech, которые исключаются из учебного
 * потока. NULL допустим (не все meanings размечены) — пропускаем их.
 */
export const FUNCTIONAL_POS = [
  'preposition',
  'conjunction',
  'particle',
  'interjection',
  'parenthetic',
  'invariable',
  'adverbial participle',
] as const;

/**
 * Английские слова, которые исключаются из учебного потока вне зависимости
 * от translation_part_of_speech их meanings.
 *
 * Зачем нужно:
 * Yandex API классифицирует POS по Русскому переводу, не по английскому
 * слову. Из-за этого `the` имеет meanings с POS='pronoun' (тот/этот/такой) —
 * pronoun-фильтр не сработает, т.к. мы намеренно оставили pronouns
 * (для I/you/he и т.п.). А `a` имеет meanings с POS='noun' (ля = нота A,
 * отлично = оценка), что вообще не функциональный POS.
 *
 * Учить «the=тот» как карточку бессмысленно — пользователь ожидает что
 * `the` это артикль. То же для `a`/`an`. Хардблок по английскому тексту
 * слова — единственный надёжный способ их исключить.
 *
 * Ограничиваюсь артиклями. Модальные/вспомогательные глаголы (be, have,
 * will, can и т.п.) полисемичны и спорны — оставляем.
 */
export const FUNCTIONAL_ENGLISH_WORDS = ['a', 'an', 'the'] as const;

/**
 * Drizzle-предикат для исключения функциональных слов.
 * Применяется на JOIN с `words` (или там, где `words` уже есть в FROM).
 */
export const nonFunctionalDrizzleFilter = and(
  or(
    isNull(wordMeanings.translationPartOfSpeech),
    notInArray(wordMeanings.translationPartOfSpeech, [...FUNCTIONAL_POS]),
  ),
  notInArray(words.text, [...FUNCTIONAL_ENGLISH_WORDS]),
);

/**
 * SQL-фрагмент для использования в raw queries (sql template).
 * Префикс `wm` фиксирован — все потребители используют alias `wm` для
 * `word_meanings` в JOIN'ах. `w` — alias для `words`.
 */
export const NON_FUNCTIONAL_SQL = sql`(
  (wm.translation_part_of_speech IS NULL OR wm.translation_part_of_speech NOT IN (
    'preposition', 'conjunction', 'particle', 'interjection',
    'parenthetic', 'invariable', 'adverbial participle'
  ))
  AND w.text NOT IN ('a', 'an', 'the')
)`;
