import { describe, expect, it } from 'vitest';
import { buildDeck, buildRules, createGame, RULES, suitOf, rankOf } from '../src/engine';

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

  it('Bo4: removes 2–5 and red 6s, adds jokers = 36 cards', () => {
    const d = buildDeck(RULES, 'bo4');
    expect(d).toHaveLength(36);
    expect(new Set(d).size).toBe(36);
    for (const c of d) {
      const r = rankOf(c);
      if (r !== null) expect(r).toBeGreaterThanOrEqual(6);
    }
    expect(d).not.toContain('H6');
    expect(d).not.toContain('D6');
    expect(d).toContain('S6');
    expect(d).toContain('C6');
    expect(d).toContain('XR');
    expect(d).toContain('XB');
    expect(d.filter((c) => suitOf(c) === 'H')).toHaveLength(8);
    expect(d.filter((c) => suitOf(c) === 'S')).toHaveLength(9);
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

  it('deck follows the config (custom removals)', () => {
    const r = buildRules('default', { modes: { ...RULES.modes, bo4: { ...RULES.modes.bo4, removeCards: [] } } });
    expect(buildDeck(r, 'bo4')).toHaveLength(38);
  });
});
