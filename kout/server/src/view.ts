/**
 * What each player is allowed to see, and how their actions map back.
 *
 * Every client sees the table from its own seat: the view is ROTATED so the client is always
 * seat 0 and its team is always team 0 (the existing UI then works unchanged). All hidden
 * information is removed: other players' cards (only their count is kept), the RNG seed,
 * and the silent renege record. The rules object is not sent either — the client rebuilds
 * the exact same rules from rules.config.ts with the preset id, and checks rulesHash.
 */
import type {
  Action,
  BidEntry,
  CatchResult,
  CompletedTrick,
  Contract,
  GameState,
  HandResult,
  JokerAskAnswer,
  RulesConfig,
  Trick,
} from '../../src/engine';

/** A card the viewer may not see. */
export const HIDDEN = '??';

export type ClientGame = Omit<GameState, 'rules'> & { rules: null };

export function rotation(seat: number, n: number) {
  const toView = (s: number) => (((s - seat) % n) + n) % n;
  const toReal = (v: number) => (((v + seat) % n) + n) % n;
  // with partners on alternate seats, rotating by an odd number of seats swaps the teams
  const flip = seat % 2 === 1;
  const team = <T extends number>(t: T): T => (flip ? ((1 - t) as T) : t);
  const pair = (p: [number, number]): [number, number] => (flip ? [p[1], p[0]] : [p[0], p[1]]);
  return { toView, toReal, team, pair };
}

/** The game as seen from `seat`: rotated, with every hidden thing removed. */
export function viewFor(state: GameState, seat: number): ClientGame {
  const n = state.numPlayers;
  if (state.rules.modes[state.mode].teamLayout !== 'alternate') throw new Error('online play needs teamLayout "alternate"');
  const r = rotation(seat, n);
  const seatOrNull = (s: number | null) => (s === null ? null : r.toView(s));
  const ask = (a?: JokerAskAnswer) => (a ? { answer: a.answer, holder: seatOrNull(a.holder) } : undefined);
  const bid = (b: BidEntry): BidEntry => {
    const out: BidEntry = { player: r.toView(b.player), value: b.value, forced: b.forced };
    if (b.jokerAsk) out.jokerAsk = ask(b.jokerAsk);
    return out;
  };
  const trick = (t: Trick): Trick => ({ leader: r.toView(t.leader), ledSuit: t.ledSuit, plays: t.plays.map((p) => ({ ...p, player: r.toView(p.player) })) });
  const done = (t: CompletedTrick): CompletedTrick => ({ ...trick(t), winner: r.toView(t.winner) });
  const caught = (c: CatchResult | null): CatchResult | null => (c ? { ...c, catcher: r.toView(c.catcher), accused: r.toView(c.accused) } : null);
  const result = (h: HandResult): HandResult => ({
    ...h,
    dealer: r.toView(h.dealer),
    bidder: r.toView(h.bidder),
    team: r.team(h.team),
    tricks: r.pair(h.tricks),
    points: r.pair(h.points),
    totals: r.pair(h.totals),
    caught: caught(h.caught),
  });
  const contract = (c: Contract | null): Contract | null => (c ? { ...c, bidder: r.toView(c.bidder), team: r.team(c.team) } : null);
  const real = (v: number) => r.toReal(v);

  return {
    ...state,
    rules: null,
    seed: 0,
    dealer: r.toView(state.dealer),
    currentPlayer: r.toView(state.currentPlayer),
    hands: Array.from({ length: n }, (_, v) => {
      const h = state.hands[real(v)] ?? [];
      return v === 0 ? h.slice() : h.map(() => HIDDEN);
    }),
    bids: state.bids.map(bid),
    passed: Array.from({ length: n }, (_, v) => state.passed[real(v)] ?? false),
    highBid: state.highBid ? bid(state.highBid) : null,
    contract: contract(state.contract),
    trick: trick(state.trick),
    lastTrick: state.lastTrick ? done(state.lastTrick) : null,
    tricks: (state.tricks ?? []).map(done),
    tricksWon: r.pair(state.tricksWon),
    scores: r.pair(state.scores),
    history: state.history.map(result),
    winner: state.winner === null ? null : r.team(state.winner),
    lastResult: state.lastResult ? result(state.lastResult) : null,
    reneges: [], // hidden: catches are judged from the visible cards only
    dealerDraw: state.dealerDraw
      ? { dealer: r.toView(state.dealerDraw.dealer), rounds: state.dealerDraw.rounds.map((rd) => rd.map((d) => ({ player: r.toView(d.player), card: d.card }))) }
      : null,
    lastCatch: caught(state.lastCatch ?? null),
  };
}

/** Rebuild a full GameState on the client from a view and the locally built rules. */
export function fromView(view: ClientGame, rules: RulesConfig): GameState {
  return { ...view, rules } as GameState;
}

const ACTIONS = new Set(['BID', 'PASS', 'CHOOSE_TRUMP', 'PLAY', 'NEXT_HAND', 'CATCH', 'END_REVIEW', 'BAWN', 'JOKER_ASK']);
const isInt = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

/**
 * Validate the shape of an action sent by the client at `seat` (in view coordinates) and turn it
 * into a real-seat action. The acting player is ALWAYS the client's own seat, whatever it claims.
 * Returns null for anything malformed (the caller logs it).
 */
export function toRealAction(raw: unknown, seat: number, n: number): Action | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.type !== 'string' || !ACTIONS.has(a.type)) return null;
  const r = rotation(seat, n);
  switch (a.type) {
    case 'BID':
      return isInt(a.value, 1, 20) ? { type: 'BID', player: seat, value: a.value as number } : null;
    case 'PASS':
      return { type: 'PASS', player: seat };
    case 'CHOOSE_TRUMP':
      return ['S', 'H', 'D', 'C'].includes(a.suit as string) ? { type: 'CHOOSE_TRUMP', player: seat, suit: a.suit as 'S' } : null;
    case 'PLAY':
      return typeof a.card === 'string' && /^(X[RB]|[SHDC]\d{1,2})$/.test(a.card) ? { type: 'PLAY', player: seat, card: a.card } : null;
    case 'CATCH':
      return isInt(a.accused, 0, n - 1) && isInt(a.trick, 0, 20) ? { type: 'CATCH', player: seat, accused: r.toReal(a.accused as number), trick: a.trick as number } : null;
    case 'BAWN':
      return typeof a.accept === 'boolean' ? { type: 'BAWN', player: seat, accept: a.accept } : null;
    case 'JOKER_ASK':
      return { type: 'JOKER_ASK', player: seat };
    case 'NEXT_HAND':
      return { type: 'NEXT_HAND' };
    case 'END_REVIEW':
      return { type: 'END_REVIEW' };
  }
  return null;
}

/** Stable hash of the rules, so client and server can tell they run the same rules.config.ts. */
export function rulesHash(rules: RulesConfig): string {
  const stable = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(stable).join(',')}]`
      : v && typeof v === 'object'
        ? `{${Object.keys(v as object)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
            .join(',')}}`
        : JSON.stringify(v);
  let h = 2166136261;
  const s = stable(rules);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
