/**
 * Load test: N simulated players play real games against the server over WebSocket.
 *
 *   npm run loadtest -- --url http://localhost:2567 --players 500 --duration 180
 *
 * Each player joins public matchmaking (Bo 6 / Bo 4 mix), acts like a person (0.3–1.5 s to decide,
 * using the Easy bot on its own view — so it also reneges sometimes, which exercises صيد),
 * votes for the next hand, and starts a new game when one ends. We measure the time from sending
 * an action until the server's answer (the next view), plus errors and drops.
 */
import { Client, type Room } from '@colyseus/sdk';
import { buildRules, type GameState } from '../../src/engine';
import { chooseBotAction } from '../../src/bots';
import { fromView } from '../src/view';
import type { ViewMessage } from '../src/KoutRoom';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://localhost:2567');
const PLAYERS = Number(arg('players', '500'));
const DURATION = Number(arg('duration', '180')) * 1000;
const RAMP_PER_SEC = Number(arg('ramp', '50'));
const THINK_MIN = Number(arg('thinkMin', '300'));
const THINK_MAX = Number(arg('thinkMax', '1500'));

const rules = buildRules();
const lat: number[] = [];
const totals = { joined: 0, joinErrors: 0, actions: 0, serverErrors: 0, drops: 0, views: 0, gamesFinished: 0, active: 0, maxActive: 0 };
const errorReasons: Record<string, number> = {};
let stopping = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const think = () => THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN);

async function player(i: number) {
  const client = new Client(URL);
  while (!stopping) {
    let room: Room;
    try {
      room = await client.joinOrCreate('kout', { mode: i % 3 === 0 ? 'bo4' : 'bo6', name: `حمل${i}` });
      totals.joined++;
      totals.active++;
      totals.maxActive = Math.max(totals.maxActive, totals.active);
    } catch (e) {
      totals.joinErrors++;
      await sleep(1000);
      continue;
    }
    room.reconnection.enabled = false;
    let pending: number | null = null; // when our last action was sent
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastKey = '';
    const done = new Promise<void>((resolve) => {
      room.onLeave(() => {
        totals.active--;
        resolve();
      });
      room.onDrop(() => totals.drops++);
      room.onMessage('lobby', () => {});
      room.onMessage('error', (m: { reason: string }) => {
        totals.serverErrors++;
        errorReasons[m.reason] = (errorReasons[m.reason] ?? 0) + 1;
      });
      room.onMessage('view', (m: ViewMessage) => {
        totals.views++;
        if (pending !== null) {
          lat.push(performance.now() - pending);
          pending = null;
        }
        const g: GameState = fromView(m.game, rules);
        if (g.phase === 'gameOver') {
          totals.gamesFinished++;
          setTimeout(() => room.leave(), 500 + Math.random() * 2000);
          return;
        }
        const key = `${g.phase}|${g.handNumber}|${g.currentPlayer}|${g.bids.length}|${g.playedCards.length}|${g.tricksPlayed}`;
        if (key === lastKey) return;
        lastKey = key;
        if (timer) clearTimeout(timer);
        const mine = g.currentPlayer === 0 && ['bidding', 'choosingTrump', 'playing', 'bawnAsk'].includes(g.phase);
        const vote = g.phase === 'handOver' || g.phase === 'review';
        if (!mine && !vote) return;
        timer = setTimeout(() => {
          if (stopping) return;
          const a = vote ? { type: g.phase === 'handOver' ? 'NEXT_HAND' : 'END_REVIEW' } : chooseBotAction(g, 'easy');
          pending = performance.now();
          totals.actions++;
          room.send('act', { a });
        }, think());
      });
    });
    await done;
    if (timer) clearTimeout(timer);
  }
}

function pct(a: number[], p: number) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10;
}

(async () => {
  const t0 = Date.now();
  console.log(`load test: ${PLAYERS} players → ${URL}, ${DURATION / 1000}s, ramp ${RAMP_PER_SEC}/s`);
  const all: Promise<void>[] = [];
  for (let i = 0; i < PLAYERS; i++) {
    all.push(player(i));
    if ((i + 1) % RAMP_PER_SEC === 0) await sleep(1000);
  }
  const tick = setInterval(() => {
    const s = Math.round((Date.now() - t0) / 1000);
    console.log(`t=${s}s active=${totals.active} actions=${totals.actions} views=${totals.views} games=${totals.gamesFinished} p50=${pct(lat, 50)}ms p99=${pct(lat, 99)}ms errors=${totals.serverErrors} drops=${totals.drops}`);
  }, 10000);
  await sleep(Math.max(0, DURATION - (Date.now() - t0)));
  stopping = true;
  clearInterval(tick);
  const result = {
    players: PLAYERS,
    durationSec: Math.round((Date.now() - t0) / 1000),
    maxConcurrentPlayers: totals.maxActive,
    joins: totals.joined,
    joinErrors: totals.joinErrors,
    actionsSent: totals.actions,
    viewsReceived: totals.views,
    gamesFinished: totals.gamesFinished,
    serverErrors: totals.serverErrors,
    errorReasons,
    drops: totals.drops,
    latencyMs: { samples: lat.length, p50: pct(lat, 50), p90: pct(lat, 90), p99: pct(lat, 99), max: pct(lat, 100) },
  };
  console.log('RESULT ' + JSON.stringify(result));
  process.exit(0);
})();
