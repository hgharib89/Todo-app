import { describe, expect, it } from 'vitest';
import { applyAction, buildRules, canLeadJoker, legalPlays, GameState, JokerPresetId, JokerRules } from '../src/engine';
import { playingState, Setup } from './helpers';

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}

const HANDS = [
  ['XR', 'XB', 'H10', 'C7'],
  ['H12', 'H7', 'D9', 'S6'],
  ['C14', 'S12', 'D7', 'H8'],
  ['D8', 'C9', 'S7', 'H9'],
];

// The real game never lets a joker be led (jokers.jokerLeadAllowed = false, see jokerRules.test.ts).
// The lead-permission machinery stays in rules.config.ts as an option; these tests switch it back on
// (and the burned-joker rule off) to keep that option covered.
const LEAD_ON = { jokerLeadAllowed: true, burnBigJokerBeforeSmall: false };
const leadOn = (preset: JokerPresetId = 'default', jokers: Partial<JokerRules> = {}) => buildRules(preset, { jokers: { ...LEAD_ON, ...jokers } });

function st(over: Partial<Setup> = {}): GameState {
  return playingState({ rules: leadOn(), trump: 'S', bidder: 0, bid: 5, hands: HANDS, ...over });
}

describe('joker lead — default preset with jokerLeadAllowed = true (option)', () => {
  it('bid 9 → either joker may be led', () => {
    expect(legalPlays(st({ bid: 9 }))).toEqual(expect.arrayContaining(['XR', 'XB']));
  });
  it('bid 8 → only the red joker may be led', () => {
    const l = legalPlays(st({ bid: 8 }));
    expect(l).toContain('XR');
    expect(l).not.toContain('XB');
  });
  it('bid 5–7 → no joker lead', () => {
    for (const bid of [5, 6, 7]) {
      const l = legalPlays(st({ bid }));
      expect(l).not.toContain('XR');
      expect(l).not.toContain('XB');
    }
  });
  it('bid permission is only for the bidding team (partner of bidder too)', () => {
    // seat 2 is the bidder's partner, seat 1 is an opponent
    const partner = st({ bid: 9, bidder: 2, leader: 0 });
    expect(canLeadJoker(partner, 0, 'XB')).toBe(true);
    const opp = st({ bid: 9, bidder: 1, leader: 0 });
    expect(canLeadJoker(opp, 0, 'XR')).toBe(false);
  });
  it('unlocked once trump A, K, Q, J have all been played', () => {
    expect(canLeadJoker(st({ played: ['S14', 'S13', 'S12'] }), 0, 'XR')).toBe(false);
    const s = st({ played: ['S14', 'S13', 'S12', 'S11'] });
    expect(canLeadJoker(s, 0, 'XR')).toBe(true);
    expect(canLeadJoker(s, 0, 'XB')).toBe(true);
    expect(canLeadJoker({ ...s, contract: { ...s.contract!, team: 1, bidder: 1 } }, 0, 'XB')).toBe(true);
  });
  it('legal joker lead counts as trump: others must play trump if able (or a joker)', () => {
    const s = play(st({ bid: 9 }), 'XB');
    expect(s.trick.ledSuit).toBe('S');
    expect(legalPlays(s)).toEqual(['S6']);
  });
  it('legally led red joker wins the trick', () => {
    const s = play(st({ bid: 8 }), 'XR', 'S6', 'S12', 'S7');
    expect(s.lastTrick?.winner).toBe(0);
  });
});

describe('illegal forced joker lead (cancel)', () => {
  const forced = (hands: string[][]) => playingState({ trump: 'S', bidder: 1, bid: 6, leader: 0, hands });

  it('a joker as last card may (must) be led even if illegal', () => {
    const s = forced([['XB'], ['H12'], ['C14'], ['D8']]);
    expect(legalPlays(s)).toEqual(['XB']);
  });

  it('cancelled joker cannot win; the next card sets the led suit', () => {
    let s = forced([['XR'], ['H7'], ['H12'], ['D14']]);
    s = play(s, 'XR');
    expect(s.trick.plays[0].cancelled).toBe(true);
    expect(s.trick.ledSuit).toBeNull();
    expect(legalPlays(s)).toEqual(['H7']);
    s = play(s, 'H7');
    expect(s.trick.ledSuit).toBe('H');
    s = play(s, 'H12', 'D14');
    expect(s.lastTrick?.winner).toBe(2); // Q♥ wins, cancelled red joker does not
  });

  it('if the next player also plays a joker it is cancelled too; following card sets the suit', () => {
    let s = forced([['XR'], ['XB', 'H7'], ['D7'], ['D14']]);
    s = play(s, 'XR', 'XB');
    expect(s.trick.plays.map((p) => p.cancelled)).toEqual([true, true]);
    s = play(s, 'D7');
    expect(s.trick.ledSuit).toBe('D');
    s = play(s, 'D14');
    expect(s.lastTrick?.winner).toBe(3);
  });

  it('both jokers forced-led: still only one is offered when one is legal', () => {
    const s = playingState({ rules: leadOn(), trump: 'S', bidder: 0, bid: 8, hands: [['XR', 'XB'], ['H7'], ['H8'], ['H9']] });
    expect(legalPlays(s)).toEqual(['XR']);
  });

  it("'asTrump' resolution makes a forced joker lead count as trump", () => {
    const rules = leadOn('default', { illegalForcedLead: 'asTrump' });
    let s = playingState({ rules, trump: 'S', bidder: 1, bid: 6, leader: 0, hands: [['XR'], ['S6', 'H7'], ['H12'], ['D14']] });
    s = play(s, 'XR');
    expect(s.trick.plays[0].cancelled).toBe(false);
    expect(s.trick.ledSuit).toBe('S');
    expect(legalPlays(s)).toEqual(['S6']);
    s = play(s, 'S6', 'H12', 'D14');
    expect(s.lastTrick?.winner).toBe(0);
  });
});

describe('joker presets (with jokerLeadAllowed = true)', () => {
  const lead = (preset: JokerPresetId, over: Partial<Setup> = {}) =>
    legalPlays(playingState({ rules: leadOn(preset), trump: 'S', bidder: 0, bid: 5, hands: HANDS, ...over }));

  it('strict: only bid 8/9 allows joker lead (played trumps do not unlock)', () => {
    expect(lead('strict', { played: ['S14', 'S13', 'S12', 'S11'] })).not.toContain('XR');
    expect(lead('strict', { bid: 9 })).toEqual(expect.arrayContaining(['XR', 'XB']));
    expect(lead('strict', { bid: 8 })).toContain('XR');
    expect(lead('strict', { bid: 8 })).not.toContain('XB');
  });

  it('stricter: ALL trump cards must be played unless bid 8/9', () => {
    expect(lead('stricter', { played: ['S14', 'S13', 'S12', 'S11'] })).not.toContain('XR');
    // Bo4 trump suit = S6..S14 (9 cards)
    const all = ['S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14'];
    expect(lead('stricter', { played: all })).toEqual(expect.arrayContaining(['XR', 'XB']));
    expect(lead('stricter', { played: all.slice(1) })).not.toContain('XB');
    expect(lead('stricter', { bid: 9 })).toContain('XB');
  });

  it('stricter in Bo6 needs all 13 trump cards', () => {
    const all = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((r) => `S${r}`);
    expect(lead('stricter', { mode: 'bo6', hands: [...HANDS, [], []], played: all.slice(4) })).not.toContain('XR');
    expect(lead('stricter', { mode: 'bo6', hands: [...HANDS, [], []], played: all })).toContain('XR');
  });

  it('relaxed: only the trump Ace must be played', () => {
    expect(lead('relaxed', { played: [] })).not.toContain('XR');
    expect(lead('relaxed', { played: ['S14'] })).toEqual(expect.arrayContaining(['XR', 'XB']));
  });

  it('relaxed: if the bidder did not hold the trump Ace, jokers can be led any time', () => {
    expect(lead('relaxed', { bidderHeldUnlockCard: false })).toEqual(expect.arrayContaining(['XR', 'XB']));
  });

  it('relaxed: bidderHeldUnlockCard is computed when trump is chosen', () => {
    const g = playingState({ rules: leadOn('relaxed'), trump: 'S', bidder: 0, bid: 5, hands: HANDS });
    const choosing = { ...g, phase: 'choosingTrump' as const, currentPlayer: 0 };
    const a = applyAction(choosing, { type: 'CHOOSE_TRUMP', player: 0, suit: 'S' });
    expect(a.contract?.bidderHeldUnlockCard).toBe(false);
    const withAce = { ...choosing, hands: [['S14', ...HANDS[0]], ...HANDS.slice(1)] };
    const b = applyAction(withAce, { type: 'CHOOSE_TRUMP', player: 0, suit: 'S' });
    expect(b.contract?.bidderHeldUnlockCard).toBe(true);
  });

  it('default preset is not affected by bidderHeldUnlockCard', () => {
    expect(lead('default', { bidderHeldUnlockCard: false })).not.toContain('XR');
  });

  it('bid permissions table is editable', () => {
    const rules = leadOn('default', { leadAllowedByBid: { 7: { red: false, black: true } } });
    const l = legalPlays(playingState({ rules, trump: 'S', bidder: 0, bid: 7, hands: HANDS }));
    expect(l).toContain('XB');
    expect(l).not.toContain('XR');
  });

  it('required trump list is editable', () => {
    const rules = leadOn('default', { leadUnlockedWhenTrumpsPlayed: ['A', 'K'] });
    expect(legalPlays(playingState({ rules, trump: 'S', bidder: 0, bid: 5, hands: HANDS, played: ['S14', 'S13'] }))).toContain('XR');
  });
});

describe('joker option — ledJokerCountsAsTrump (with jokerLeadAllowed = true)', () => {
  const off = () => playingState({ rules: leadOn('default', { ledJokerCountsAsTrump: false }), trump: 'S', bidder: 0, bid: 9, hands: HANDS });

  it('true (default): a legally led joker sets trump as the led suit', () => {
    const s = play(st({ bid: 9 }), 'XB');
    expect(s.trick.ledSuit).toBe('S');
    expect(legalPlays(s)).toEqual(['S6']);
  });

  it('false: a legally led joker sets no suit, so the next player may play anything', () => {
    const s = play(off(), 'XB');
    expect(s.trick.ledSuit).toBeNull();
    expect(s.trick.plays[0].cancelled).toBe(false);
    expect([...legalPlays(s)].sort()).toEqual([...HANDS[1]].sort());
  });

  it('false: the first normal card after the joker sets the led suit', () => {
    const s = play(off(), 'XB', 'H12');
    expect(s.trick.ledSuit).toBe('H');
    expect(legalPlays(s)).toEqual(['H8']); // seat 2 must follow hearts, not trump
  });

  it('false: the led joker still keeps its trump power and wins', () => {
    const s = play(off(), 'XB', 'H12', 'H8', 'H9');
    expect(s.lastTrick?.winner).toBe(0);
    expect(s.lastTrick?.plays[0].cancelled).toBe(false);
  });
});
