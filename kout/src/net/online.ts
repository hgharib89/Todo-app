/**
 * Online play: a thin client for the authoritative game server (server/).
 * The server sends each player their own rotated view (they are always seat 0) and nothing else;
 * the app rebuilds the full rules locally from rules.config.ts and checks they match (rulesHash).
 */
import { useEffect, useState } from 'react';
import { Client, type Room } from '@colyseus/sdk';
import { type Action, type GameState, type JokerPresetId, type ModeId, buildRules } from '../engine';
import type { LobbyMessage, ViewMessage } from '../../server/src/KoutRoom';
import { fromView, rulesHash } from '../../server/src/view';

import { SERVER_URL, TOKEN_KEY, onlineAvailable } from './config';
export { SERVER_URL, onlineAvailable };

let client: Client | null = null;
function sdk(): Client {
  if (!client) client = new Client(SERVER_URL);
  return client;
}

/**
 * A joined room. Listeners are attached the moment we join, so no message is lost while the
 * screens load; the screens subscribe to the latest state.
 */
export class OnlineSession {
  state: OnlineState = { lobby: null, view: null, game: null, outdated: false, receivedAt: 0, lobbyAt: 0, error: null, connected: true, left: false };
  private listeners = new Set<() => void>();
  private rules: Record<string, ReturnType<typeof buildRules>> = {};

  constructor(public room: Room) {
    remember(room);
    const set = (patch: Partial<OnlineState>) => {
      this.state = { ...this.state, ...patch };
      this.listeners.forEach((l) => l());
    };
    room.onMessage('lobby', (m: LobbyMessage) => set({ lobby: m, lobbyAt: Date.now() }));
    room.onMessage('view', (m: ViewMessage) => {
      const rules = (this.rules[m.preset] ??= buildRules(m.preset));
      set({ view: m, game: fromView(m.game, rules), outdated: rulesHash(rules) !== m.rulesHash, receivedAt: Date.now(), error: null });
    });
    room.onMessage('error', (m: { reason: string }) => set({ error: m.reason }));
    room.onDrop(() => set({ connected: false }));
    room.onReconnect(() => {
      set({ connected: true });
      room.send('hello');
    });
    room.onLeave(() => {
      forgetRoom();
      set({ left: true, connected: false });
    });
    room.send('hello'); // ask the server for the current lobby / view
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  send(a: Action) {
    this.room.send('act', { a });
  }
  start() {
    this.room.send('start');
  }
  async leave() {
    forgetRoom();
    await this.room.leave();
  }
}

function remember(room: Room) {
  try {
    sessionStorage.setItem(TOKEN_KEY, room.reconnectionToken);
  } catch {
    /* ignore */
  }
}
export function forgetRoom() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function quickMatch(mode: ModeId, name: string): Promise<OnlineSession> {
  return new OnlineSession(await sdk().joinOrCreate('kout', { mode, name }));
}

export async function createPrivate(mode: ModeId, name: string, preset: JokerPresetId): Promise<OnlineSession> {
  return new OnlineSession(await sdk().create('kout', { mode, private: true, name, preset }));
}

export async function joinByCode(code: string, name: string): Promise<OnlineSession> {
  return new OnlineSession(await sdk().joinById(code.trim().toUpperCase(), { name }));
}

/** After a page refresh: go back to the same seat if the game is still on. */
export async function resumeRoom(): Promise<OnlineSession | null> {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (!token || !onlineAvailable()) return null;
  try {
    return new OnlineSession(await sdk().reconnect(token));
  } catch {
    forgetRoom();
    return null;
  }
}

/** The page link that opens the app straight into a private room. */
export function inviteLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = `?room=${code}`;
  url.hash = '';
  return url.toString();
}

/** WhatsApp share link with an Arabic invitation. */
export function whatsappLink(code: string): string {
  const text = `تعال العب معي كوت في ديوانية الكوت 🃏\nكود الطاولة: ${code}\n${inviteLink(code)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export interface OnlineState {
  lobby: LobbyMessage | null;
  view: ViewMessage | null;
  /** the full game for the UI (rotated: you are seat 0), rebuilt with the local rules */
  game: GameState | null;
  /** the app's rules differ from the server's: the app needs updating */
  outdated: boolean;
  /** when the last view arrived (to run the turn clock) */
  receivedAt: number;
  /** when the last lobby message arrived (public-room countdown) */
  lobbyAt: number;
  error: string | null;
  connected: boolean;
  left: boolean;
}

/** Re-render on every change of the session. */
export function useOnlineSession(session: OnlineSession): OnlineState {
  const [, force] = useState(0);
  useEffect(() => session.subscribe(() => force((n) => n + 1)), [session]);
  return session.state;
}
