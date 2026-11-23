/// <reference lib="webworker" />
/** Runs bot decisions in a background thread so the table stays smooth while a bot thinks. */
import { chooseBotAction, type Difficulty } from './index';
import type { GameState } from '../engine';

self.onmessage = (e: MessageEvent<{ id: number; state: GameState; difficulty: Difficulty }>) => {
  const { id, state, difficulty } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, action: chooseBotAction(state, difficulty) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
