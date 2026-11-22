import type { IncomingMessage, ServerResponse } from 'node:http';
import { Server } from '@colyseus/core';

type Res = ServerResponse & { json: (body: unknown) => void; type: (t: string) => Res; send: (body: string) => void };
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KoutRoom } from './KoutRoom';
import { log } from './log';
import { stats } from './stats';
import { monitorEventLoopDelay } from 'node:perf_hooks';

/** Every `sec` seconds: rooms, players, CPU, memory and event-loop delay (for load tests and dashboards). */
function startMetrics(sec: number) {
  const RES = 5; // ms; the histogram's own sampling interval is subtracted below
  const h = monitorEventLoopDelay({ resolution: RES });
  h.enable();
  const lag = (ns: number) => Math.max(0, Math.round((ns / 1e6 - RES) * 10) / 10);
  let cpu = process.cpuUsage();
  let t = Date.now();
  setInterval(() => {
    const c = process.cpuUsage(cpu);
    const dt = (Date.now() - t) * 1000;
    cpu = process.cpuUsage();
    t = Date.now();
    log('info', 'metrics', {
      rooms: stats.rooms,
      players: stats.players,
      games: stats.games,
      actions: stats.actions,
      rejected: stats.rejected,
      cpuPct: Math.round(((c.user + c.system) / dt) * 1000) / 10,
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
      loopP50ms: lag(h.percentile(50)),
      loopP99ms: lag(h.percentile(99)),
      loopMaxMs: lag(h.max),
    });
    h.reset();
  }, sec * 1000).unref();
}

/** Build and start the Kout game server on `port`. */
export async function startServer(port: number): Promise<Server> {
  const server = new Server({
    transport: new WebSocketTransport({ pingInterval: 5000, pingMaxRetries: 3 }),
    greet: false,
    express: (app) => {
      app.get('/healthz', (_req: IncomingMessage, res: Res) => {
        res.json({ ok: true, rooms: stats.rooms, players: stats.players, games: stats.games, uptimeSec: Math.round((Date.now() - stats.startedAt) / 1000) });
      });
      app.get('/', (_req: IncomingMessage, res: Res) => {
        res.type('text/plain').send('Diwaniya Kout game server');
      });
    },
  });
  // public matchmaking groups players by mode; private rooms are unlisted and joined by code
  server.define('kout', KoutRoom).filterBy(['mode']);
  await server.listen(port);
  log('info', 'server_listening', { port });
  if (process.env.KOUT_METRICS) startMetrics(Number(process.env.KOUT_METRICS) || 10);
  return server;
}
