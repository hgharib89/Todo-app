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

describe('rules text for the first lead and the Bo 4 deck', () => {
  it('describes the first lead from rules.firstLead', async () => {
    const { describeFirstLead } = await import('../src/ui/rulesText');
    expect(describeFirstLead(RULES)).toContain('على يمينه يبدأ أول ورقة');
    expect(describeFirstLead(buildRules('default', { firstLead: 'bidder' }))).toContain('ويبدأ أول ورقة');
  });
  it('lists the removed Bo 4 sixes from rules.bo4Removed6s', async () => {
    const { describeRemovedCards } = await import('../src/ui/rulesText');
    expect(describeRemovedCards(RULES, 'bo4')).toBe('٦ هاص و٦ شريحة');
    expect(describeRemovedCards(buildRules('default', { bo4Removed6s: ['6D'] }), 'bo4')).toBe('٦ ديمن');
  });
});

describe('rules text for reneging and catching', () => {
  it('is generated from rules.renege', async () => {
    const { describeRenege } = await import('../src/ui/rulesText');
    const t = describeRenege(RULES).join(' ');
    expect(t).toContain('لآخر ورقة');
    expect(t).toContain('٢ أضعاف الطلب');
    expect(t).toContain('صعب ١٠٠٪، متوسط ٦٠٪، سهل ٢٥٪');
    const off = describeRenege(buildRules('default', { renege: { ...RULES.renege, allowRenege: false } })).join(' ');
    expect(off).toContain('تمنع القطع');
  });
  it('catch messages name the reneger, the trick and the points', async () => {
    const { catchMessage } = await import('../src/ui/panels');
    const { createGame } = await import('../src/engine');
    const g = createGame(RULES, 'bo4', 1);
    expect(catchMessage(g, { catcher: 0, accused: 1, trick: 2, success: true, suit: 'H' }, [12, 0])).toBe('خالد قطع في الأكلة ٣ (ما لحق هاص) — صاده أنت: +١٢ لنا');
    expect(catchMessage(g, { catcher: 0, accused: 1, trick: 2, success: false, suit: null })).toContain('صاد غلط');
  });
});
