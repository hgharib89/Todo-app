import { describe, expect, it } from 'vitest';
import { applyAction, buildRules, createGame, legalActions, JokerPresetId } from '../src/engine';
import { chooseBotAction, estimateTricks, Difficulty } from '../src/bots';
import { playingState } from './helpers';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe('bots', () => {
  const presets: JokerPresetId[] = ['default', 'strict', 'stricter', 'relaxed'];
  for (const mode of ['bo4', 'bo6'] as const) {
    for (const diff of ['easy', 'medium'] as Difficulty[]) {
      it(`${diff} bots finish ${mode} games using only legal actions (all presets)`, () => {
        presets.forEach((preset, k) => {
          for (let seed = 1; seed <= 6; seed++) {
            let s = createGame(buildRules(preset), mode, seed * 31 + k);
            const rng = seeded(seed);
            let guard = 0;
            while (s.phase !== 'gameOver') {
              const a = chooseBotAction(s, diff, rng);
              expect(legalActions(s)).toContainEqual(a);
              s = applyAction(s, a);
              if (++guard > 20000) throw new Error('stuck');
            }
            expect(s.winner).not.toBeNull();
          }
        });
      });
    }
  }

  it('medium evaluation prefers strong trump holdings', () => {
    const s = createGame(buildRules(), 'bo4', 1);
    const hand = ['XR', 'XB', 'S14', 'S13', 'S12', 'S10', 'H14', 'D7', 'C8'];
    expect(estimateTricks(s, hand, 'S')).toBeGreaterThan(estimateTricks(s, hand, 'C'));
    expect(estimateTricks(s, hand, 'S')).toBeGreaterThan(5);
  });

  it('medium bot wins cheaply when last to play', () => {
    const s0 = playingState({
      trump: 'S', bidder: 0, bid: 5, leader: 1,
      hands: [['H14', 'H13', 'H7', 'XR'], ['H10'], ['H6'], ['H12']],
    });
    let s = applyAction(s0, { type: 'PLAY', player: 1, card: 'H10' });
    s = applyAction(s, { type: 'PLAY', player: 2, card: 'H6' });
    s = applyAction(s, { type: 'PLAY', player: 3, card: 'H12' });
    expect(chooseBotAction(s, 'medium')).toEqual({ type: 'PLAY', player: 0, card: 'H13' });
  });

  it('medium bot plays low when partner is already winning as last player', () => {
    const s0 = playingState({
      trump: 'S', bidder: 0, bid: 5, leader: 1,
      hands: [['H14', 'H13', 'H7'], ['H10'], ['H12'], ['H6']],
    });
    let s = applyAction(s0, { type: 'PLAY', player: 1, card: 'H10' });
    s = applyAction(s, { type: 'PLAY', player: 2, card: 'H12' });
    s = applyAction(s, { type: 'PLAY', player: 3, card: 'H6' });
    expect(chooseBotAction(s, 'medium')).toEqual({ type: 'PLAY', player: 0, card: 'H7' });
  });

  it('medium bot uses a joker when last and nothing else wins', () => {
    const s0 = playingState({
      trump: 'S', bidder: 1, bid: 6, leader: 1,
      hands: [['XB', 'C7', 'C9'], ['D14', 'S2'], ['D6'], ['D7']],
    });
    const s = applyAction(s0, { type: 'PLAY', player: 1, card: 'D14' });
    let t = applyAction(s, { type: 'PLAY', player: 2, card: 'D6' });
    t = applyAction(t, { type: 'PLAY', player: 3, card: 'D7' });
    // last player: black joker would win (red joker & trump ace unseen don't matter when last)
    expect(chooseBotAction(t, 'medium')).toEqual({ type: 'PLAY', player: 0, card: 'XB' });
  });

  it('medium bot saves a beatable black joker when not last', () => {
    const s0 = playingState({
      trump: 'S', bidder: 1, bid: 6, leader: 3,
      hands: [['XB', 'C7', 'C9'], ['D6'], ['D7'], ['D14', 'S2']],
    });
    const s = applyAction(s0, { type: 'PLAY', player: 3, card: 'D14' });
    // seat 0 plays 2nd; red joker / trump ace are unseen → XB is not a sure winner
    expect(chooseBotAction(s, 'medium')).toEqual({ type: 'PLAY', player: 0, card: 'C7' });
  });
});
