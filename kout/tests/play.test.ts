import { describe, expect, it } from 'vitest';
import { applyAction, buildRules, legalPlays, trickWinner, GameState, RULES } from '../src/engine';
import { playingState } from './helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}

describe('legal moves (following suit)', () => {
  const base = () =>
    playingState({
      trump: 'S',
      bidder: 0,
      bid: 6,
      hands: [
        ['H10', 'C7', 'S8'],
        ['H12', 'H7', 'D9', 'XB'],
        ['C14', 'S12', 'D7'],
        ['D8', 'C9', 'XR'],
      ],
    });

  it('leader may lead any non-joker card', () => {
    expect(legalPlays(base()).sort()).toEqual(['C7', 'H10', 'S8'].sort());
  });

  it('must follow the led suit if possible; joker may still be played', () => {
    const s = play(base(), 'H10');
    expect(legalPlays(s).sort()).toEqual(['H12', 'H7', 'XB'].sort());
  });

  it('without the led suit any card (including trump) may be played', () => {
    const s = play(base(), 'H10', 'H7');
    expect(legalPlays(s).sort()).toEqual(['C14', 'D7', 'S12'].sort());
  });

  it('joker while holding led suit can be disabled in config', () => {
    const rules = buildRules('default', { jokers: { canPlayWhileHoldingLedSuit: false } });
    const s = play(playingState({ ...setupOf(base()), rules }), 'H10');
    expect(legalPlays(s).sort()).toEqual(['H12', 'H7']);
  });

  it('only the current player has legal plays', () => {
    expect(legalPlays(base(), 1)).toEqual([]);
  });

  it('with allowRenege off, wrong cards are rejected', () => {
    const rules = buildRules('default', { renege: { ...RULES.renege, allowRenege: false } });
    const s = play(playingState({ ...setupOf(base()), rules }), 'H10');
    expect(() => applyAction(s, { type: 'PLAY', player: 1, card: 'D9' })).toThrow();
  });

  it('with allowRenege on (default), a wrong card can be played', () => {
    const s = play(base(), 'H10');
    expect(() => applyAction(s, { type: 'PLAY', player: 1, card: 'D9' })).not.toThrow();
  });
});

function setupOf(s: GameState) {
  return { trump: s.contract!.trump!, bidder: s.contract!.bidder, bid: s.contract!.value, hands: s.hands };
}

describe('trick winner', () => {
  const rules = buildRules();
  const t = (ledSuit: any, cards: string[], cancelled: boolean[] = []) => ({
    leader: 0,
    ledSuit,
    plays: cards.map((card, i) => ({ player: i, card, cancelled: cancelled[i] ?? false })),
  });

  it('highest card of led suit wins when no trump', () => {
    expect(trickWinner(rules, t('H', ['H10', 'H14', 'D14', 'H13']), 'S')).toBe(1);
  });
  it('any trump beats the led suit', () => {
    expect(trickWinner(rules, t('H', ['H14', 'S2', 'H13', 'D14']), 'S')).toBe(1);
  });
  it('higher trump wins', () => {
    expect(trickWinner(rules, t('H', ['H14', 'S7', 'S12', 'H13']), 'S')).toBe(2);
  });
  it('Red Joker > trump Ace > Black Joker > trump King', () => {
    expect(trickWinner(rules, t('S', ['S13', 'XB', 'S14', 'XR']), 'S')).toBe(3);
    expect(trickWinner(rules, t('S', ['S13', 'XB', 'S14', 'C2']), 'S')).toBe(2);
    expect(trickWinner(rules, t('S', ['S13', 'XB', 'S12', 'C2']), 'S')).toBe(1);
  });
  it('a joker played on a plain-suit trick beats it', () => {
    expect(trickWinner(rules, t('H', ['H14', 'XB', 'H13', 'H12']), 'S')).toBe(1);
  });
  it('cancelled jokers never win', () => {
    expect(trickWinner(rules, t('H', ['XR', 'H7', 'H8', 'D14'], [true]), 'S')).toBe(2);
  });
  it('trump order comes from the config', () => {
    const r2 = buildRules('default', { trumpPowerOrder: [14, 'XR', 'XB', 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] });
    expect(trickWinner(r2, t('S', ['XR', 'S14', 'C2', 'C3']), 'S')).toBe(1);
  });
});

describe('trick flow', () => {
  it('winner leads the next trick and trick counts update', () => {
    let s = playingState({
      trump: 'S',
      bidder: 0,
      bid: 5,
      hands: [['H10', 'C7'], ['H12', 'D9'], ['H14', 'D7'], ['H8', 'C9']],
    });
    s = play(s, 'H10', 'H12', 'H14', 'H8');
    expect(s.lastTrick?.winner).toBe(2);
    expect(s.currentPlayer).toBe(2);
    expect(s.tricksWon).toEqual([1, 0]);
  });
});
