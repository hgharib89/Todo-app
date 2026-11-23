// The joker rules of the real game (rules.config.ts → jokers, trumpPowerOrder):
//  1. both jokers beat the trump Ace: red (big) › black (small) › trump Ace › other trumps › other suits
//  2. الجوكر المحترق: the red joker played before the black one (this hand) is burned — no value, cannot win
//  3. a trick can never be started with a joker
import { describe, expect, it } from 'vitest';
import { RULES, applyAction, buildDeck, buildRules, canLeadJoker, createGame, GameState, isJoker, jokerBurns, legalPlays, playerView } from '../src/engine';
import { chooseBotAction, type Difficulty } from '../src/bots';
import { solveCandidates } from '../src/bots/dd';
import { playingState, Setup } from './helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
/** every card not in a hand counts as played (so the bots know the whole position) */
function position(o: Setup): GameState {
  const s = playingState(o);
  const inHands = new Set(o.hands.flat());
  return { ...s, playedCards: buildDeck(s.rules, s.mode).filter((c) => !inHands.has(c)) };
}

describe('1. ranking: both jokers beat the trump Ace', () => {
  it('the config order is red › black › trump Ace › K …', () => {
    expect(RULES.trumpPowerOrder.slice(0, 4)).toEqual(['XR', 'XB', 14, 13]);
  });
  it('the black joker beats the trump Ace', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H14'], ['S14'], ['XB'], ['H8']] }), 'H14', 'S14', 'XB', 'H8');
    expect(s.lastTrick?.winner).toBe(2);
  });
  it('the red joker beats the black joker and the trump Ace once the black is out', () => {
    // black joker played in an earlier trick
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, played: ['XB'], hands: [['H14'], ['S14'], ['XR'], ['H8']] }), 'H14', 'S14', 'XR', 'H8');
    expect(s.lastTrick?.winner).toBe(2);
    expect(s.lastTrick?.plays[2].burned).toBeUndefined();
  });
});

describe('2. الجوكر المحترق: the red joker before the black one is burned', () => {
  it('burned when the black joker has not been played at all: no value, cannot win, marked burned', () => {
    let s = playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H7', 'C7'], ['XR', 'C8'], ['H9', 'C9'], ['XB', 'C10']] });
    expect(jokerBurns(s, 'XR')).toBe(true);
    expect(jokerBurns(s, 'XB')).toBe(false); // the black joker never burns
    s = play(s, 'H7', 'XR');
    expect(s.trick.plays[1]).toMatchObject({ card: 'XR', cancelled: true, burned: true });
    s = play(s, 'H9', 'C10');
    expect(s.lastTrick?.winner).toBe(2); // the 9♥ wins, the burned red joker does not
  });

  it('a burned red joker even loses to a later black joker in the same trick', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H7'], ['XR'], ['H9'], ['XB']] }), 'H7', 'XR', 'H9', 'XB');
    expect(s.lastTrick?.plays[1].burned).toBe(true);
    expect(s.lastTrick?.plays[3].burned).toBeUndefined();
    expect(s.lastTrick?.winner).toBe(3);
  });

  it('not burned when the black joker was played earlier in the same trick: the red joker wins', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H7'], ['XB'], ['XR'], ['S14']] }), 'H7', 'XB', 'XR', 'S14');
    expect(s.lastTrick?.plays[2]).toMatchObject({ card: 'XR', cancelled: false });
    expect(s.lastTrick?.plays[2].burned).toBeUndefined();
    expect(s.lastTrick?.winner).toBe(2);
  });

  it('not burned when the black joker was played in an earlier trick', () => {
    let s = playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H7', 'D7'], ['XB', 'D8'], ['H9', 'XR'], ['H8', 'D9']] });
    s = play(s, 'H7', 'XB', 'H9', 'H8'); // trick 1: the black joker wins
    expect(s.lastTrick?.winner).toBe(1);
    expect(jokerBurns(s, 'XR')).toBe(false);
    s = play(s, 'D8', 'XR', 'D9', 'D7'); // seat 1 (the winner) leads
    expect(s.lastTrick?.plays[1]).toMatchObject({ card: 'XR', cancelled: false });
    expect(s.lastTrick?.winner).toBe(2);
  });

  it('a forced joker lead is void («ملغي»), not burned', () => {
    let s = playingState({ trump: 'S', bidder: 1, bid: 6, leader: 0, hands: [['XR'], ['H7'], ['H12'], ['D14']] });
    s = play(s, 'XR');
    expect(s.trick.plays[0].cancelled).toBe(true);
    expect(s.trick.plays[0].burned).toBeUndefined();
  });

  it('the burned flag reaches every player (playerView)', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: [['H7', 'C7'], ['XR', 'C8'], ['H9', 'C9'], ['XB', 'C10']] }), 'H7', 'XR');
    for (const seat of [0, 1, 2, 3]) expect(playerView(s, seat).trick.plays[1].burned).toBe(true);
  });

  it('the rule can be switched off in the config (burnBigJokerBeforeSmall = false)', () => {
    const rules = buildRules('default', { jokers: { burnBigJokerBeforeSmall: false } });
    const s = play(playingState({ rules, trump: 'S', bidder: 0, bid: 6, hands: [['H7'], ['XR'], ['H9'], ['XB']] }), 'H7', 'XR', 'H9', 'XB');
    expect(s.lastTrick?.winner).toBe(1);
  });
});

describe('3. a trick can never be started with a joker', () => {
  const HANDS = [
    ['XR', 'XB', 'H10', 'C7'],
    ['H12', 'H7', 'D9', 'S6'],
    ['C14', 'S12', 'D7', 'H8'],
    ['D8', 'C9', 'S7', 'H9'],
  ];
  it('no joker lead for any bid, for the bidder, partner or opponents, in every preset, even after all trumps are out', () => {
    expect(RULES.jokers.jokerLeadAllowed).toBe(false);
    const allTrumps = buildDeck(RULES, 'bo4').filter((c) => c.startsWith('S'));
    for (const preset of ['default', 'strict', 'stricter', 'relaxed'] as const) {
      for (const bid of [5, 6, 7, 8, 9]) {
        for (const bidder of [0, 1, 2]) {
          const s = playingState({ preset, trump: 'S', bidder, bid, leader: 0, hands: HANDS, played: allTrumps, bidderHeldUnlockCard: false });
          expect(legalPlays(s)).toEqual(['H10', 'C7']);
          expect(canLeadJoker(s, 0, 'XR')).toBe(false);
          expect(canLeadJoker(s, 0, 'XB')).toBe(false);
        }
      }
    }
  });
  it('jokers can still be played on a trick someone else started', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 9, leader: 3, hands: HANDS }), 'D8');
    expect(legalPlays(s)).toEqual(expect.arrayContaining(['XR', 'XB']));
  });
  it('only jokers left: the player must lead one, and it is void (the next card sets the suit)', () => {
    let s = playingState({ trump: 'S', bidder: 0, bid: 9, hands: [['XR', 'XB'], ['H7', 'C7'], ['H8', 'C8'], ['H9', 'C9']] });
    expect(legalPlays(s).sort()).toEqual(['XB', 'XR']);
    s = play(s, 'XB');
    expect(s.trick.plays[0].cancelled).toBe(true);
    expect(s.trick.ledSuit).toBeNull();
    s = play(s, 'C7', 'C8', 'C9');
    expect(s.lastTrick?.winner).toBe(3);
  });
});

describe('the bots know the new joker rules', () => {
  it('no bot ever starts a trick with a joker unless it holds nothing else (full games, every level)', () => {
    for (const level of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const rng = seeded(level.length * 7 + 3);
      let s = createGame(buildRules(), 'bo4', 11);
      let guard = 0;
      let leads = 0;
      while (s.phase !== 'gameOver' && guard++ < 160) {
        const a = chooseBotAction(s, level, rng, { deals: 8, timeMs: 200 });
        if (a.type === 'PLAY' && s.trick.plays.length === 0) {
          leads++;
          if (isJoker(a.card)) expect(s.hands[a.player].every(isJoker)).toBe(true);
        }
        s = applyAction(s, a);
      }
      expect(leads).toBeGreaterThan(5);
    }
  }, 120000);

  it('with both jokers, Hard plays the black one to win the trick (the red one would burn)', () => {
    // seat 0 (bidder's team) is last to play on the opponents' trump Ace; it needs this trick
    let s = position({ trump: 'S', bidder: 0, bid: 7, leader: 1, tricksPlayed: 6, tricksWon: [4, 2], hands: [['XR', 'XB', 'C7'], ['S14', 'D7', 'D8'], ['H7', 'C8', 'C9'], ['S13', 'D9', 'D10']] });
    s = play(s, 'S14', 'C8', 'S13');
    expect(chooseBotAction(s, 'hard', seeded(1), { deals: 40 })).toEqual({ type: 'PLAY', player: 0, card: 'XB' });
  });

  it('Hard does not throw away its red joker while the black one is still out (it would burn for nothing)', () => {
    // bid 8: the bidders will have 6 after this trick and need both of the last two; seat 0 is void in
    // hearts. Burning the red joker now gives them the hand; kept, it beats the black joker that seat 3
    // must play by the last trick at the latest (seat 0 plays after seat 3), and breaks the bid.
    let s = position({ trump: 'S', bidder: 1, bid: 8, leader: 1, tricksPlayed: 6, tricksWon: [1, 5], hands: [['XR', 'C7', 'D7'], ['H14', 'D8', 'D9'], ['H7', 'C8', 'C10'], ['H8', 'XB', 'C9']] });
    s = play(s, 'H14', 'H7', 'H8');
    for (const seed of [1, 2, 3]) {
      const a = chooseBotAction(s, 'hard', seeded(seed), { deals: 40 });
      expect(a.type === 'PLAY' && a.card).not.toBe('XR');
    }
  });

  it('the exact solver scores a burned red joker as worthless', () => {
    // seat 0 is last on the opponents' heart and holds both jokers: the black one wins this trick and
    // keeps the red one alive for the last; the red one first would burn and lose a trick
    let t = position({ trump: 'S', bidder: 0, bid: 7, leader: 1, tricksPlayed: 7, tricksWon: [5, 2], hands: [['XR', 'XB'], ['H14', 'H13'], ['H7', 'H6'], ['H8', 'H9']] });
    t = play(t, 'H14', 'H7', 'H8');
    const r = solveCandidates(t, 0, ['XR', 'XB'], 1);
    expect(r.complete).toBe(true);
    expect(r.values.get('XB')!).toBeGreaterThan(r.values.get('XR')!);
  });
});
