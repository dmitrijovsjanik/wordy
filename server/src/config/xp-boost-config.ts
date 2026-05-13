/**
 * XP Boost Configuration
 *
 * Покупной буст XP и премиум-бонус XP.
 * Складываются аддитивно: base(100) + premium(50) + boost(50) = 200 = x2.
 */

/** Бонус покупного буста в пунктах поверх базы (+50% = x1.5) */
export const XP_BOOST_MULTIPLIER = 50;

/** Длительность буста в мс (24 часа) */
export const XP_BOOST_DURATION_MS = 24 * 60 * 60 * 1000;

/** Цена буста в гемах */
export const XP_BOOST_GEM_COST = 350;

/** Бонус Premium к XP в пунктах (+50% = x1.5) */
export const PREMIUM_XP_BONUS = 50;
