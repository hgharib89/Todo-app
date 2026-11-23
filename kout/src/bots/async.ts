/**
 * Bot decisions off the main thread (a Web Worker), so animations keep running while a Hard bot
 * thinks (up to ~1 s). Falls back to deciding on the main thread where workers aren't available.
 */
import type { Action, GameState } from '../engine';
import { chooseBotAction, type Difficulty } from './index';

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, { resolve: (a: Action) => void; state: GameState; difficulty: Difficulty }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./browserWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; action?: Action; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      // a failed worker decision is retried on the main thread
      w.resolve(e.data.action ?? chooseBotAction(w.state, w.difficulty));
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      for (const [id, w] of waiting) {
        waiting.delete(id);
        w.resolve(chooseBotAction(w.state, w.difficulty));
      }
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function decideAsync(state: GameState, difficulty: Difficulty): Promise<Action> {
  const w = typeof Worker !== 'undefined' ? getWorker() : null;
  if (!w) return Promise.resolve(chooseBotAction(state, difficulty));
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, { resolve, state, difficulty });
    w.postMessage({ id, state, difficulty });
  });
}
