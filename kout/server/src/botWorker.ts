/** Worker thread: runs Hard-bot decisions (Monte Carlo) off the main event loop. */
import { parentPort } from 'node:worker_threads';
import { chooseBotAction } from '../../src/bots';
import type { GameState } from '../../src/engine';

parentPort!.on('message', (msg: { id: number; state: GameState; samples: number; timeMs: number }) => {
  try {
    const action = chooseBotAction(msg.state, 'hard', Math.random, { deals: msg.samples, timeMs: msg.timeMs });
    parentPort!.postMessage({ id: msg.id, action });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, error: String(e) });
  }
});
