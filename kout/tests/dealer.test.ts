import { describe, expect, it } from 'vitest';
import { RULES, applyAction, buildRules, createGame, drawForDealer, legalActions, nextDealer, rankOf, GameState } from '../src/engine';
import { viewFor } from '../server/src/view';
import { playingState } from './helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}
const lowest = (round: { card: string }[]) => Math.min(...round.map((d) => rankOf(d.card)!));

describe('first dealer: lowest card draw', () => {
  it('config defaults', () => {
    expect(RULES.firstDealer).toBe('lowestCardDraw');
    expect(RULES.dealerRotation).toBe('loserKeepsDeal');
  });

  it('every player draws one face-up card (no jokers); the lowest deals', () => {
    for (const mode of ['bo4', 'bo6'] as const) {
      for (let seed = 1; seed <= 100; seed++) {
        const [draw] = drawForDealer(RULES, mode, seed);
        const n = mode === 'bo4' ? 4 : 6;
        expect(draw.rounds[0].map((d) => d.player)).toEqual([...Array(n).keys()]);
        for (const round of draw.rounds) for (const d of round) expect(d.card[0]).not.toBe('X');
        const last = draw.rounds[draw.rounds.length - 1];
        const winners = last.filter((d) => rankOf(d.card) === lowest(last));
        expect(winners.map((d) => d.player)).toEqual([draw.dealer]);
        // all drawn cards are different
        const cards = draw.rounds.flat().map((d) => d.card);
        expect(new Set(cards).size).toBe(cards.length);
      }
    }
  });

  it('a tie for lowest: only the tied players draw again, until one is lowest', () => {
    let tie = null as ReturnType<typeof drawForDealer>[0] | null;
    for (let seed = 1; seed < 2000 && !tie; seed++) {
      const [d] = drawForDealer(RULES, 'bo6', seed);
      if (d.rounds.length > 1) tie = d;
    }
    expect(tie).not.toBeNull();
    for (let i = 1; i < tie!.rounds.length; i++) {
      const prev = tie!.rounds[i - 1];
      const tied = prev.filter((d) => rankOf(d.card) === lowest(prev)).map((d) => d.player);
      expect(tied.length).toBeGreaterThan(1);
      expect(tie!.rounds[i].map((d) => d.player)).toEqual(tied);
    }
  });

  it('2 is the lowest card and the Ace the highest', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const [d] = drawForDealer(RULES, 'bo6', seed);
      const first = d.rounds[0];
      const ranks = first.map((x) => rankOf(x.card)!);
      const dealerCard = first.find((x) => x.player === d.dealer)!;
      expect(rankOf(dealerCard.card)).toBe(Math.min(...ranks));
      if (ranks.includes(2)) expect(rankOf(dealerCard.card)).toBe(2);
    }
  });

  it('a new game uses the draw: it is stored for the animation, and bidding starts right of the dealer', () => {
    const g = createGame(buildRules(), 'bo6', 42);
    expect(g.dealerDraw).toBeTruthy();
    expect(g.dealer).toBe(g.dealerDraw!.dealer);
    expect(g.currentPlayer).toBe((g.dealer + 1) % 6);
    expect(createGame(buildRules(), 'bo6', 42)).toEqual(g); // deterministic per seed
  });

  it("'random' and a fixed seat still work, without a draw", () => {
    expect(createGame(buildRules('default', { firstDealer: 'random' }), 'bo4', 3).dealerDraw).toBeNull();
    const fixed = createGame(buildRules('default', { firstDealer: 2 }), 'bo4', 3);
    expect(fixed.dealer).toBe(2);
    expect(fixed.dealerDraw).toBeNull();
  });

  it('online players see the draw from their own seat', () => {
    const g = createGame(buildRules(), 'bo4', 7);
    for (let seat = 0; seat < 4; seat++) {
      const v = viewFor(g, seat);
      expect(v.dealerDraw!.dealer).toBe((g.dealer - seat + 4) % 4);
      expect(v.dealerDraw!.rounds[0][0]).toEqual({ player: (0 - seat + 4) % 4, card: g.dealerDraw!.rounds[0][0].card });
    }
  });
});

describe('dealer after each hand', () => {
  // Bo 4, dealer = seat 3 (team 1). Seat 0 (team 0) bid 6; one trick left.
  const last = (rules = RULES, over: Partial<Parameters<typeof playingState>[0]> = {}) => {
    const s = playingState({ rules, trump: 'S', bidder: 0, bid: 6, hands: [['S14'], ['H7'], ['H8'], ['H9']], tricksPlayed: 8, ...over });
    return { ...s, dealer: 3 };
  };
  const finish = (s: GameState) => applyAction(s, { type: 'END_REVIEW' });

  it("the dealer's team lost the hand (0 points) → the same dealer deals again", () => {
    const s = finish(play(last(RULES, { tricksWon: [5, 3] }), 'S14', 'H7', 'H8', 'H9')); // team 0 makes 6
    expect(s.lastResult?.points).toEqual([6, 0]);
    expect(nextDealer(s)).toBe(3);
    expect(applyAction(s, { type: 'NEXT_HAND' }).dealer).toBe(3);
  });

  it("the dealer's team won the hand (scored) → the deal passes to the right, to the losing team", () => {
    const s = finish(play(last(RULES, { tricksWon: [4, 4] }), 'S14', 'H7', 'H8', 'H9')); // team 0 fails: 12 to team 1
    expect(s.lastResult?.points).toEqual([0, 12]);
    const next = applyAction(s, { type: 'NEXT_HAND' });
    expect(next.dealer).toBe(0); // seat 0: right of seat 3, on the losing team
    expect(next.currentPlayer).toBe(1);
  });

  it("caught reneging counts as a loss for the dealer's team", () => {
    // seat 3 (dealer, team 1) reneges and is caught: team 1 scores 0 → seat 3 deals again
    let s = playingState({
      trump: 'S', bidder: 0, bid: 6, tricksPlayed: 6, tricksWon: [4, 2],
      hands: [['H14', 'C14', 'D14'], ['H9', 'C9', 'D9'], ['H8', 'C8', 'D8'], ['H7', 'D7', 'C7']],
    });
    s = { ...s, dealer: 3 };
    s = play(s, 'H14', 'H9', 'H8', 'D7'); // seat 3 holds H7 but plays D7
    s = play(s, 'C14', 'C9', 'C8', 'H7'); // and shows H7 later
    s = applyAction(s, { type: 'CATCH', player: 0, accused: 3, trick: 0 });
    expect(s.lastResult?.points).toEqual([12, 0]);
    expect(nextDealer(s)).toBe(3);
  });

  it("'alwaysRotate' passes the deal every hand", () => {
    const rules = buildRules('default', { dealerRotation: 'alwaysRotate' });
    const s = finish(play(last(rules, { tricksWon: [5, 3] }), 'S14', 'H7', 'H8', 'H9'));
    expect(nextDealer(s)).toBe(0);
  });

  it('the score pad records who dealt each hand', () => {
    let g = createGame(buildRules(), 'bo4', 11);
    const dealers: number[] = [];
    let k = 1;
    while (g.phase !== 'gameOver' && g.history.length < 6) {
      if (g.phase === 'bidding' && g.bids.length === 0) dealers[g.handNumber] = g.dealer;
      const a = legalActions(g);
      k = (k * 1103515245 + 12345) & 0x7fffffff;
      g = applyAction(g, a[k % a.length]);
    }
    for (const h of g.history) expect(h.dealer).toBe(dealers[h.handNumber]);
  });
});
