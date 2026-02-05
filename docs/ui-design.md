# UX/UI Design & Styling

**This is a mobile-only app.** It runs inside Telegram's WebView on phones. No desktop layout, no responsive breakpoints — design for 360-412px width screens.

## Mobile Design Rules
- **Touch targets**: minimum main action element size 48×48pt. Spacing between main tappable elements — 8px< minimum 4px.
- **Thumb zone**: primary actions (CTA, navigation) in the lower half of the screen where thumbs reach naturally
- **One primary action per screen** — reduce cognitive load, don't overwhelm with options
- **Bottom navigation** over top navigation — easier to reach, standard mobile pattern
- **No hover states** — there is no cursor on mobile. Focus on `:active` and `:focus-visible` states
- **Swipe gestures**: natural for cards, lists, dismissals. Use sparingly and always provide a tap alternative
- **Loading states**: skeleton screens over spinners. Never show a blank screen
- **Pull-to-refresh** where contextually appropriate (leaderboards, feed)
- **Safe areas**: respect `env(safe-area-inset-*)` for notches and system UI

## Gestalt Principles (apply in every screen)
- **Proximity**: group related elements close together, separate unrelated groups with whitespace. No explicit borders needed when spacing is clear
- **Similarity**: consistent visual treatment for same-type elements — all buttons look like buttons, all cards look like cards. Same color = same function
- **Continuity**: guide the eye in a natural reading flow (top→bottom, left→right). Align elements to a grid
- **Figure-Ground**: use elevation (shadows, overlays) to separate layers — modals float above content, cards above background
- **Common Region**: group related content inside cards/containers. A card = one logical unit

## Content & Microcopy
- Short, clear labels on buttons — verbs: "Начать", "Проверить", "Далее"
- Error messages explain what happened AND what to do: "Не удалось загрузить. Попробуйте ещё раз"
- Empty states: illustration + explanation + CTA ("Пока нет результатов. Начните первый квиз!")
- Success feedback: haptic + visual (animation/color change), not just text

## Telegram-Specific UX
- Use `MainButton` for primary screen action — it's native and always accessible
- Use `BackButton` instead of custom back navigation
- Respect `themeParams` — don't fight Telegram's color scheme
- Haptic feedback (`HapticFeedback.impactOccurred`) on key interactions: correct answer, level up, button press
- App should feel like part of Telegram, not a foreign webpage

---

## UI Components & Styling

### shadcn/ui
Components live in `client/src/components/ui/`. Copy-pasted, fully owned. Customized with CSS variables, NOT Tailwind utility overrides.

### Radix Colors (12-step semantic scale)

Вся коммуникация по цветам — через номера шагов: "accent-9 для кнопки", "gray-11 для подписи". Не hex-коды. Это рекомендации — отходить по запросу.

**12 шагов:**

| Step | Назначение | Пример |
|------|-----------|--------|
| 1 | App background | Фон страницы |
| 2 | Subtle background | Фон карточки, секции |
| 3 | UI element background | Фон кнопки (ghost), инпута |
| 4 | Hovered element bg | Hover step 3 |
| 5 | Active/Selected element bg | Pressed/selected |
| 6 | Subtle border | Разделители |
| 7 | Element border | Границы инпутов, focus ring |
| 8 | Hovered border | Hover step 7 |
| 9 | Solid background | Цвет кнопок, бейджей, акцентов |
| 10 | Hovered solid bg | Hover step 9 |
| 11 | Low-contrast text | Подписи, placeholder, вторичный текст |
| 12 | High-contrast text | Заголовки, основной текст |

**Композиция палитры:**
- **Accent** (бренд): выбрать из Radix scales (`iris`, `blue`, `violet` и др.)
- **Neutral**: `gray` или тонированный (`slate`, `mauve`) — подбирать в пару к accent
- **Semantic**: `red`/`tomato` = ошибка, `green`/`jade` = успех, `amber` = предупреждение, `blue` = информация

```css
/* CSS-переменные */
--color-bg: var(--gray-1);
--color-bg-subtle: var(--gray-2);
--color-bg-element: var(--gray-3);
--color-bg-hover: var(--gray-4);
--color-bg-active: var(--gray-5);
--color-border: var(--gray-6);
--color-border-strong: var(--gray-7);
--color-solid: var(--accent-9);
--color-solid-hover: var(--accent-10);
--color-text-secondary: var(--gray-11);
--color-text: var(--gray-12);
```

### Hugeicons
```tsx
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen02Icon } from '@hugeicons/core-free-icons';

<HugeiconsIcon icon={BookOpen02Icon} size={20} />
```

**IMPORTANT**: Only use icons from `@hugeicons/core-free-icons` (free collection).
