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
