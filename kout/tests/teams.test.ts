import { describe, expect, it } from 'vitest';
import { RULES, applyAction, buildRules, canLeadJoker, createGame, teamOf } from '../src/engine';
import { playingState } from './helpers';

const halves = buildRules('default', {
  modes: {
    bo6: { ...RULES.modes.bo6, teamLayout: 'halves' },
    bo4: { ...RULES.modes.bo4, teamLayout: 'halves' },
  },
});

describe('team layout (modes[*].teamLayout)', () => {
  it("'alternate' (default): partners on every other seat", () => {
    const g6 = createGame(buildRules(), 'bo6', 1);
    expect([0, 1, 2, 3, 4, 5].map((s) => teamOf(g6, s))).toEqual([0, 1, 0, 1, 0, 1]);
    const g4 = createGame(buildRules(), 'bo4', 1);
    expect([0, 1, 2, 3].map((s) => teamOf(g4, s))).toEqual([0, 1, 0, 1]);
  });

  it("'halves': the first half of the seats is one team", () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => teamOf(createGame(halves, 'bo6', 1), s))).toEqual([0, 0, 0, 1, 1, 1]);
    expect([0, 1, 2, 3].map((s) => teamOf(createGame(halves, 'bo4', 1), s))).toEqual([0, 0, 1, 1]);
  });

  const HANDS = [
    ['XR', 'XB', 'H10', 'C7'],
    ['H12', 'H7', 'D9', 'S6'],
    ['C14', 'S12', 'D7', 'H8'],
    ['D8', 'C9', 'S7', 'H9'],
  ];

  it('the engine uses the layout for bidding-team permissions', () => {
    // seat 1 bid 9: under 'halves' seat 0 is its partner and may lead a joker
    expect(canLeadJoker(playingState({ rules: halves, trump: 'S', bidder: 1, bid: 9, leader: 0, hands: HANDS }), 0, 'XB')).toBe(true);
    expect(canLeadJoker(playingState({ trump: 'S', bidder: 1, bid: 9, leader: 0, hands: HANDS }), 0, 'XB')).toBe(false);
  });

  it('the engine uses the layout to credit tricks', () => {
    let s = playingState({ rules: halves, trump: 'S', bidder: 0, bid: 5, leader: 1, hands: HANDS });
    for (const card of ['H12', 'H8', 'H9', 'H10']) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
    expect(s.lastTrick?.winner).toBe(1);
    expect(s.tricksWon).toEqual([1, 0]); // seat 1 is on team 0 under 'halves'
  });
});
