import { describe, expect, it } from 'vitest';
import {
  applyAction, buildRules, checkGameEnd, createGame, handPoints, legalActions, GameState, RULES,
} from '../src/engine';
import { playingState } from './helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}

describe('scoring table', () => {
  const rules = buildRules();
  it.each([
    [5, 5, 10],
    [6, 6, 12],
    [7, 7, 14],
    [8, 8, 16],
    [9, 36, 18],
  ])('bid %i: made → %i to bidders, failed → %i to opponents', (bid, made, failed) => {
    expect(handPoints(rules, { team: 0, value: bid, forced: false }, true)).toEqual([made, 0]);
    expect(handPoints(rules, { team: 0, value: bid, forced: false }, false)).toEqual([0, failed]);
    expect(handPoints(rules, { team: 1, value: bid, forced: false }, true)).toEqual([0, made]);
    expect(handPoints(rules, { team: 1, value: bid, forced: false }, false)).toEqual([failed, 0]);
  });
  it('Malzoom 5: 5 if made, 5 to opponents if failed', () => {
    expect(handPoints(rules, { team: 1, value: 5, forced: true }, true)).toEqual([0, 5]);
    expect(handPoints(rules, { team: 1, value: 5, forced: true }, false)).toEqual([5, 0]);
  });
  it('scoring reads from config', () => {
    const r = buildRules('default', { scoring: { ...RULES.scoring, 6: { made: 60, failed: 1 } } });
    expect(handPoints(r, { team: 0, value: 6, forced: false }, true)).toEqual([60, 0]);
  });
});

describe('hand end: play to the last card (playToLastCard)', () => {
  // bidder team 0 bid 5; give it 5 sure tricks then more cards
  const hands = () => [
    ['S14', 'S13', 'S12', 'S11', 'S10', 'H7'],
    ['H14', 'H13', 'H12', 'H11', 'H10', 'H9'],
    ['C7', 'C8', 'C9', 'C10', 'C11', 'C12'],
    ['D6', 'D7', 'D8', 'D9', 'D10', 'D11'],
  ];
  const leadAll = (s: GameState) => {
    for (const c of ['S14', 'S13', 'S12', 'S11', 'S10']) {
      if (s.phase !== 'playing') break;
      const p1 = s.hands[1][0], p2 = s.hands[2][0], p3 = s.hands[3][0];
      s = play(s, c, p1, p2, p3);
    }
    return s;
  };
  const early = buildRules('default', { playToLastCard: false });

  it('config: every hand is played to the last card by default', () => {
    expect(RULES.playToLastCard).toBe(true);
  });

  it('keeps playing after the bid is made, then reviews and scores', () => {
    let s = playingState({ trump: 'S', bidder: 0, bid: 5, hands: hands(), tricksPlayed: 3 });
    s = leadAll(s);
    expect(s.phase).toBe('playing'); // bid already made, but the hand goes on
    s = play(s, 'H7', s.hands[1][0], s.hands[2][0], s.hands[3][0]);
    expect(s.phase).toBe('review'); // all cards played: the table may still call صيد
    expect(s.hands.every((h) => h.length === 0)).toBe(true);
    s = applyAction(s, { type: 'END_REVIEW' });
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({ made: true, endedEarly: false, tricks: [5, 1], points: [5, 0], caught: null });
  });

  it('keeps playing after the bid is lost', () => {
    let s = playingState({ trump: 'S', bidder: 1, bid: 9, leader: 0, hands: hands() });
    s = play(s, 'S14', 'H14', 'C7', 'D6');
    expect(s.phase).toBe('playing');
  });

  it('playToLastCard: false ends the hand as soon as the bid is made', () => {
    let s = playingState({ rules: early, trump: 'S', bidder: 0, bid: 5, hands: hands(), tricksPlayed: 3 });
    s = leadAll(s);
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({ made: true, endedEarly: true, points: [5, 0] });
  });

  it('playToLastCard: false ends the hand as soon as the bid can no longer be made', () => {
    let s = playingState({ rules: early, trump: 'S', bidder: 1, bid: 9, leader: 0, hands: hands() });
    s = play(s, 'S14', 'H14', 'C7', 'D6');
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({ made: false, endedEarly: true, points: [18, 0] });
  });

  it('without reneging there is no review phase', () => {
    const rules = buildRules('default', { renege: { ...RULES.renege, allowRenege: false } });
    let s = playingState({ rules, trump: 'S', bidder: 0, bid: 5, hands: hands(), tricksPlayed: 3 });
    s = leadAll(s);
    s = play(s, 'H7', s.hands[1][0], s.hands[2][0], s.hands[3][0]);
    expect(s.phase).toBe('handOver');
  });
});

describe('game end', () => {
  const r = buildRules();
  it('config: target 54, shutout 36', () => {
    expect(RULES.gameEnd.targetScore).toBe(54);
    expect(RULES.gameEnd.shutoutTarget).toBe(36);
  });
  it('a team reaching 54+ wins', () => {
    expect(checkGameEnd(r, [54, 40])).toBe(0);
    expect(checkGameEnd(r, [30, 54])).toBe(1);
    expect(checkGameEnd(r, [60, 20])).toBe(0);
    expect(checkGameEnd(r, [53, 50])).toBeNull();
    expect(checkGameEnd(r, [53, 53])).toBeNull();
  });
  it('36+ while the other team has 0 wins', () => {
    expect(checkGameEnd(r, [36, 0])).toBe(0);
    expect(checkGameEnd(r, [0, 40])).toBe(1);
    expect(checkGameEnd(r, [36, 5])).toBeNull();
    expect(checkGameEnd(r, [35, 0])).toBeNull();
    expect(checkGameEnd(r, [0, 35])).toBeNull();
  });
  it('a hand that takes a team to 54 ends the game', () => {
    const base = playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['S14'], ['H7'], ['H8'], ['H9']], tricksWon: [5, 3], tricksPlayed: 8 });
    const s = applyAction(play({ ...base, scores: [48, 20] }, 'S14', 'H7', 'H8', 'H9'), { type: 'END_REVIEW' });
    expect(s.phase).toBe('gameOver');
    expect(s.scores).toEqual([54, 20]);
    expect(s.winner).toBe(0);
  });
  it('a hand that takes a team to 36 while the other has 0 ends the game', () => {
    const base = playingState({ trump: 'S', bidder: 1, bid: 6, leader: 1, hands: [['H7'], ['S14'], ['H8'], ['H9']], tricksWon: [3, 5], tricksPlayed: 8 });
    const s = applyAction(play({ ...base, scores: [0, 30] }, 'S14', 'H8', 'H9', 'H7'), { type: 'END_REVIEW' });
    expect(s.phase).toBe('gameOver');
    expect(s.scores).toEqual([0, 36]);
    expect(s.winner).toBe(1);
  });
  it('Bawan made on the first hand is an instant win', () => {
    expect(checkGameEnd(r, [36, 0], { handNumber: 1, made: true, bid: 9, team: 0 })).toBe(0);
    expect(checkGameEnd(r, [0, 36], { handNumber: 1, made: true, bid: 9, team: 1 })).toBe(1);
    expect(checkGameEnd(r, [36, 10], { handNumber: 2, made: true, bid: 9, team: 0 })).toBeNull();
  });
  it('thresholds are configurable', () => {
    const r2 = buildRules('default', { gameEnd: { targetScore: 31, shutoutTarget: null, bawanFirstHandInstantWin: false } });
    expect(checkGameEnd(r2, [31, 0])).toBe(0);
    expect(checkGameEnd(r2, [30, 0])).toBeNull();
    expect(checkGameEnd(r2, [36, 0], { handNumber: 1, made: true, bid: 9, team: 0 })).toBe(0); // via 31 target
    const r3 = buildRules('default', { gameEnd: { targetScore: 101, shutoutTarget: null, bawanFirstHandInstantWin: false } });
    expect(checkGameEnd(r3, [51, 0])).toBeNull();
    expect(checkGameEnd(r3, [36, 0], { handNumber: 1, made: true, bid: 9, team: 0 })).toBeNull();
  });
});

describe('full random games (invariants)', () => {
  it.each(['bo4', 'bo6'] as const)('%s: random legal play always reaches game over', (mode) => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = createGame(buildRules(seed % 2 ? 'default' : 'relaxed'), mode, seed);
      let rnd = seed * 7919;
      let guard = 0;
      while (s.phase !== 'gameOver') {
        const acts = legalActions(s);
        expect(acts.length).toBeGreaterThan(0);
        rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
        const before = s.dealer;
        s = applyAction(s, acts[rnd % acts.length]);
        if (s.phase === 'bidding' && s.bids.length === 0 && s.handNumber > 1) {
          expect(s.dealer).toBe((before + 1) % s.numPlayers);
        }
        if (s.phase === 'handOver' || s.phase === 'gameOver') {
          const h = s.lastResult!;
          const sum = h.totals[0] + h.totals[1];
          expect(sum).toBeGreaterThan(0);
        }
        if (++guard > 20000) throw new Error('game did not end');
      }
      expect(s.winner).not.toBeNull();
      const last = s.history[s.history.length - 1];
      expect(s.scores).toEqual(last.totals);
    }
  });
});
