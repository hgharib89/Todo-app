import { describe, expect, it } from 'vitest';
import { RULES, applyAction, buildRules, createGame, GameState, legalActions, legalPlays } from '../src/engine';
import { chooseBotAction, chooseBotCatch, Difficulty } from '../src/bots';
import { playingState } from './helpers';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}
const withRenege = (r: Partial<typeof RULES.renege>) => buildRules('default', { renege: { ...RULES.renege, ...r } });

// seat 1 reneges on hearts (D9 while holding H9), then shows H9 → evidence against seat 1
const HANDS = [
  ['H14', 'C14', 'D14'],
  ['H9', 'D9', 'C9'],
  ['H8', 'C8', 'D8'],
  ['H7', 'C7', 'D7'],
];
const evidenceState = (rules = RULES) =>
  play(playingState({ rules, trump: 'S', bidder: 0, bid: 6, hands: HANDS, tricksPlayed: 6, tricksWon: [4, 2] }), 'H14', 'D9', 'H8', 'H7', 'C14', 'H9');

describe('bots: reneging by mistake', () => {
  it('Hard never reneges (default chance 0)', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: HANDS, tricksPlayed: 6 }), 'H14');
    for (let k = 0; k < 30; k++) expect(chooseBotAction(s, 'hard', seeded(k), { samples: 4 })).toEqual({ type: 'PLAY', player: 1, card: 'H9' });
  });

  it('Easy/Medium renege at the configured chance', () => {
    const always = withRenege({ botRenegeChance: { easy: 1, medium: 1, hard: 0 } });
    const never = withRenege({ botRenegeChance: { easy: 0, medium: 0, hard: 0 } });
    for (const d of ['easy', 'medium'] as Difficulty[]) {
      const s = play(playingState({ rules: always, trump: 'S', bidder: 0, bid: 6, hands: HANDS, tricksPlayed: 6 }), 'H14');
      const a = chooseBotAction(s, d, seeded(1));
      expect(a.type).toBe('PLAY');
      expect(['D9', 'C9']).toContain((a as { card: string }).card); // a wrong card while holding H9
      const t = play(playingState({ rules: never, trump: 'S', bidder: 0, bid: 6, hands: HANDS, tricksPlayed: 6 }), 'H14');
      for (let k = 0; k < 20; k++) expect(chooseBotAction(t, d, seeded(k))).toEqual({ type: 'PLAY', player: 1, card: 'H9' });
    }
  });

  it('default mistake rates are small and Medium errs less than Easy', () => {
    const r = RULES.renege.botRenegeChance;
    expect(r.hard).toBe(0);
    expect(r.medium).toBeGreaterThan(0);
    expect(r.medium).toBeLessThan(r.easy);
    expect(r.easy).toBeLessThanOrEqual(0.1);
  });
});

describe('bots: catching (صيد)', () => {
  it('Hard always catches when there is visible evidence', () => {
    const s = evidenceState();
    expect(chooseBotCatch(s, 0, 'hard')).toEqual({ type: 'CATCH', player: 0, accused: 1, trick: 0 });
    expect(chooseBotCatch(s, 2, 'hard')).toEqual({ type: 'CATCH', player: 2, accused: 1, trick: 0 });
    expect(chooseBotCatch(s, 3, 'hard')).toBeNull(); // the reneger's partner
  });

  it('never catches without visible evidence, even if a renege happened (no peeking)', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: HANDS, tricksPlayed: 6 }), 'H14', 'D9');
    expect(s.reneges).toHaveLength(1); // it really happened…
    for (const seat of [0, 2]) expect(chooseBotCatch(s, seat, 'hard')).toBeNull(); // …but nobody can see it yet
  });

  it('decisions do not depend on the hidden renege record', () => {
    const s = evidenceState();
    const blind = { ...s, reneges: [] };
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      for (const seat of [0, 2]) expect(chooseBotCatch(blind, seat, d)).toEqual(chooseBotCatch(s, seat, d));
    }
  });

  it('Medium catches about 60% of the time and Easy about 25%', () => {
    const rate = (d: Difficulty) => {
      let hit = 0;
      const n = 400;
      for (let h = 1; h <= n; h++) if (chooseBotCatch({ ...evidenceState(), handNumber: h }, 0, d)) hit++;
      return hit / n;
    };
    expect(rate('medium')).toBeGreaterThan(0.5);
    expect(rate('medium')).toBeLessThan(0.7);
    expect(rate('easy')).toBeGreaterThan(0.17);
    expect(rate('easy')).toBeLessThan(0.33);
  });

  it('each bot decides once per piece of evidence (asking again gives the same answer)', () => {
    const s = evidenceState();
    const a = chooseBotCatch(s, 0, 'medium');
    for (let k = 0; k < 5; k++) expect(chooseBotCatch(s, 0, 'medium')).toEqual(a);
  });

  it('catch chances are configurable', () => {
    const none = withRenege({ botCatchChance: { easy: 0, medium: 0, hard: 0 } });
    expect(chooseBotCatch(evidenceState(none), 0, 'hard')).toBeNull();
  });
});

describe('full games with reneging and catching', () => {
  it('mistake-prone bots get caught, hands are scored correctly and games finish', () => {
    const rules = withRenege({ botRenegeChance: { easy: 0.15, medium: 0.15, hard: 0 } });
    let caught = 0;
    let reneges = 0;
    for (let g = 0; g < 6; g++) {
      let s = createGame(rules, 'bo4', 500 + g);
      const rng = seeded(g + 1);
      const diff = (seat: number): Difficulty => (seat % 2 === 0 ? 'hard' : 'medium');
      let guard = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'handOver') {
          s = applyAction(s, { type: 'NEXT_HAND' });
          continue;
        }
        // any bot may call صيد on what it has seen
        let called = false;
        if (s.phase === 'playing' || s.phase === 'review') {
          for (let seat = 0; seat < 4 && !called; seat++) {
            const c = chooseBotCatch(s, seat, diff(seat));
            if (c) {
              const before = s.reneges.length;
              s = applyAction(s, c);
              expect(s.lastResult?.caught?.success).toBe(true);
              expect(before).toBeGreaterThan(0); // only real reneges are ever caught
              const r = s.lastResult!;
              const offender = r.caught!.accused % 2;
              expect(r.points[offender]).toBe(0);
              expect(r.points[1 - offender]).toBe(r.bid * 2);
              caught++;
              called = true;
            }
          }
        }
        if (called) continue;
        const a = chooseBotAction(s, diff(s.currentPlayer), rng, { samples: 3 });
        expect(legalActions(s)).toContainEqual(a);
        if (s.phase === 'playing' && diff(s.currentPlayer) === 'hard') expect(legalPlays(s)).toContain((a as any).card);
        const n = s.reneges?.length ?? 0;
        s = applyAction(s, a);
        if ((s.reneges?.length ?? 0) > n) reneges++;
        if (++guard > 8000) throw new Error('stuck');
      }
      expect(s.winner).not.toBeNull();
    }
    expect(reneges).toBeGreaterThan(0);
    expect(caught).toBeGreaterThan(0);
  }, 60000);
});
