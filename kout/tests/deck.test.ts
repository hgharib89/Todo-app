import { describe, expect, it } from 'vitest';
import { buildDeck, buildRules, createGame, normalizeCardId, RULES, suitOf, rankOf } from '../src/engine';

describe('deck building', () => {
  it('Bo6: 52 cards + 2 jokers = 54, all unique', () => {
    const d = buildDeck(RULES, 'bo6');
    expect(d).toHaveLength(54);
    expect(new Set(d).size).toBe(54);
    expect(d).toContain('XR');
    expect(d).toContain('XB');
    expect(d).toContain('S2');
    expect(d).toContain('H14');
  });

  it('Bo4: removes 2–5, the 6♦ and the 6♣, keeps the 6♠ and 6♥, adds jokers = 36 cards', () => {
    expect(RULES.bo4Removed6s).toEqual(['6D', '6C']);
    const d = buildDeck(RULES, 'bo4');
    expect(d).toHaveLength(36);
    expect(new Set(d).size).toBe(36);
    for (const c of d) {
      const r = rankOf(c);
      if (r !== null) expect(r).toBeGreaterThanOrEqual(6);
    }
    expect(d).not.toContain('D6');
    expect(d).not.toContain('C6');
    expect(d).toContain('S6');
    expect(d).toContain('H6');
    expect(d).toContain('XR');
    expect(d).toContain('XB');
    expect(d.filter((c) => suitOf(c) === 'D')).toHaveLength(8);
    expect(d.filter((c) => suitOf(c) === 'C')).toHaveLength(8);
    expect(d.filter((c) => suitOf(c) === 'S')).toHaveLength(9);
    expect(d.filter((c) => suitOf(c) === 'H')).toHaveLength(9);
  });

  it.each(['bo6', 'bo4'] as const)('%s deals 9 cards to each player, no duplicates', (mode) => {
    const g = createGame(buildRules(), mode, 42);
    const n = mode === 'bo6' ? 6 : 4;
    expect(g.hands).toHaveLength(n);
    for (const h of g.hands) expect(h).toHaveLength(9);
    const all = g.hands.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(buildDeck(g.rules, mode).sort());
  });

  it('dealing is deterministic per seed and differs across seeds', () => {
    const a = createGame(buildRules(), 'bo6', 7);
    const b = createGame(buildRules(), 'bo6', 7);
    const c = createGame(buildRules(), 'bo6', 8);
    expect(a.hands).toEqual(b.hands);
    expect(a.hands).not.toEqual(c.hands);
  });

  it('the removed Bo 4 sixes are configurable (bo4Removed6s)', () => {
    expect(buildDeck(buildRules('default', { bo4Removed6s: [] }), 'bo4')).toHaveLength(38);
    const red = buildDeck(buildRules('default', { bo4Removed6s: ['6H', '6D'] }), 'bo4');
    expect(red).toHaveLength(36);
    expect(red).toContain('C6');
    expect(red).not.toContain('D6');
    // bo4Removed6s only affects Bo 4
    expect(buildDeck(RULES, 'bo6')).toContain('H6');
  });

  it('removeCards accepts both card id forms (H6 and 6H)', () => {
    expect(normalizeCardId('6H')).toBe('H6');
    expect(normalizeCardId('10C')).toBe('C10');
    expect(normalizeCardId('S14')).toBe('S14');
    const r = buildRules('default', { bo4Removed6s: [], modes: { ...RULES.modes, bo4: { ...RULES.modes.bo4, removeCards: ['6S', 'D6'] } } });
    const d = buildDeck(r, 'bo4');
    expect(d).toHaveLength(36);
    expect(d).not.toContain('S6');
    expect(d).not.toContain('D6');
  });
});
