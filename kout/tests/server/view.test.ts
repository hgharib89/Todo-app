import { describe, expect, it } from 'vitest';
import { applyAction, buildRules, createGame, GameState, RULES } from '../../src/engine';
import { HIDDEN, fromView, rotation, rulesHash, toRealAction, viewFor } from '../../server/src/view';
import { RateLimiter } from '../../server/src/rateLimit';
import { cleanName, isRoomCode, roomCode } from '../../server/src/codes';
import { playingState } from '../helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}

describe('per-player views (anti-cheat)', () => {
  const g = createGame(buildRules(), 'bo6', 99);

  it("never contains another player's cards, the seed, the renege record or the rules", () => {
    for (let seat = 0; seat < 6; seat++) {
      const v = viewFor(g, seat);
      expect(v.hands[0]).toEqual(g.hands[seat]);
      for (let k = 1; k < 6; k++) {
        expect(v.hands[k]).toHaveLength(g.hands[(seat + k) % 6].length);
        expect(v.hands[k].every((c) => c === HIDDEN)).toBe(true);
      }
      expect(v.seed).toBe(0);
      expect(v.rules).toBeNull();
      const json = JSON.stringify(v);
      for (let k = 0; k < 6; k++) if (k !== seat) for (const c of g.hands[k]) expect(json).not.toContain(`"${c}"`);
    }
  });

  it('hides the silent renege record', () => {
    let s = playingState({
      trump: 'S', bidder: 0, bid: 6, tricksPlayed: 6, tricksWon: [4, 2],
      hands: [['H14', 'C14', 'D14'], ['H9', 'D9', 'C9'], ['H8', 'C8', 'D8'], ['H7', 'C7', 'D7']],
    });
    s = play(s, 'H14', 'D9');
    expect(s.reneges).toHaveLength(1);
    for (let seat = 0; seat < 4; seat++) expect(viewFor(s, seat).reneges).toEqual([]);
  });

  it('rotates the table so every player is seat 0 and on team 0', () => {
    let s = createGame(buildRules('default', { firstDealer: 0 }), 'bo4', 5);
    s = applyAction(s, { type: 'BID', player: 1, value: 7 });
    for (const p of [2, 3, 0]) s = applyAction(s, { type: 'PASS', player: p });
    s = { ...s, scores: [10, 30] };
    const v1 = viewFor(s, 1); // the bidder's own view
    expect(v1.contract).toMatchObject({ bidder: 0, team: 0, value: 7 });
    expect(v1.scores).toEqual([30, 10]);
    expect(v1.dealer).toBe(3);
    expect(v1.bids[0]).toMatchObject({ player: 0, value: 7 });
    const v2 = viewFor(s, 2); // the bidder sits to seat 2's left (view seat 3)
    expect(v2.contract).toMatchObject({ bidder: 3, team: 1 });
    expect(v2.scores).toEqual([10, 30]);
    expect(v2.currentPlayer).toBe(3);
  });

  it('the rotated view still works with the engine (client-side legal moves)', () => {
    const s = createGame(buildRules(), 'bo4', 7);
    const me = s.currentPlayer;
    const v = fromView(viewFor(s, me), buildRules());
    expect(v.currentPlayer).toBe(0);
    expect(applyAction(v, { type: 'BID', player: 0, value: 6 }).bids[0].value).toBe(6);
  });

  it('maps client actions back to real seats, and a client can only act as itself', () => {
    expect(toRealAction({ type: 'PLAY', player: 3, card: 'H10' }, 2, 4)).toEqual({ type: 'PLAY', player: 2, card: 'H10' });
    expect(toRealAction({ type: 'CATCH', accused: 1, trick: 2 }, 2, 4)).toEqual({ type: 'CATCH', player: 2, accused: 3, trick: 2 });
    expect(toRealAction({ type: 'BID', value: 7 }, 5, 6)).toEqual({ type: 'BID', player: 5, value: 7 });
    expect(toRealAction({ type: 'JOKER_ASK' }, 1, 4)).toEqual({ type: 'JOKER_ASK', player: 1 });
    for (const bad of [null, 'PLAY', { type: 'HACK' }, { type: 'PLAY', card: 42 }, { type: 'PLAY', card: '<script>' }, { type: 'BID', value: 'x' }, { type: 'CATCH', accused: 9, trick: 0 }, { type: 'BAWN', accept: 'yes' }]) {
      expect(toRealAction(bad, 0, 4)).toBeNull();
    }
  });

  it('rotation helpers are inverse and flip teams for odd seats', () => {
    for (let seat = 0; seat < 6; seat++) {
      const r = rotation(seat, 6);
      for (let s = 0; s < 6; s++) expect(r.toReal(r.toView(s))).toBe(s);
      expect(r.toView(seat)).toBe(0);
      for (let s = 0; s < 6; s++) expect(r.toView(s) % 2).toBe(r.team((s % 2) as 0 | 1));
    }
  });

  it('rulesHash tells client and server whether they run the same rules', () => {
    expect(rulesHash(buildRules())).toBe(rulesHash(buildRules()));
    expect(rulesHash(buildRules('strict'))).not.toBe(rulesHash(buildRules()));
    expect(rulesHash(buildRules('default', { gameEnd: { ...RULES.gameEnd, targetScore: 55 } }))).not.toBe(rulesHash(buildRules()));
  });
});

describe('rate limiting, codes and names', () => {
  it('token bucket allows bursts, then refills over time', () => {
    let t = 0;
    const rl = new RateLimiter(5, 2, () => t);
    for (let i = 0; i < 5; i++) expect(rl.take()).toBe(true);
    expect(rl.take()).toBe(false);
    t += 500; // +1 token
    expect(rl.take()).toBe(true);
    expect(rl.take()).toBe(false);
  });

  it('room codes are 6 easy-to-read characters', () => {
    for (let i = 0; i < 50; i++) {
      const c = roomCode();
      expect(isRoomCode(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(isRoomCode('abc')).toBe(false);
  });

  it('player names are cleaned', () => {
    expect(cleanName('  أبو فهد  ', 'x')).toBe('أبو فهد');
    expect(cleanName('a‮b\u0000c', 'x')).toBe('abc');
    expect(cleanName('x'.repeat(40), 'x')).toHaveLength(16);
    expect(cleanName(42, 'لاعب')).toBe('لاعب');
    expect(cleanName('   ', 'لاعب')).toBe('لاعب');
  });
});
