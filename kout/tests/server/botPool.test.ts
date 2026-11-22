import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { buildRules, createGame, legalActions } from '../../src/engine';
import { BotPool } from '../../server/src/botPool';

describe('bot worker pool', () => {
  let pool: BotPool;
  beforeAll(async () => {
    // build the worker exactly like the production bundle does
    const out = join(mkdtempSync(join(tmpdir(), 'kout-')), 'botWorker.cjs');
    await build({ entryPoints: ['server/src/botWorker.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
    pool = new BotPool(2, out);
  });
  afterAll(() => pool.close());

  it('runs Hard-bot decisions in worker threads, always legal', async () => {
    expect(pool.size).toBe(2);
    const states = [1, 2, 3, 4, 5, 6].map((seed) => createGame(buildRules(), seed % 2 ? 'bo4' : 'bo6', seed));
    const actions = await Promise.all(states.map((s) => pool.decide(s, 6)));
    actions.forEach((a, i) => expect(legalActions(states[i])).toContainEqual(a));
  }, 30000);

  it('falls back to the main thread without workers (development, tests)', async () => {
    const inline = new BotPool(4, null);
    const s = createGame(buildRules(), 'bo4', 9);
    expect(inline.size).toBe(0);
    expect(legalActions(s)).toContainEqual(await inline.decide(s, 4));
  });
});
