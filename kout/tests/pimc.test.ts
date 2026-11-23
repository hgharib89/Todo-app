import { describe, expect, it } from 'vitest';
import { applyAction, buildDeck, buildRules, createGame, GameState, legalActions } from '../src/engine';
import { chooseBotAction, legacyHardAction, pimcScores } from '../src/bots';
import { playingState, Setup } from './helpers';

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
/** every card not in a hand counts as played; trick counts as given */
function position(o: Setup & { tricksPlayed: number; tricksWon: [number, number] }): GameState {
  const s = playingState(o);
  const inHands = new Set(o.hands.flat());
  return { ...s, playedCards: buildDeck(s.rules, s.mode).filter((c) => !inHands.has(c)) };
}
const hard = (s: GameState, seed = 1) => chooseBotAction(s, 'hard', seeded(seed), { deals: 60 });

describe('new Hard bot (PIMC) — key decisions', () => {
  it("doesn't overtake a partner who is already winning", () => {
    // partner (seat 2) leads the top heart; seat 0 must not throw its trump Ace on it
    let s = position({
      trump: 'S', bidder: 0, bid: 7, leader: 2, tricksPlayed: 5, tricksWon: [3, 2],
      hands: [['H13', 'H7', 'S14', 'C14'], ['H9', 'C9', 'D9', 'C10'], ['H14', 'D7', 'C7', 'S12'], ['H8', 'C8', 'D8', 'C11']],
    });
    s = play(s, 'H14', 'H8');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'H7' });
  });

  it('…but spends a joker it may never lead while it still can, even on partner’s trick, when every trick is needed', () => {
    // bid 7, the team needs all 4 remaining tricks; seat 0's red joker can't be led (bid 7):
    // it can only be played on someone else's trick — the exact solver prefers using it now
    let s = position({
      trump: 'S', bidder: 0, bid: 7, leader: 2, tricksPlayed: 5, tricksWon: [3, 2],
      hands: [['H13', 'H7', 'S14', 'XR'], ['H9', 'C9', 'D9', 'C10'], ['H14', 'D7', 'C7', 'S12'], ['H8', 'C8', 'D8', 'C11']],
    });
    s = play(s, 'H14', 'H8');
    const r = pimcScores(s, seeded(1), { deals: 60 });
    expect(r.exact).toBe(true);
    const v = Object.fromEntries(r.scores.map((x) => [x.card, x.mean]));
    expect(v.XR).toBeGreaterThan(v.H7);
  });

  it('uses the joker on a critical trick instead of holding it to the last card', () => {
    // seat 0 (bidding team, needs both remaining tricks) can't lead its joker (bid 6, trumps not out):
    // if it doesn't win this trick with the joker, it must lead the joker last → a cancelled lead
    let s = position({
      trump: 'S', bidder: 0, bid: 6, leader: 3, tricksPlayed: 7, tricksWon: [4, 3],
      hands: [['XR', 'C7'], ['H7', 'C9'], ['H8', 'C10'], ['H14', 'C8']],
    });
    s = play(s, 'H14');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'XR' });
  });

  it("doesn't waste a joker on a trick partner already has", () => {
    let s = position({
      trump: 'S', bidder: 0, bid: 7, leader: 1, tricksPlayed: 6, tricksWon: [4, 2],
      hands: [['XB', 'H7', 'C14'], ['H9', 'C9', 'D9'], ['H14', 'D7', 'C7'], ['H8', 'C8', 'D8']],
    });
    s = play(s, 'H9', 'H14', 'H8'); // partner wins with the top heart, seat 0 is last
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'H7' });
  });

  it('beats the trump Ace with the black joker when the trick matters (both jokers rank above the Ace)', () => {
    // bidders have 5 of 7 with 3 tricks left: the defenders must win 2 of 3, so this trick matters
    let s = position({
      trump: 'S', bidder: 1, bid: 7, leader: 1, tricksPlayed: 6, tricksWon: [1, 5],
      hands: [['XB', 'H7', 'C14'], ['C9', 'D9', 'S14'], ['H14', 'D7', 'C7'], ['H8', 'C8', 'D8']],
    });
    s = play(s, 'S14', 'H14', 'H8');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'XB' });
  });

  it('wins a trick as cheaply as possible', () => {
    let s = position({
      trump: 'S', bidder: 0, bid: 9, leader: 1, tricksPlayed: 5, tricksWon: [5, 0],
      // (no joker here: a joker can never be led, so with Larens at stake the solver rightly spends it on this trick)
      hands: [['H14', 'H13', 'H7', 'S14'], ['H10', 'C9', 'D9', 'D10'], ['H8', 'C8', 'D8', 'C10'], ['H12', 'C7', 'D7', 'C11']],
    });
    s = play(s, 'H10', 'H8', 'H12');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'H13' });
  });

  it('uses the exact solver in the endgame', () => {
    const s = position({
      trump: 'S', bidder: 0, bid: 6, tricksPlayed: 6, tricksWon: [4, 2],
      hands: [['S14', 'H14', 'C7'], ['S9', 'H9', 'D9'], ['H8', 'C8', 'D8'], ['S7', 'C9', 'D7']],
    });
    const r = pimcScores(s, seeded(1), { deals: 30 });
    expect(r.exact).toBe(true);
    expect(r.deals).toBe(30);
  });

  // ---- bidding by simulation ----
  const deal = (h0: string[]) => {
    const rules = buildRules('default', { firstDealer: 3 });
    const g = createGame(rules, 'bo4', 1);
    const rest = buildDeck(rules, 'bo4').filter((c) => !h0.includes(c));
    return { ...g, hands: [h0, rest.slice(0, 9), rest.slice(9, 18), rest.slice(18, 27)] };
  };

  it('bids with a strong hand and passes with a weak one', () => {
    const strong = deal(['XR', 'XB', 'S14', 'S13', 'S12', 'S10', 'H14', 'D14', 'C9']);
    const a = hard(strong);
    expect(['BID', 'JOKER_ASK']).toContain(a.type);
    if (a.type === 'BID') expect(a.value).toBeGreaterThanOrEqual(7);
    const weak = deal(['S6', 'S7', 'H6', 'H7', 'C7', 'C8', 'D7', 'D8', 'H8']);
    expect(hard(weak)).toEqual({ type: 'PASS', player: 0 });
  });

  it('takes the forced Malzoom with a weak hand instead of raising', () => {
    let s = deal(['S6', 'S7', 'H6', 'H7', 'C7', 'C8', 'D7', 'D8', 'H8']) as GameState;
    s = { ...s, dealer: 0, currentPlayer: 1 };
    for (const p of [1, 2, 3]) s = applyAction(s, { type: 'PASS', player: p });
    expect(hard(s)).toEqual({ type: 'BID', player: 0, value: 5 });
  });

  it('chooses the trump suit its hand is built around', () => {
    let s = deal(['XR', 'H14', 'H13', 'H12', 'H10', 'H9', 'S7', 'C8', 'D7']) as GameState;
    s = { ...s, dealer: 3, currentPlayer: 0 };
    s = applyAction(s, { type: 'BID', player: 0, value: 7 });
    for (const p of [1, 2, 3]) s = applyAction(s, { type: 'PASS', player: p });
    expect(hard(s)).toEqual({ type: 'CHOOSE_TRUMP', player: 0, suit: 'H' });
  });

  it('only ever picks legal actions, never reneges, and finishes games (Bo 4 and Bo 6)', () => {
    for (const mode of ['bo4', 'bo6'] as const) {
      let s = createGame(buildRules(), mode, 5);
      const rng = seeded(3);
      let guard = 0;
      while (s.phase !== 'gameOver' && s.handNumber <= 2 && guard++ < 2000) {
        if (s.phase === 'handOver') {
          s = applyAction(s, { type: 'NEXT_HAND' });
          continue;
        }
        const a = s.phase === 'review' ? { type: 'END_REVIEW' as const } : chooseBotAction(s, 'hard', rng, { deals: 8, timeMs: 50, bidDeals: 10 });
        expect(legalActions(s)).toContainEqual(a);
        s = applyAction(s, a);
        expect(s.reneges).toEqual([]);
      }
    }
  }, 120000);

  it('the previous Hard bot is still available for benchmarking', () => {
    const s = createGame(buildRules(), 'bo4', 3);
    expect(legalActions(s)).toContainEqual(legacyHardAction(s, seeded(1)));
  });
});
