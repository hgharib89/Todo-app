import { describe, expect, it } from 'vitest';
import { applyAction, bidOptions, buildRules, createGame, GameState, nextSeat } from '../src/engine';

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
    expect(bidOptions(g).values).toEqual([5, 6, 7, 8, 9]);
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
    g = applyAction(g, { type: 'BID', player: 0, value: 5 });
    expect(g.contract).toMatchObject({ bidder: 0, value: 5, forced: true });
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

  it('highest bidder chooses trump and leads the first trick', () => {
    let g = game('bo4', 0);
    g = applyAction(g, { type: 'PASS', player: 1 });
    g = applyAction(g, { type: 'BID', player: 2, value: 5 });
    g = applyAction(g, { type: 'PASS', player: 3 });
    g = applyAction(g, { type: 'PASS', player: 0 });
    expect(() => applyAction(g, { type: 'CHOOSE_TRUMP', player: 1, suit: 'S' })).toThrow();
    g = applyAction(g, { type: 'CHOOSE_TRUMP', player: 2, suit: 'H' });
    expect(g.phase).toBe('playing');
    expect(g.contract?.trump).toBe('H');
    expect(g.currentPlayer).toBe(2);
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
