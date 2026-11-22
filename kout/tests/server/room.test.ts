import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { buildDeck, buildRules } from '../../src/engine';
import { startServer } from '../../server/src/app';
import { KoutRoom, type LobbyMessage, type ViewMessage } from '../../server/src/KoutRoom';
import { setLogSink, setQuiet } from '../../server/src/log';
import { HIDDEN } from '../../server/src/view';

const PORT = 2611;
const URL = `http://localhost:${PORT}`;
const FAST = { publicWaitSeconds: 0.3, botMinMs: 2, botMaxMs: 4, trickPauseMs: 0, botSamples: 3, handOverSeconds: 0.05, reviewSeconds: 0.05, reconnectSeconds: 5 };
let server: Server;
const logs: string[] = [];

beforeAll(async () => {
  setQuiet(false);
  setLogSink((l) => logs.push(l));
  server = await startServer(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
  setLogSink((l) => console.log(l));
});
beforeEach(() => {
  KoutRoom.configOverride = { ...FAST, bidSeconds: 30, playSeconds: 30 };
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => T | undefined | null | false, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await sleep(15);
  }
}

interface Player {
  room: Room;
  views: ViewMessage[];
  lobby: LobbyMessage[];
  errors: string[];
  last: () => ViewMessage | undefined;
}
function track(room: Room): Player {
  const p: Player = { room, views: [], lobby: [], errors: [], last: () => p.views[p.views.length - 1] };
  room.onMessage('view', (m: ViewMessage) => p.views.push(m));
  room.onMessage('lobby', (m: LobbyMessage) => p.lobby.push(m));
  room.onMessage('error', (m: { reason: string }) => p.errors.push(m.reason));
  return p;
}
const join = async (opts: Record<string, unknown>) => track(await new Client(URL).joinOrCreate('kout', opts));

describe('game server (Colyseus)', () => {
  it('health check answers', async () => {
    const r = await fetch(`${URL}/healthz`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
  });

  it('public room: waits for humans, then bots fill the empty seats and the game starts', async () => {
    const p = await join({ mode: 'bo4', name: 'سعود' });
    const lobby = await waitFor(() => p.lobby[0]);
    expect(lobby).toMatchObject({ mode: 'bo4', isPrivate: false, code: null });
    expect(lobby.seats[0]).toEqual({ name: 'سعود', bot: false });
    const v = await waitFor(() => p.last());
    expect(v.names[0]).toBe('سعود');
    expect(v.bots).toEqual([false, true, true, true]);
    expect(v.game.phase).toBe('bidding');
    expect(v.rulesHash).toBeTruthy();
    await p.room.leave();
  });

  it('only your own cards are ever sent; the four views together are exactly the deck', async () => {
    KoutRoom.configOverride = { ...FAST, publicWaitSeconds: 30, bidSeconds: 30, playSeconds: 30 };
    const ps = await Promise.all([0, 1, 2, 3].map((i) => join({ mode: 'bo4', name: `p${i}` })));
    const views = await Promise.all(ps.map((p) => waitFor(() => p.last())));
    const mine = views.map((v) => v.game.hands[0]);
    for (const v of views) {
      expect(v.bots.every((b) => !b)).toBe(true);
      expect(v.game.hands.slice(1).every((h) => h.every((c) => c === HIDDEN))).toBe(true);
      expect(v.game.seed).toBe(0);
      expect(v.game.reneges).toEqual([]);
    }
    expect(mine.flat().sort()).toEqual(buildDeck(buildRules(), 'bo4').sort());
    await Promise.all(ps.map((p) => p.room.leave()));
  });

  it('validates every action: out of turn, malformed, illegal and impersonation are all rejected', async () => {
    KoutRoom.configOverride = { ...FAST, publicWaitSeconds: 30, bidSeconds: 30, playSeconds: 30 };
    const ps = await Promise.all([0, 1, 2, 3].map((i) => join({ mode: 'bo4', name: `p${i}` })));
    await Promise.all(ps.map((p) => waitFor(() => p.last())));
    const turn = ps.find((p) => p.last()!.game.currentPlayer === 0)!;
    const other = ps.find((p) => p !== turn)!;
    const before = turn.last()!.game.bids.length;
    other.room.send('act', { a: { type: 'PASS' } }); // not their turn
    other.room.send('act', { a: { type: 'PASS', player: 0 } }); // pretending to be someone else changes nothing
    other.room.send('act', { a: { type: 'PLAY', card: 'H99x' } }); // malformed
    turn.room.send('act', { a: { type: 'BID', value: 5 } }); // illegal (5 only as Malzoom)
    await waitFor(() => other.errors.length >= 3 && turn.errors.length >= 1);
    expect(other.errors).toEqual(['out_of_turn', 'out_of_turn', 'malformed']);
    expect(turn.errors).toEqual(['illegal']);
    expect(turn.last()!.game.bids.length).toBe(before);
    turn.room.send('act', { a: { type: 'BID', value: 6 } });
    await waitFor(() => turn.last()!.game.bids.length === before + 1);
    expect(logs.some((l) => l.includes('"rejected_action"') && l.includes('"out_of_turn"'))).toBe(true);
    await Promise.all(ps.map((p) => p.room.leave()));
  });

  it('turn timer: a player who does not act is auto-played by a bot', async () => {
    KoutRoom.configOverride = { ...FAST, bidSeconds: 0.15, playSeconds: 0.15 };
    const p = await join({ mode: 'bo4', name: 'نايم' });
    const first = await waitFor(() => p.last());
    expect(first.game.phase).toBe('bidding');
    // the human never sends anything, yet the hand goes on
    await waitFor(() => (p.last()!.game.tricksPlayed >= 2 || p.last()!.game.handNumber > 1 ? p.last() : null), 15000);
    expect(p.views.some((v) => v.deadline && v.deadline.seat === 0)).toBe(true);
    expect(logs.some((l) => l.includes('"turn_timeout"'))).toBe(true);
    await p.room.leave();
  });

  it('a whole game can be played to the end on the server', async () => {
    KoutRoom.configOverride = { ...FAST, bidSeconds: 0.02, playSeconds: 0.02, awayAfterTimeouts: 1 };
    const p = await join({ mode: 'bo4', name: 'متفرج' });
    const end = await waitFor(() => (p.last()?.game.phase === 'gameOver' ? p.last() : null), 60000);
    expect(end.game.winner === 0 || end.game.winner === 1).toBe(true);
    expect(end.game.history.length).toBeGreaterThan(0);
    await p.room.leave();
  }, 70000);

  it('private room: 6-letter code, joined by code, host starts with bots; public matchmaking never lands there', async () => {
    const host = track(await new Client(URL).create('kout', { mode: 'bo4', private: true, name: 'المضيف' }));
    const lobby = await waitFor(() => host.lobby[0]);
    expect(lobby.isPrivate).toBe(true);
    expect(lobby.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    expect(host.room.roomId).toBe(lobby.code);
    const friend = track(await new Client(URL).joinById(lobby.code!, { name: 'صديق' }));
    await waitFor(() => friend.lobby[0]);
    expect(friend.lobby[friend.lobby.length - 1].isHost).toBe(false);
    // a stranger looking for a public game gets a different room
    const stranger = track(await new Client(URL).joinOrCreate('kout', { mode: 'bo4', name: 'غريب' }));
    expect(stranger.room.roomId).not.toBe(lobby.code);
    await stranger.room.leave();
    friend.room.send('start'); // not the host: ignored
    await sleep(150);
    expect(friend.views).toHaveLength(0);
    host.room.send('start');
    const v = await waitFor(() => host.last());
    expect(v.code).toBe(lobby.code);
    expect(v.bots.filter(Boolean)).toHaveLength(2);
    expect(v.names).toContain('صديق');
    await Promise.all([host.room.leave(), friend.room.leave()]);
  });

  it('reconnect: a dropped player gets the same seat and hand back', async () => {
    KoutRoom.configOverride = { ...FAST, publicWaitSeconds: 30, bidSeconds: 30, playSeconds: 30 };
    const ps = await Promise.all([0, 1, 2, 3].map((i) => join({ mode: 'bo4', name: `r${i}` })));
    await Promise.all(ps.map((p) => waitFor(() => p.last())));
    const p = ps[1];
    p.room.reconnection.enabled = false;
    const hand = p.last()!.game.hands[0];
    const token = p.room.reconnectionToken;
    await p.room.leave(false); // drop without consent
    await waitFor(() => ps[0].last()!.online.includes(false));
    const back = track(await new Client(URL).reconnect(token));
    const v = await waitFor(() => back.last());
    expect(v.game.hands[0]).toEqual(hand);
    expect(v.names[0]).toBe('r1');
    await waitFor(() => ps[0].last()!.online.every(Boolean));
    await Promise.all([ps[0], ps[2], ps[3], back].map((x) => x.room.leave()));
  });

  it('rate limit: flooding is dropped, logged, and finally disconnected', async () => {
    KoutRoom.configOverride = { ...FAST, rateCapacity: 5, ratePerSecond: 1, floodStrikes: 20, bidSeconds: 30, playSeconds: 30 };
    const p = await join({ mode: 'bo6', name: 'مزعج' });
    await waitFor(() => p.last());
    let left = false;
    p.room.onLeave(() => (left = true));
    for (let i = 0; i < 30; i++) p.room.send('act', { a: { type: 'PASS' } });
    await waitFor(() => left);
    expect(logs.some((l) => l.includes('"rate_limited"'))).toBe(true);
    expect(logs.some((l) => l.includes('"flood_disconnect"'))).toBe(true);
  });
});
