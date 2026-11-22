import { describe, expect, it } from 'vitest';
import { applyAction, bidOptions, buildRules, createGame, GameState, legalPlays, nextSeat } from '../src/engine';

function game(mode: 'bo4' | 'bo6' = 'bo4', dealer = 0): GameState {
  return createGame(buildRules('default', { firstDealer: dealer }), mode, 3);
}

describe('bidding', () => {
  it('starts with the player to the dealer\'s right (counter-clockwise)', () => {
    const g = game('bo6', 2);
    expect(g.dealer).toBe(2);
    expect(g.currentPlayer).toBe(3);
  });

  it('bids must be higher; each player speaks once', () => {
    let g = game('bo4', 0);
    expect(bidOptions(g).values).toEqual([6, 7, 8, 9]);
    g = applyAction(g, { type: 'BID', player: 1, value: 6 });
    expect(bidOptions(g).values).toEqual([7, 8, 9]);
    expect(() => applyAction(g, { type: 'BID', player: 2, value: 6 })).toThrow();
    g = applyAction(g, { type: 'PASS', player: 2 });
    g = applyAction(g, { type: 'BID', player: 3, value: 7 });
    g = applyAction(g, { type: 'PASS', player: 0 });
    expect(g.phase).toBe('choosingTrump');
    expect(g.contract).toMatchObject({ bidder: 3, value: 7, team: 1, forced: false });
  });

  it('rejects out-of-turn actions', () => {
    const g = game('bo4', 0);
    expect(() => applyAction(g, { type: 'PASS', player: 2 })).toThrow();
  });

  it('all pass → dealer is forced to bid 5 (Malzoom) and cannot pass', () => {
    let g = game('bo4', 0);
    for (const p of [1, 2, 3]) g = applyAction(g, { type: 'PASS', player: p });
    expect(g.currentPlayer).toBe(0);
    const o = bidOptions(g);
    expect(o.canPass).toBe(false);
    expect(o.forced).toBe(true);
    expect(() => applyAction(g, { type: 'PASS', player: 0 })).toThrow();
    expect(o.values).toEqual([5, 6, 7, 8, 9]);
    g = applyAction(g, { type: 'BID', player: 0, value: 5 });
    expect(g.contract).toMatchObject({ bidder: 0, value: 5, forced: true });
  });

  it('minimum voluntary bid is 6: bid 5 is only allowed as the forced Malzoom', () => {
    expect(buildRules().bidding.minVoluntaryBid).toBe(6);
    expect(buildRules().bidding.malzoomBid).toBe(5);
    let g = game('bo4', 0);
    expect(bidOptions(g).values).not.toContain(5);
    expect(() => applyAction(g, { type: 'BID', player: 1, value: 5 })).toThrow();
    // nobody else can bid 5 later in the round either
    g = applyAction(g, { type: 'PASS', player: 1 });
    expect(bidOptions(g).values).toEqual([6, 7, 8, 9]);
    expect(() => applyAction(g, { type: 'BID', player: 2, value: 5 })).toThrow();
    // the dealer can bid 5 only once forced
    g = applyAction(g, { type: 'PASS', player: 2 });
    g = applyAction(g, { type: 'PASS', player: 3 });
    expect(bidOptions(g)).toMatchObject({ forced: true, values: [5, 6, 7, 8, 9] });
  });

  it('a dealer who is not forced cannot bid 5', () => {
    let g = game('bo4', 0);
    g = applyAction(g, { type: 'BID', player: 1, value: 6 });
    g = applyAction(g, { type: 'PASS', player: 2 });
    g = applyAction(g, { type: 'PASS', player: 3 });
    expect(bidOptions(g, 0)).toMatchObject({ forced: false, values: [7, 8, 9] });
    expect(() => applyAction(g, { type: 'BID', player: 0, value: 5 })).toThrow();
  });

  it('minVoluntaryBid and malzoomBid are configurable', () => {
    const base = buildRules().bidding;
    let g = createGame(buildRules('default', { firstDealer: 0, bidding: { ...base, minVoluntaryBid: 5 } }), 'bo4', 1);
    expect(bidOptions(g).values).toEqual([5, 6, 7, 8, 9]);
    g = createGame(buildRules('default', { firstDealer: 0, bidding: { ...base, minVoluntaryBid: 7, malzoomBid: 6 } }), 'bo4', 1);
    expect(bidOptions(g).values).toEqual([7, 8, 9]);
    for (const p of [1, 2, 3]) g = applyAction(g, { type: 'PASS', player: p });
    expect(bidOptions(g).values).toEqual([6, 7, 8, 9]);
    g = applyAction(g, { type: 'BID', player: 0, value: 6 });
    expect(g.contract).toMatchObject({ value: 6, forced: true });
  });

  it('forced dealer raising is configurable', () => {
    let g = createGame(buildRules('default', { firstDealer: 0, bidding: { ...buildRules().bidding, forcedDealerMayRaise: false } }), 'bo4', 1);
    for (const p of [1, 2, 3]) g = applyAction(g, { type: 'PASS', player: p });
    expect(bidOptions(g).values).toEqual([5]);
  });

  it('bidding 9 (Bawan) ends bidding immediately', () => {
    let g = game('bo6', 0);
    g = applyAction(g, { type: 'BID', player: 1, value: 9 });
    expect(g.phase).toBe('choosingTrump');
    expect(g.contract?.bidder).toBe(1);
  });

  it('the highest bidder chooses trump; the player to their right leads the first card', () => {
    expect(buildRules().firstLead).toBe('rightOfBidder');
    let g = game('bo4', 0);
    g = applyAction(g, { type: 'PASS', player: 1 });
    g = applyAction(g, { type: 'BID', player: 2, value: 6 });
    g = applyAction(g, { type: 'PASS', player: 3 });
    g = applyAction(g, { type: 'PASS', player: 0 });
    expect(() => applyAction(g, { type: 'CHOOSE_TRUMP', player: 1, suit: 'S' })).toThrow();
    expect(() => applyAction(g, { type: 'CHOOSE_TRUMP', player: 3, suit: 'S' })).toThrow();
    g = applyAction(g, { type: 'CHOOSE_TRUMP', player: 2, suit: 'H' });
    expect(g.phase).toBe('playing');
    expect(g.contract?.trump).toBe('H');
    expect(g.currentPlayer).toBe(3); // seat to the bidder's right (counter-clockwise next)
    expect(g.trick.leader).toBe(3);
    // the bidder may not lead
    expect(() => applyAction(g, { type: 'PLAY', player: 2, card: g.hands[2][0] })).toThrow();
  });

  it('first lead wraps around the table (Bo 6, bidder in the last seat)', () => {
    let g = game('bo6', 4); // seat 5 speaks first
    g = applyAction(g, { type: 'BID', player: 5, value: 9 });
    g = applyAction(g, { type: 'CHOOSE_TRUMP', player: 5, suit: 'S' });
    expect(g.currentPlayer).toBe(0);
  });

  it('after the first trick, the trick winner leads', () => {
    let g = game('bo4', 0);
    g = applyAction(g, { type: 'BID', player: 1, value: 9 });
    g = applyAction(g, { type: 'CHOOSE_TRUMP', player: 1, suit: 'S' });
    expect(g.currentPlayer).toBe(2);
    for (let i = 0; i < 4; i++) g = applyAction(g, { type: 'PLAY', player: g.currentPlayer, card: legalPlays(g)[0] });
    expect(g.tricks).toHaveLength(1);
    expect(g.currentPlayer).toBe(g.tricks[0].winner);
    expect(g.trick.leader).toBe(g.tricks[0].winner);
  });

  it.each([
    ['bidder', 2],
    ['rightOfDealer', 1],
    ['rightOfBidder', 3],
  ] as const)('firstLead = %s → seat %i leads (dealer 0, bidder 2)', (firstLead, leader) => {
    let g = createGame(buildRules('default', { firstDealer: 0, firstLead }), 'bo4', 3);
    g = applyAction(g, { type: 'PASS', player: 1 });
    g = applyAction(g, { type: 'BID', player: 2, value: 6 });
    g = applyAction(g, { type: 'PASS', player: 3 });
    g = applyAction(g, { type: 'PASS', player: 0 });
    g = applyAction(g, { type: 'CHOOSE_TRUMP', player: 2, suit: 'H' });
    expect(g.currentPlayer).toBe(leader);
  });

  it('without forcing, all-pass redeals with the next dealer', () => {
    let g = createGame(buildRules('default', { firstDealer: 0, bidding: { ...buildRules().bidding, forceDealerIfAllPass: false } }), 'bo4', 1);
    for (const p of [1, 2, 3, 0]) g = applyAction(g, { type: 'PASS', player: p });
    expect(g.phase).toBe('bidding');
    expect(g.dealer).toBe(1);
    expect(g.redeals).toBe(1);
  });

  it('nextSeat goes counter-clockwise and wraps', () => {
    expect(nextSeat({ numPlayers: 6 }, 5)).toBe(0);
    expect(nextSeat({ numPlayers: 4 }, 1)).toBe(2);
  });
});
