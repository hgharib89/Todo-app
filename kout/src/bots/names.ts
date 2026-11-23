/** The bots' names, used by offline games and to fill empty seats online. Bo 4 uses the first three. */
export const BOT_NAMES = ['خليفة', 'محمد', 'حمدان', 'راشد', 'سلطان'] as const;

/** Names for `count` bot seats in a mode, skipping names already taken by people at the table. */
export function botNamesFor(mode: 'bo4' | 'bo6', count: number, taken: Iterable<string> = []): string[] {
  const used = new Set(taken);
  const preferred = mode === 'bo4' ? BOT_NAMES.slice(0, 3) : [...BOT_NAMES];
  // a person may already use one of them: fall back to the other bot names, then numbered ones
  const pool = [...preferred, ...BOT_NAMES.filter((n) => !preferred.includes(n))].filter((n) => !used.has(n));
  const out: string[] = [];
  for (let i = 0; out.length < count; i++) out.push(pool[i] ?? `${BOT_NAMES[i % BOT_NAMES.length]} ${i + 1}`);
  return out;
}
