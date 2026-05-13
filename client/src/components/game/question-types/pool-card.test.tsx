import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PoolCard } from './pool-card';
import type { PoolCardApiQuestion } from '@/types/api';

function makeQ(): PoolCardApiQuestion {
  return {
    type: 'pool-card',
    wordId: 1,
    meaningId: 100,
    word: 'house',
    transcription: 'haʊs',
    partOfSpeech: 'noun',
    meanings: [
      { meaningId: 100, translation: 'дом', example: { en: 'My house', ru: 'Мой дом' }, partOfSpeech: 'noun' },
      { meaningId: 101, translation: 'жилище', example: null, partOfSpeech: 'noun' },
    ],
    example: { en: 'My house', ru: 'Мой дом' },
  };
}

describe('PoolCard', () => {
  it('рендерит слово, транскрипцию, все переводы', () => {
    render(<PoolCard question={makeQ()} onSwipe={vi.fn()} />);
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByText(/haʊs/)).toBeInTheDocument();
    // LearningCard рендерит meanings дважды (visible + offscreen-измеритель),
    // поэтому используем getAllByText.
    expect(screen.getAllByText('дом').length).toBeGreaterThan(0);
    expect(screen.getAllByText('жилище').length).toBeGreaterThan(0);
  });

  it('клик «Изучаю» → onSwipe(learn)', async () => {
    const onSwipe = vi.fn();
    render(<PoolCard question={makeQ()} onSwipe={onSwipe} />);
    await userEvent.click(screen.getByRole('button', { name: 'Изучаю' }));
    expect(onSwipe).toHaveBeenCalledWith('learn');
  });

  it('клик «Знаю» → onSwipe(know)', async () => {
    const onSwipe = vi.fn();
    render(<PoolCard question={makeQ()} onSwipe={onSwipe} />);
    await userEvent.click(screen.getByRole('button', { name: 'Знаю' }));
    expect(onSwipe).toHaveBeenCalledWith('know');
  });

  it('клик «Отложить» → onSwipe(snooze)', async () => {
    const onSwipe = vi.fn();
    render(<PoolCard question={makeQ()} onSwipe={onSwipe} />);
    await userEvent.click(screen.getByRole('button', { name: 'Отложить' }));
    expect(onSwipe).toHaveBeenCalledWith('snooze');
  });

  it('disabled: клики не дёргают onSwipe', async () => {
    const onSwipe = vi.fn();
    render(<PoolCard question={makeQ()} onSwipe={onSwipe} disabled />);
    await userEvent.click(screen.getByRole('button', { name: 'Изучаю' }));
    await userEvent.click(screen.getByRole('button', { name: 'Знаю' }));
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
