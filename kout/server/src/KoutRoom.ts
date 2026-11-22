/**
 * The authoritative Kout table.
 *
 * The server owns the game: it deals (crypto seed), validates every action with the shared engine
 * (src/engine — the same code and the same rules.config.ts as the app), runs the bots, applies every
 * rule (Larens, Bawn, joker question, reneging and صيد, scoring) and sends each player ONLY their own
 * view (viewFor). Clients just send actions.
 */
import { randomInt } from 'node:crypto';
import { Room, type Client } from '@colyseus/core';
import {
  type Action,
  type GameState,
  type JokerPresetId,
  type ModeId,
  type RulesConfig,
  applyAction,
  buildRules,
  catchOptions,
  createGame,
} from '../../src/engine';
import { chooseBotAction, chooseBotCatch } from '../../src/bots';
import { loadConfig, type ServerConfig } from './config';
import { cleanName, roomCode } from './codes';
import { log } from './log';
import { stats } from './stats';
import { RateLimiter } from './rateLimit';
import { rotation, rulesHash, toRealAction, viewFor, type ClientGame } from './view';

export const BOT_NAMES = ['خالد', 'سالم', 'ناصر', 'فهد', 'بو علي', 'مشاري', 'جاسم', 'حمد', 'بدر', 'عبدالله'];

interface Seat {
  kind: 'empty' | 'human' | 'bot';
  name: string;
  sessionId: string | null;
  connected: boolean;
  /** turn timeouts in a row */
  timeouts: number;
  /** a bot plays at once for an away player until they act again */
  away: boolean;
  illegal: number;
  wrongCatches: number;
  strikes: number;
}

export interface CreateOptions {
  mode?: ModeId;
  private?: boolean;
  /** joker rules preset (private rooms only; public rooms always use the default) */
  preset?: JokerPresetId;
}

export interface JoinOptions {
  name?: string;
}

/** What each client receives after every change. */
export interface ViewMessage {
  game: ClientGame;
  /** seat names / bot flags / connection, rotated like the game (index 0 = you) */
  names: string[];
  bots: boolean[];
  online: boolean[];
  /** whose clock is running (view seat, or -1 for the whole table) and how many ms are left */
  deadline: { seat: number; ms: number } | null;
  preset: JokerPresetId;
  rulesHash: string;
  mode: ModeId;
  code: string | null;
}

export interface LobbyMessage {
  mode: ModeId;
  code: string | null;
  isPrivate: boolean;
  isHost: boolean;
  /** seats rotated so index 0 = you; null = empty */
  seats: ({ name: string; bot: boolean } | null)[];
  /** public rooms: ms until bots fill the empty seats */
  startsInMs: number | null;
  preset: JokerPresetId;
}

export class KoutRoom extends Room {
  /** tests override timings here (never from client options) */
  static configOverride: Partial<ServerConfig> = {};

  private cfg!: ServerConfig;
  private mode: ModeId = 'bo6';
  private preset: JokerPresetId = 'default';
  private rules!: RulesConfig;
  private hash = '';
  private isPrivate = false;
  private seats: Seat[] = [];
  private game: GameState | null = null;
  private hostSeat = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private startsAt: number | null = null;
  private deadline: { seat: number; at: number } | null = null;
  private limiters = new Map<string, RateLimiter>();
  private votes = new Set<number>();

  onCreate(options: CreateOptions = {}) {
    this.cfg = loadConfig(KoutRoom.configOverride);
    this.mode = options.mode === 'bo4' ? 'bo4' : 'bo6';
    this.isPrivate = options.private === true;
    const presets = ['default', 'strict', 'stricter', 'relaxed'];
    this.preset = this.isPrivate && presets.includes(options.preset as string) ? (options.preset as JokerPresetId) : 'default';
    this.rules = buildRules(this.preset);
    this.hash = rulesHash(this.rules);
    const n = this.rules.modes[this.mode].players;
    this.maxClients = n;
    this.maxMessagesPerSecond = 40; // hard cap: Colyseus disconnects above this
    this.seats = Array.from({ length: n }, () => this.emptySeat());
    if (this.isPrivate) {
      this.roomId = roomCode();
      this.setPrivate(true);
    }
    this.setMetadata({ mode: this.mode, private: this.isPrivate });

    this.onMessage('act', (client, message) => this.onAct(client, message));
    this.onMessage('start', (client) => this.onStartRequest(client));
    this.onMessage('hello', (client) => this.onHello(client));
    this.onMessage('*', (client, type) => {
      this.suspicious(client, 'unknown_message', { type: String(type).slice(0, 40) });
    });
    stats.rooms++;
    log('info', 'room_created', { roomId: this.roomId, mode: this.mode, private: this.isPrivate, preset: this.preset });
  }

  onAuth(_client: Client, _options: unknown, context: unknown) {
    const allowed = this.cfg.allowedOrigins;
    if (allowed.length === 0) return true;
    const headers = (context as { headers?: unknown })?.headers as { get?: (k: string) => string | null } | Record<string, string> | undefined;
    const origin = typeof (headers as { get?: unknown })?.get === 'function' ? (headers as { get: (k: string) => string | null }).get('origin') : (headers as Record<string, string> | undefined)?.origin;
    if (origin && allowed.includes(origin)) return true;
    log('warn', 'origin_rejected', { roomId: this.roomId, origin: origin ?? null });
    throw new Error('origin not allowed');
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    if (this.game) throw new Error('game already started');
    const seat = this.seats.findIndex((s) => s.kind === 'empty');
    if (seat < 0) throw new Error('room full');
    this.seats[seat] = { ...this.emptySeat(), kind: 'human', name: cleanName(options.name, 'لاعب'), sessionId: client.sessionId, connected: true };
    this.limiters.set(client.sessionId, new RateLimiter(this.cfg.rateCapacity, this.cfg.ratePerSecond));
    if (this.hostSeat < 0) this.hostSeat = seat;
    stats.players++;
    log('info', 'join', { roomId: this.roomId, seat, sessionId: client.sessionId });

    const full = this.seats.every((s) => s.kind !== 'empty');
    if (full) this.start();
    else {
      if (!this.isPrivate && !this.startTimer) {
        this.startsAt = Date.now() + this.cfg.publicWaitSeconds * 1000;
        this.startTimer = setTimeout(() => this.start(), this.cfg.publicWaitSeconds * 1000);
      }
      this.sendLobby();
    }
  }

  onDrop(client: Client) {
    const seat = this.seatOf(client);
    if (seat < 0) return;
    this.seats[seat].connected = false;
    log('info', 'drop', { roomId: this.roomId, seat });
    this.allowReconnection(client, this.cfg.reconnectSeconds);
    if (this.game) this.afterChange(false);
    else this.sendLobby();
  }

  onReconnect(client: Client) {
    const seat = this.seatOf(client);
    if (seat < 0) return;
    this.seats[seat].connected = true;
    this.seats[seat].away = false;
    this.seats[seat].timeouts = 0;
    log('info', 'reconnect', { roomId: this.roomId, seat });
    if (this.game) this.afterChange(false);
    else this.sendLobby();
  }

  onLeave(client: Client) {
    const seat = this.seatOf(client);
    this.limiters.delete(client.sessionId);
    if (seat < 0) return;
    stats.players--;
    log('info', 'leave', { roomId: this.roomId, seat, started: !!this.game });
    if (!this.game) {
      this.seats[seat] = this.emptySeat();
      if (this.hostSeat === seat) this.hostSeat = this.seats.findIndex((s) => s.kind === 'human');
      if (this.seats.every((s) => s.kind === 'empty') && this.startTimer) {
        clearTimeout(this.startTimer);
        this.startTimer = null;
        this.startsAt = null;
      }
      this.sendLobby();
      return;
    }
    // during a game the seat is taken over by a bot for good
    const s = this.seats[seat];
    this.seats[seat] = { ...s, kind: 'bot', sessionId: null, connected: true, away: false };
    if (!this.seats.some((x) => x.kind === 'human')) {
      log('info', 'room_empty', { roomId: this.roomId });
      this.disconnect();
      return;
    }
    this.afterChange(false);
  }

  onDispose() {
    stats.rooms--;
    this.clearTimer();
    if (this.startTimer) clearTimeout(this.startTimer);
    log('info', 'room_disposed', { roomId: this.roomId, hands: this.game?.handNumber ?? 0 });
  }

  // ---------------------------------------------------------------------------
  // starting
  // ---------------------------------------------------------------------------

  /** a client (re)attached its listeners: send the current lobby or game view */
  private onHello(client: Client) {
    const seat = this.seatOf(client);
    if (seat < 0) return;
    if (this.game) client.send('view', this.viewMessage(seat));
    else this.sendLobby();
  }

  private onStartRequest(client: Client) {
    const seat = this.seatOf(client);
    if (this.game || !this.isPrivate || seat !== this.hostSeat) return;
    this.start();
  }

  private start() {
    if (this.game) return;
    if (this.startTimer) clearTimeout(this.startTimer);
    this.startTimer = null;
    this.startsAt = null;
    if (!this.seats.some((s) => s.kind === 'human')) return;
    const used = new Set(this.seats.map((s) => s.name));
    const free = BOT_NAMES.filter((n) => !used.has(n));
    this.seats = this.seats.map((s) => (s.kind === 'empty' ? { ...this.emptySeat(), kind: 'bot', name: free.shift() ?? 'بوت', connected: true } : s));
    this.game = createGame(this.rules, this.mode, randomInt(2 ** 31));
    this.lock();
    stats.games++;
    log('info', 'game_start', { roomId: this.roomId, humans: this.seats.filter((s) => s.kind === 'human').length });
    this.afterChange(false);
  }

  // ---------------------------------------------------------------------------
  // actions from players
  // ---------------------------------------------------------------------------

  private onAct(client: Client, message: unknown) {
    const seat = this.seatOf(client);
    if (seat < 0) return;
    const limiter = this.limiters.get(client.sessionId);
    if (limiter && !limiter.take()) {
      const s = this.seats[seat];
      s.strikes++;
      if (s.strikes === 1 || s.strikes % 10 === 0) this.suspicious(client, 'rate_limited', { strikes: s.strikes });
      if (s.strikes >= this.cfg.floodStrikes) {
        this.suspicious(client, 'flood_disconnect', { strikes: s.strikes });
        client.leave(4002);
      }
      return;
    }
    const g = this.game;
    if (!g) return this.reject(client, seat, 'not_started');
    const raw = (message as { a?: unknown })?.a ?? message;
    const action = toRealAction(raw, seat, g.numPlayers);
    if (!action) return this.reject(client, seat, 'malformed', { raw: JSON.stringify(raw)?.slice(0, 120) });

    const s = this.seats[seat];
    s.timeouts = 0;
    s.away = false;

    // votes that the whole table shares
    if (action.type === 'NEXT_HAND') {
      if (g.phase !== 'handOver') return;
      this.votes.add(seat);
      if (this.humansVoted(() => true)) this.apply({ type: 'NEXT_HAND' });
      return;
    }
    if (action.type === 'END_REVIEW') {
      if (g.phase !== 'review') return;
      this.votes.add(seat);
      if (this.humansVoted((p) => catchOptions(g, p).length > 0)) this.apply({ type: 'END_REVIEW' });
      return;
    }
    // صيد may be called by anyone, any time it is allowed
    if (action.type !== 'CATCH' && g.currentPlayer !== seat) return this.reject(client, seat, 'out_of_turn', { type: action.type });

    let next: GameState;
    try {
      next = applyAction(g, action);
    } catch (e) {
      return this.reject(client, seat, 'illegal', { type: action.type, error: (e as Error).message });
    }
    if (action.type === 'CATCH' && next.lastCatch && !next.lastCatch.success) {
      s.wrongCatches++;
      if (s.wrongCatches >= 5) this.suspicious(client, 'wrong_catch_spam', { count: s.wrongCatches });
    }
    stats.actions++;
    this.commit(next, g);
  }

  private reject(client: Client, seat: number, reason: string, extra: Record<string, unknown> = {}) {
    stats.rejected++;
    const s = this.seats[seat];
    s.illegal++;
    log('warn', 'rejected_action', { roomId: this.roomId, seat, sessionId: client.sessionId, reason, ...extra });
    if (s.illegal === 10 || s.illegal % 50 === 0) this.suspicious(client, 'many_rejected_actions', { count: s.illegal });
    client.send('error', { reason });
    // re-sync the client with the real state
    if (this.game) client.send('view', this.viewMessage(seat));
  }

  private suspicious(client: Client, event: string, data: Record<string, unknown> = {}) {
    log('warn', 'suspicious', { kind: event, roomId: this.roomId, seat: this.seatOf(client), sessionId: client.sessionId, ...data });
  }

  // ---------------------------------------------------------------------------
  // the game loop
  // ---------------------------------------------------------------------------

  private apply(action: Action) {
    const g = this.game;
    if (!g) return;
    let next: GameState;
    try {
      next = applyAction(g, action);
    } catch (e) {
      log('error', 'server_action_failed', { roomId: this.roomId, action, error: (e as Error).message });
      return;
    }
    this.commit(next, g);
  }

  private commit(next: GameState, prev: GameState) {
    this.game = next;
    if (next.phase !== prev.phase || next.handNumber !== prev.handNumber) this.votes.clear();
    const trickDone = next.tricksPlayed > prev.tricksPlayed;
    if (next.phase === 'gameOver' && prev.phase !== 'gameOver') {
      log('info', 'game_over', { roomId: this.roomId, winner: next.winner, scores: next.scores, hands: next.handNumber });
    }
    this.afterChange(trickDone);
  }

  /** Send everyone their view, then schedule whatever happens next. */
  private afterChange(trickDone: boolean) {
    this.clearTimer();
    const g = this.game;
    if (!g) return;
    const pause = trickDone ? this.cfg.trickPauseMs : 0;

    if (g.phase === 'gameOver') {
      this.deadline = null;
      this.broadcastViews();
      this.timer = setTimeout(() => this.disconnect(), this.cfg.gameOverSeconds * 1000);
      return;
    }

    // a bot that saw a renege calls صيد
    if (g.phase === 'playing' || g.phase === 'review' || g.phase === 'bawnAsk') {
      for (let p = 0; p < g.numPlayers; p++) {
        if (this.seats[p].kind !== 'bot') continue;
        const c = chooseBotCatch(g, p, 'hard');
        if (c) {
          this.deadline = null;
          this.broadcastViews();
          this.timer = setTimeout(() => this.apply(c), pause + this.botDelay());
          return;
        }
      }
    }

    if (g.phase === 'review') {
      const waiting = this.humans().some((p) => !this.votes.has(p) && this.seats[p].connected && catchOptions(g, p).length > 0);
      const ms = waiting ? this.cfg.reviewSeconds * 1000 : 600;
      this.deadline = waiting ? { seat: -1, at: Date.now() + pause + ms } : null;
      this.broadcastViews();
      this.timer = setTimeout(() => this.apply({ type: 'END_REVIEW' }), pause + ms);
      return;
    }
    if (g.phase === 'handOver') {
      const ms = this.cfg.handOverSeconds * 1000;
      this.deadline = { seat: -1, at: Date.now() + pause + ms };
      this.broadcastViews();
      this.timer = setTimeout(() => this.apply({ type: 'NEXT_HAND' }), pause + ms);
      return;
    }

    // someone's turn
    const p = g.currentPlayer;
    const s = this.seats[p];
    if (s.kind === 'bot' || !s.connected || s.away) {
      this.deadline = null;
      this.broadcastViews();
      this.timer = setTimeout(() => this.botMove(p, false), pause + this.botDelay());
      return;
    }
    const secs = g.phase === 'playing' ? this.cfg.playSeconds : this.cfg.bidSeconds;
    this.deadline = { seat: p, at: Date.now() + pause + secs * 1000 };
    this.broadcastViews();
    this.timer = setTimeout(() => this.botMove(p, true), pause + secs * 1000);
  }

  /** A bot moves for seat p (its own seat, or a human who timed out / is away / disconnected). */
  private botMove(p: number, timedOut: boolean) {
    const g = this.game;
    if (!g || g.currentPlayer !== p || !['bidding', 'choosingTrump', 'playing', 'bawnAsk'].includes(g.phase)) return;
    if (timedOut) {
      const s = this.seats[p];
      s.timeouts++;
      if (s.timeouts >= this.cfg.awayAfterTimeouts) s.away = true;
      log('info', 'turn_timeout', { roomId: this.roomId, seat: p, timeouts: s.timeouts });
    }
    // humans' seats get a bot that never reneges on purpose
    const action = chooseBotAction(g, 'hard', Math.random, { samples: this.cfg.botSamples });
    this.apply(action);
  }

  // ---------------------------------------------------------------------------
  // sending
  // ---------------------------------------------------------------------------

  private viewMessage(seat: number): ViewMessage {
    const g = this.game!;
    const n = g.numPlayers;
    const r = rotation(seat, n);
    const bySeat = <T,>(f: (s: Seat) => T) => Array.from({ length: n }, (_, v) => f(this.seats[r.toReal(v)]));
    return {
      game: viewFor(g, seat),
      names: bySeat((s) => s.name),
      bots: bySeat((s) => s.kind === 'bot'),
      online: bySeat((s) => s.kind === 'bot' || s.connected),
      deadline: this.deadline ? { seat: this.deadline.seat < 0 ? -1 : r.toView(this.deadline.seat), ms: Math.max(0, this.deadline.at - Date.now()) } : null,
      preset: this.preset,
      rulesHash: this.hash,
      mode: this.mode,
      code: this.isPrivate ? this.roomId : null,
    };
  }

  private broadcastViews() {
    for (const client of this.clients) {
      const seat = this.seatOf(client);
      if (seat >= 0) client.send('view', this.viewMessage(seat));
    }
  }

  private sendLobby() {
    const n = this.seats.length;
    for (const client of this.clients) {
      const seat = this.seatOf(client);
      if (seat < 0) continue;
      const r = rotation(seat, n);
      const msg: LobbyMessage = {
        mode: this.mode,
        code: this.isPrivate ? this.roomId : null,
        isPrivate: this.isPrivate,
        isHost: seat === this.hostSeat,
        seats: Array.from({ length: n }, (_, v) => {
          const s = this.seats[r.toReal(v)];
          return s.kind === 'empty' ? null : { name: s.name, bot: s.kind === 'bot' };
        }),
        startsInMs: this.startsAt ? Math.max(0, this.startsAt - Date.now()) : null,
        preset: this.preset,
      };
      client.send('lobby', msg);
    }
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private emptySeat(): Seat {
    return { kind: 'empty', name: '', sessionId: null, connected: false, timeouts: 0, away: false, illegal: 0, wrongCatches: 0, strikes: 0 };
  }

  private seatOf(client: Client): number {
    return this.seats.findIndex((s) => s.sessionId === client.sessionId);
  }

  private humans(): number[] {
    return this.seats.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  }

  /** have all connected humans (that `counts`) voted? */
  private humansVoted(counts: (seat: number) => boolean): boolean {
    return this.humans().every((p) => !this.seats[p].connected || !counts(p) || this.votes.has(p));
  }

  private botDelay(): number {
    return this.cfg.botMinMs + Math.floor(Math.random() * Math.max(1, this.cfg.botMaxMs - this.cfg.botMinMs));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
