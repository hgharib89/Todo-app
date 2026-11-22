import { describe, expect, it } from 'vitest';
import { RULES, buildRules } from '../src/engine';
import { describeJokerLead, describeJokerPlay, presetDescription } from '../src/ui/rulesText';

describe('UI rule text is generated from rules.config.ts', () => {
  it('describes each preset from its config', () => {
    expect(presetDescription('default', RULES)).toBe('بوان: أي جوكر · ٨: الأحمر فقط · أو بعد نزول إكَه وشايب وبنت وولد الحكم');
    expect(presetDescription('strict', RULES)).toBe('بوان: أي جوكر · ٨: الأحمر فقط');
    expect(presetDescription('stricter', RULES)).toContain('كل أوراق الحكم');
    expect(presetDescription('relaxed', RULES)).toContain('ما عنده إكَه الحكم يجوز أي وقت');
  });

  it('follows edits to the config', () => {
    const r = buildRules('default', { jokers: { leadAllowedByBid: { 7: { red: false, black: true } }, leadUnlockedWhenTrumpsPlayed: ['A', 'K'] } });
    expect(describeJokerLead(r.jokers, r)).toBe('٧: الأسود فقط · أو بعد نزول إكَه وشايب الحكم');
    const off = buildRules('default', { jokers: { ledJokerCountsAsTrump: false, illegalForcedLead: 'asTrump', canPlayWhileHoldingLedSuit: false } });
    const on = describeJokerPlay(RULES.jokers);
    const changed = describeJokerPlay(off.jokers);
    on.forEach((t, i) => expect(changed[i]).not.toBe(t));
  });
});

describe('bidding panel and settings', () => {
  it('the bid panel shows 6–9 normally and adds Malzoom 5 only when forced', async () => {
    const { bidButtons } = await import('../src/ui/panels');
    expect(bidButtons(RULES, false)).toEqual([6, 7, 8, 9]);
    expect(bidButtons(RULES, true)).toEqual([5, 6, 7, 8, 9]);
  });
  it('Hard is the default bot difficulty', async () => {
    const { DEFAULT_SETTINGS, DIFFICULTY_LABELS } = await import('../src/ui/settings');
    expect(DEFAULT_SETTINGS.difficulty).toBe('hard');
    expect(Object.keys(DIFFICULTY_LABELS)).toEqual(['easy', 'medium', 'hard']);
  });
});
