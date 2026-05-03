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

import { sql, notInArray, isNull, or } from 'drizzle-orm';
import { wordMeanings } from './schema.js';

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

/** Drizzle-предикат для исключения функциональных слов. */
export const nonFunctionalDrizzleFilter = or(
  isNull(wordMeanings.translationPartOfSpeech),
  notInArray(wordMeanings.translationPartOfSpeech, [...FUNCTIONAL_POS]),
);

/**
 * SQL-фрагмент для использования в raw queries (sql template).
 * Префикс `wm` фиксирован — все потребители используют alias `wm` для
 * `word_meanings` в JOIN'ах.
 */
export const NON_FUNCTIONAL_SQL = sql`(wm.translation_part_of_speech IS NULL OR wm.translation_part_of_speech NOT IN (
  'preposition', 'conjunction', 'particle', 'interjection',
  'parenthetic', 'invariable', 'adverbial participle'
))`;
