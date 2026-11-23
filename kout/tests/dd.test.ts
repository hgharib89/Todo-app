import { describe, expect, it } from 'vitest';
import { applyAction, buildDeck, buildRules, createGame, GameState, handOutcome, legalPlays, teamOf } from '../src/engine';
import { solveCandidates, solvePosition } from '../src/bots/dd';

const WIN = 54;
/** Plain minimax with the real engine (slow, no tricks): the reference for the solver. */
function brute(s: GameState, team: number): number {
  if (s.phase !== 'playing') {
    const o = handOutcome(s);
    const tricks = 0.01 * (s.tricksWon[team] - s.tricksWon[1 - team]);
    if (o.larensWin) return (s.contract!.team === team ? WIN : -WIN) + tricks;
    return o.points[team] - o.points[1 - team] + tricks;
  }
  const p = s.currentPlayer;
  const vals = legalPlays(s, p).map((c) => brute(applyAction(s, { type: 'PLAY', player: p, card: c }), team));
  return teamOf(s, p) === team ? Math.max(...vals) : Math.min(...vals);
}

/** A random endgame: play a random game until `left` cards remain per player. */
function endgame(seed: number, mode: 'bo4' | 'bo6', left: number, bid: number): GameState | null {
  const rules = buildRules('default', { playToLastCard: false });
  let s = createGame(rules, mode, seed);
  // force a contract quickly
  const bidder = s.currentPlayer;
  s = applyAction(s, { type: 'BID', player: bidder, value: bid });
  while (s.phase === 'bidding') s = applyAction(s, { type: 'PASS', player: s.currentPlayer });
  if (s.phase !== 'choosingTrump') return null;
  s = applyAction(s, { type: 'CHOOSE_TRUMP', player: s.currentPlayer, suit: (['S', 'H', 'D', 'C'] as const)[seed % 4] });
  let k = seed;
  while (s.phase === 'playing' && Math.max(...s.hands.map((h) => h.length)) > left) {
    const l = legalPlays(s);
    k = (k * 1103515245 + 12345) & 0x7fffffff;
    s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card: l[k % l.length] });
  }
  return s.phase === 'playing' ? s : null;
}

describe('double-dummy solver', () => {
  it('agrees with brute-force minimax on the real engine (many random endgames)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 300 && checked < 80; seed++) {
      for (const [mode, left, bid] of [['bo4', 3, 6], ['bo4', 2, 7], ['bo6', 2, 6]] as const) {
        const s = endgame(seed, mode, left, bid);
        if (!s) continue;
        for (const team of [0, 1]) {
          expect(solvePosition(s, team, WIN).value).toBeCloseTo(brute(s, team), 9);
        }
        const cands = legalPlays(s);
        const res = solveCandidates(s, teamOf(s, s.currentPlayer), cands, WIN);
        for (const c of cands) expect(res.values.get(c)).toBeCloseTo(brute(applyAction(s, { type: 'PLAY', player: s.currentPlayer, card: c }), teamOf(s, s.currentPlayer)), 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('solves a 4-cards-each Bo 6 endgame quickly', () => {
    const s = endgame(5, 'bo6', 4, 6)!;
    const t0 = performance.now();
    const r = solveCandidates(s, 0, legalPlays(s), WIN);
    expect(r.complete).toBe(true);
    expect(performance.now() - t0).toBeLessThan(2000);
    void buildDeck;
  });
});
