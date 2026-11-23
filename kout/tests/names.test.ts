import { describe, expect, it } from 'vitest';
import { BOT_NAMES, botNamesFor } from '../src/bots/names';
import { SEAT_NAMES } from '../src/ui/layout';

describe('bot names', () => {
  it('are خليفة، محمد، حمدان، راشد، سلطان', () => {
    expect([...BOT_NAMES]).toEqual(['خليفة', 'محمد', 'حمدان', 'راشد', 'سلطان']);
  });

  it('offline tables: Bo 4 uses the first three, Bo 6 all five', () => {
    expect(SEAT_NAMES.bo4).toEqual(['أنت', 'خليفة', 'محمد', 'حمدان']);
    expect(SEAT_NAMES.bo6).toEqual(['أنت', 'خليفة', 'محمد', 'حمدان', 'راشد', 'سلطان']);
    // avatar initials come from the names
    expect(SEAT_NAMES.bo6.slice(1).map((n) => n[0])).toEqual(['خ', 'م', 'ح', 'ر', 'س']);
  });

  it('online fill-ins: Bo 4 takes the first three, Bo 6 up to five, in order', () => {
    expect(botNamesFor('bo4', 3)).toEqual(['خليفة', 'محمد', 'حمدان']);
    expect(botNamesFor('bo4', 1)).toEqual(['خليفة']);
    expect(botNamesFor('bo6', 5)).toEqual(['خليفة', 'محمد', 'حمدان', 'راشد', 'سلطان']);
  });

  it('never gives a bot the same name as a person at the table', () => {
    expect(botNamesFor('bo4', 3, ['محمد'])).toEqual(['خليفة', 'حمدان', 'راشد']);
    const all = botNamesFor('bo6', 5, ['سلطان']);
    expect(all).toHaveLength(5);
    expect(all).not.toContain('سلطان');
    expect(new Set(all).size).toBe(5);
  });
});
