/**
 * Hard bots think in worker threads so the main event loop stays free for players' moves, and all
 * CPU cores share the work. Under heavy load (a long queue) bots use fewer Monte Carlo samples
 * instead of slowing the whole server down.
 */
import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { Action, GameState } from '../../src/engine';
import { chooseBotAction } from '../../src/bots';
import { log } from './log';

interface Job {
  id: number;
  state: GameState;
  samples: number;
  timeMs: number;
  resolve: (a: Action) => void;
  reject: (e: Error) => void;
}

export class BotPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<number, { job: Job; worker: Worker }>();
  private nextId = 1;
  private overloadLogged = 0;
  private crashes = 0;

  /**
   * size 0 (or no bundled worker file, as in development and tests) = decide inline on the main thread.
   * `file` overrides the worker script (tests build one).
   */
  constructor(size: number, file: string | null = workerFile()) {
    if (size <= 0 || !file) return;
    for (let i = 0; i < size; i++) this.spawn(file);
    log('info', 'bot_pool', { workers: size });
  }

  get size() {
    return this.workers.length;
  }
  get backlog() {
    return this.queue.length;
  }

  /** A Hard-bot action for the current player of `state`. */
  decide(state: GameState, samples: number, timeMs = 1000): Promise<Action> {
    if (this.workers.length === 0) return Promise.resolve(chooseBotAction(state, 'hard', Math.random, { deals: samples, timeMs }));
    // shed load: a long queue means fewer deals and less time per decision (min 24 deals)
    const pressure = this.queue.length / this.workers.length;
    const s = pressure > 8 ? Math.max(24, samples >> 2) : pressure > 3 ? Math.max(24, samples >> 1) : samples;
    const t = pressure > 8 ? timeMs >> 2 : pressure > 3 ? timeMs >> 1 : timeMs;
    if (pressure > 8 && Date.now() - this.overloadLogged > 10000) {
      this.overloadLogged = Date.now();
      log('warn', 'bot_overload', { queue: this.queue.length, workers: this.workers.length, samples: s });
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, state, samples: s, timeMs: t, resolve, reject });
      this.pump();
    });
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idle = [];
  }

  private spawn(path: string) {
    const w = new Worker(path);
    w.unref();
    w.on('message', (m: { id: number; action?: Action; error?: string }) => {
      const r = this.running.get(m.id);
      this.running.delete(m.id);
      this.idle.push(w);
      if (r) {
        if (m.action) r.job.resolve(m.action);
        else r.job.reject(new Error(m.error ?? 'bot failed'));
      }
      this.pump();
    });
    w.on('error', (e) => {
      log('error', 'bot_worker_error', { error: String(e) });
      // fail its job over to the main thread, replace the worker
      for (const [id, r] of this.running) {
        if (r.worker === w) {
          this.running.delete(id);
          r.job.resolve(chooseBotAction(r.job.state, 'hard', Math.random, { deals: 24, timeMs: 200 }));
        }
      }
      this.workers = this.workers.filter((x) => x !== w);
      this.idle = this.idle.filter((x) => x !== w);
      // replace it, unless workers keep crashing: then everything runs on the main thread
      if (++this.crashes <= 5) this.spawn(path);
      else if (this.workers.length === 0) {
        log('error', 'bot_pool_disabled', { crashes: this.crashes });
        for (const job of this.queue.splice(0)) job.resolve(chooseBotAction(job.state, 'hard', Math.random, { deals: 24, timeMs: 200 }));
      }
    });
    this.workers.push(w);
    this.idle.push(w);
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.running.set(job.id, { job, worker: w });
      w.postMessage({ id: job.id, state: job.state, samples: job.samples, timeMs: job.timeMs });
    }
  }
}

/** The bundled worker next to the bundled server (dist/botWorker.cjs); null when running from source. */
function workerFile(): string | null {
  // CommonJS bundle: __dirname; ES modules (tsx in development): import.meta.url
  const here = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
  const built = join(here, 'botWorker.cjs');
  return existsSync(built) ? built : null;
}

let shared: BotPool | null = null;
/** One pool per process. KOUT_BOT_WORKERS sets its size (default: one per CPU core). */
export function botPool(): BotPool {
  if (!shared) {
    const env = process.env.KOUT_BOT_WORKERS;
    const size = env !== undefined && env !== '' ? Number(env) : Math.max(1, cpus().length);
    shared = new BotPool(Number.isFinite(size) ? size : 1);
  }
  return shared;
}
