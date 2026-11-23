import { describe, expect, it } from 'vitest';
import {
  RULES,
  applyAction,
  buildRules,
  catchOptions,
  legalActions,
  legalPlays,
  playableCards,
  playerView,
  renegeEvidence,
  GameState,
} from '../src/engine';
import { playingState } from './helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}

// Bo 4, trump ♠, seat 0 (team 0) bid 6 and leads. 3 cards each, 6 tricks already played.
//   seat 1 (team 1) holds H9 but will renege on the heart lead with D9, then play H9 later.
const HANDS = [
  ['H14', 'C14', 'D14'],
  ['H9', 'D9', 'C9'],
  ['H8', 'C8', 'D8'],
  ['H7', 'C7', 'D7'],
];
const start = (over: Partial<Parameters<typeof playingState>[0]> = {}) =>
  playingState({ trump: 'S', bidder: 0, bid: 6, hands: HANDS, tricksPlayed: 6, tricksWon: [4, 2], ...over });

describe('reneging (القطع الغلط)', () => {
  it('config defaults', () => {
    expect(RULES.renege).toMatchObject({
      allowRenege: true,
      renegePenaltyMultiplier: 2,
      wrongCatchPenalty: 'none',
      botCatchChance: { hard: 1, medium: 0.6, easy: 0.25 },
    });
    expect(RULES.renege.botRenegeChance.hard).toBe(0);
    expect(RULES.playToLastCard).toBe(true);
  });

  it('any card can be played; legalPlays still says what follows suit', () => {
    const s = play(start(), 'H14');
    expect(legalPlays(s)).toEqual(['H9']);
    expect(playableCards(s).sort()).toEqual(['C9', 'D9', 'H9']);
    expect(legalActions(s)).toHaveLength(3);
  });

  it('jokers are never reneges, and joker rules still apply', () => {
    // seat 1 holds hearts and the black joker: the joker is a legal play, not a renege
    let s = playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H14', 'C7'], ['H9', 'XB'], ['H8', 'C8'], ['H7', 'C9']], tricksPlayed: 7 });
    s = play(s, 'H14', 'XB');
    expect(s.reneges).toEqual([]);
    // a joker lead the rules forbid stays blocked (the bid-5 lead of a joker is not playable)
    const lead = playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['XR', 'H7'], ['H9'], ['H8'], ['H10']], tricksPlayed: 8 });
    expect(playableCards(lead)).toEqual(['H7']);
  });

  it('silently records every renege (hidden from playerView)', () => {
    const s = play(start(), 'H14', 'D9');
    expect(s.reneges).toEqual([{ player: 1, team: 1, trick: 6, card: 'D9', ledSuit: 'H' }]);
    expect(playerView(s, 0).reneges).toEqual([]);
  });

  it('not following because you are out of the suit is not a renege', () => {
    let s = playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H14', 'C7'], ['D9', 'C9'], ['H8', 'C8'], ['H7', 'D7']], tricksPlayed: 7 });
    s = play(s, 'H14', 'D9');
    expect(s.reneges).toEqual([]);
  });
});

describe('catching (أكاشف)', () => {
  it('no evidence until the reneger later plays the suit they showed out of', () => {
    let s = play(start(), 'H14', 'D9', 'H8', 'H7');
    expect(renegeEvidence(s)).toEqual([]);
    expect(catchOptions(s, 0)).toEqual([]);
    // seat 0 won and leads clubs; seat 1 plays H9 → visible evidence
    s = play(s, 'C14', 'H9');
    expect(renegeEvidence(s)).toEqual([{ accused: 1, trick: 0, suit: 'H', card: 'D9', proof: 'H9', proofTrick: 1 }]);
    expect(catchOptions(s, 0)).toHaveLength(1); // opponent of the reneger
    expect(catchOptions(s, 3)).toEqual([]); // the reneger's partner can't catch them
  });

  it('a correct catch during play breaks the hand: double the bid to the catchers, 0 to the renegers', () => {
    let s = play(start(), 'H14', 'D9', 'H8', 'H7', 'C14', 'H9');
    s = applyAction(s, { type: 'CATCH', player: 2, accused: 1, trick: 0 });
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({
      points: [12, 0],
      made: true, // the bidding team (team 0) gets the points
      endedEarly: true,
      caught: { catcher: 2, accused: 1, trick: 0, success: true, suit: 'H' },
    });
    expect(s.scores).toEqual([12, 0]);
  });

  it('the bidding team reneging is broken the same way', () => {
    // seat 0 (bidder's team) reneges; team 1 catches
    let s = playingState({
      trump: 'S', bidder: 0, bid: 7, leader: 1, tricksPlayed: 6, tricksWon: [5, 1],
      hands: [['H14', 'D14', 'C14'], ['H9', 'C9', 'D9'], ['H8', 'C8', 'D8'], ['H7', 'C7', 'D7']],
    });
    s = play(s, 'H9', 'H8', 'H7', 'D14'); // seat 0 holds H14 but plays D14
    expect(s.reneges.map((r) => r.player)).toEqual([0]);
    s = play(s, 'C9', 'C8', 'C7', 'H14'); // seat 1's H9 won and leads clubs; seat 0 now shows H14
    expect(catchOptions(s, 1).map((e) => e.accused)).toEqual([0]);
    s = applyAction(s, { type: 'CATCH', player: 3, accused: 0, trick: 0 });
    expect(s.lastResult).toMatchObject({ points: [0, 14], made: false, caught: { success: true } });
  });

  it('Malzoom: double of 5', () => {
    let s = start({ forced: true, bid: 5 });
    s = play(s, 'H14', 'D9', 'H8', 'H7', 'C14', 'H9');
    s = applyAction(s, { type: 'CATCH', player: 0, accused: 1, trick: 0 });
    expect(s.lastResult?.points).toEqual([10, 0]);
  });

  it('a wrong catch does nothing by default (wrongCatchPenalty = none)', () => {
    let s = play(start(), 'H14', 'H9', 'H8', 'H7'); // everyone followed
    const before = s;
    s = applyAction(s, { type: 'CATCH', player: 0, accused: 1, trick: 0 });
    expect(s.phase).toBe('playing');
    expect(s.scores).toEqual(before.scores);
    expect(s.lastCatch).toMatchObject({ success: false, catcher: 0, accused: 1 });
  });

  it("a correct renege without visible evidence yet can't be caught", () => {
    let s = play(start(), 'H14', 'D9');
    s = applyAction(s, { type: 'CATCH', player: 0, accused: 1, trick: 0 });
    expect(s.phase).toBe('playing');
    expect(s.lastCatch?.success).toBe(false);
  });

  it("wrongCatchPenalty 'brokenHand' breaks the hand for the team that called it", () => {
    const rules = buildRules('default', { renege: { ...RULES.renege, wrongCatchPenalty: 'brokenHand' } });
    let s = play(start({ rules }), 'H14', 'H9', 'H8', 'H7');
    s = applyAction(s, { type: 'CATCH', player: 1, accused: 0, trick: 0 });
    expect(s.lastResult?.points).toEqual([12, 0]);
  });

  it('renegePenaltyMultiplier is configurable', () => {
    const rules = buildRules('default', { renege: { ...RULES.renege, renegePenaltyMultiplier: 3 } });
    let s = play(start({ rules }), 'H14', 'D9', 'H8', 'H7', 'C14', 'H9');
    s = applyAction(s, { type: 'CATCH', player: 0, accused: 1, trick: 0 });
    expect(s.lastResult?.points).toEqual([18, 0]);
  });

  it('only opponents can be accused; catches only while playing or reviewing', () => {
    const s = play(start(), 'H14', 'D9', 'H8', 'H7', 'C14', 'H9');
    expect(() => applyAction(s, { type: 'CATCH', player: 3, accused: 1, trick: 0 })).toThrow();
    const b = playingState({ trump: 'S', bidder: 0, bid: 6, hands: HANDS });
    expect(() => applyAction({ ...b, phase: 'bidding' }, { type: 'CATCH', player: 0, accused: 1, trick: 0 })).toThrow();
  });

  it('end-of-hand review: every renege has evidence once all cards are played, and can be caught then', () => {
    let s = play(start(), 'H14', 'D9', 'H8', 'H7'); // seat 0 wins, leads
    s = play(s, 'D14', 'C9', 'D8', 'D7'); // seat 1 plays C9 here (out of diamonds, fine)
    s = play(s, 'C14', 'H9', 'C8', 'C7'); // last trick: seat 1's H9 is the proof
    expect(s.phase).toBe('review');
    expect(catchOptions(s, 2)).toHaveLength(1);
    const caught = applyAction(s, { type: 'CATCH', player: 2, accused: 1, trick: 0 });
    expect(caught.lastResult).toMatchObject({ points: [12, 0], endedEarly: false, caught: { success: true } });
  });

  it('if nobody catches, the review ends and the hand scores normally', () => {
    let s = play(start(), 'H14', 'D9', 'H8', 'H7', 'D14', 'C9', 'D8', 'D7', 'C14', 'H9', 'C8', 'C7');
    s = applyAction(s, { type: 'END_REVIEW' });
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({ made: true, points: [6, 0], caught: null });
  });

  it('a renege on a trick led by a legal joker (trump) is caught too', () => {
    let s = playingState({
      trump: 'S', bidder: 0, bid: 9, tricksPlayed: 7, tricksWon: [7, 0],
      hands: [['XR', 'C14'], ['S9', 'D9'], ['H8', 'C8'], ['H7', 'C7']],
    });
    s = play(s, 'XR', 'D9', 'H8', 'H7'); // seat 1 holds S9 but plays D9
    s = play(s, 'C14', 'S9', 'C8', 'C7');
    expect(renegeEvidence(s)).toEqual([expect.objectContaining({ accused: 1, trick: 0, suit: 'S' })]);
  });

  it('a caught renege during Larens breaks the hand normally (double the bid, no game win)', () => {
    let s = start({ bid: 9, tricksWon: [6, 0] });
    s = { ...s, handNumber: 1 };
    s = play(s, 'H14', 'D9', 'H8', 'H7', 'C14', 'H9');
    s = applyAction(s, { type: 'CATCH', player: 0, accused: 1, trick: 0 });
    expect(s.lastResult?.points).toEqual([18, 0]);
    expect(s.phase).toBe('handOver');
  });
});
