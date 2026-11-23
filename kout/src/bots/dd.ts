/**
 * Exact double-dummy solver: with every hand known (one sampled deal), find the best result
 * for one team by alpha-beta search to the end of the hand.
 *
 * It follows the engine's rules exactly (follow suit, joker leads and their unlocks, the burned big joker, a cancelled
 * forced joker lead, trick winner), and scores the hand the way the engine does (normal bids,
 * Malzoom, Larens, Bawn). Speed comes from a compact representation, a transposition table at
 * trick boundaries, equivalent-card pruning and stopping as soon as the result is decided.
 */
import {
  type CardId,
  type GameState,
  type Suit,
  buildDeck,
  cardId,
  handPoints,
  isJoker,
  rankOf,
  suitOf,
  suitPower,
  teamOf,
  trumpPower,
  RANK_NAME_TO_RANK,
} from '../engine';

const SUIT_INDEX: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

interface Play {
  p: number;
  c: number;
  cancelled: boolean;
}

export interface DDResult {
  /** best value per candidate card for `team` (points difference; a Larens win counts as winValue) */
  values: Map<CardId, number>;
  nodes: number;
  /** false if the node budget ran out (values are then not exact) */
  complete: boolean;
}

/**
 * Value of each candidate card for the player to move in `state` (a full-information sampled deal,
 * phase 'playing'), from `team`'s point of view, with perfect play by everyone afterwards.
 */
export function solveCandidates(state: GameState, team: number, candidates: CardId[], winValue: number, maxNodes = 400000): DDResult {
  const dd = new DD(state, team, winValue, maxNodes);
  const values = new Map<CardId, number>();
  for (const c of candidates) {
    const idx = dd.indexOf(c);
    dd.push(idx);
    values.set(c, dd.search(-Infinity, Infinity));
    dd.pop();
    if (dd.aborted) break;
  }
  return { values, nodes: dd.nodes, complete: !dd.aborted };
}

/** Value of the position for `team` with perfect play from here (no move fixed). */
export function solvePosition(state: GameState, team: number, winValue: number, maxNodes = 400000): { value: number; complete: boolean } {
  const dd = new DD(state, team, winValue, maxNodes);
  const value = dd.search(-Infinity, Infinity);
  return { value, complete: !dd.aborted };
}

class DD {
  // static per solve
  private n: number;
  private team: number;
  private trump: number;
  private cards: CardId[] = [];
  private suit: number[] = []; // 0..3, or 4 for jokers
  private joker: boolean[] = [];
  private red: boolean[] = [];
  private plainPow: number[] = [];
  private trumpPow: number[] = []; // -1 if not trump-like
  private owner: number[] = [];
  private teams: number[];
  private hands: number[][]; // card indices per player (mutated: removed/restored)
  private contractTeam: number;
  private value: number;
  private bawn: boolean;
  private bawnOpp: number;
  private madePts: [number, number];
  private failedPts: [number, number];
  private larensWin: boolean;
  private winValue: number;
  private total: number;
  private permRed: boolean[]; // per team: may lead the red joker by bid
  private permBlack: boolean[];
  private bidderLacksUnlock: boolean;
  private reqMode: 'none' | 'list';
  private reqRemaining: number; // required trump cards still unplayed
  private isReq: boolean[];
  private ledCounts: boolean;
  private cancelIllegal: boolean;
  private jokerWhileHolding: boolean;
  private leadAllowed: boolean; // jokers.jokerLeadAllowed
  private burnRule: boolean; // jokers.burnBigJokerBeforeSmall
  private blackOut: boolean; // has the black (small) joker been played this hand?

  // dynamic
  private trick: Play[] = [];
  private leader: number;
  private ledSuit = -1;
  private won: [number, number];
  private played: number;
  private tt = new Map<string, { v: number; flag: 0 | 1 | 2 }>();
  nodes = 0;
  aborted = false;

  constructor(
    state: GameState,
    team: number,
    winValue: number,
    private maxNodes: number,
  ) {
    const r = state.rules;
    const c = state.contract!;
    const trumpSuit = c.trump as Suit;
    this.n = state.numPlayers;
    this.teams = Array.from({ length: this.n }, (_, p) => teamOf(state, p));
    this.team = team;
    this.trump = SUIT_INDEX[trumpSuit];
    this.winValue = winValue;
    this.total = r.modes[state.mode].handSize;
    this.contractTeam = c.team;
    this.value = c.value;
    this.bawn = !!c.bawn;
    this.bawnOpp = c.bawnOppTricks ?? 0;
    const made = handPoints(r, c, true);
    const failed = handPoints(r, c, false);
    this.madePts = made;
    this.failedPts = failed;
    this.larensWin = !c.forced && c.value === r.bidding.larens && r.larens.larensWinsGame;
    if (this.bawn) {
      this.madePts = [0, 0];
      this.madePts[c.team] = r.bawn.bawnWinPoints;
      this.failedPts = [0, 0];
      this.failedPts[1 - c.team] = r.bawn.bawnFailPoints;
    }
    // joker-lead permissions
    const jr = r.jokers;
    const perm = jr.leadAllowedByBid[c.value];
    this.permRed = [false, false];
    this.permBlack = [false, false];
    this.permRed[c.team] = !!perm?.red;
    this.permBlack[c.team] = !!perm?.black;
    this.bidderLacksUnlock = !!jr.leadUnlockedIfBidderLacks && !c.bidderHeldUnlockCard;
    this.ledCounts = jr.ledJokerCountsAsTrump;
    this.cancelIllegal = jr.illegalForcedLead === 'cancel';
    this.jokerWhileHolding = jr.canPlayWhileHoldingLedSuit;
    this.leadAllowed = jr.jokerLeadAllowed;
    this.burnRule = jr.burnBigJokerBeforeSmall;
    this.blackOut = state.playedCards.includes('XB');

    // live cards: in hands and in the current trick
    const add = (card: CardId, own: number) => {
      const i = this.cards.length;
      this.cards.push(card);
      const j = isJoker(card);
      this.joker.push(j);
      this.red.push(card === 'XR');
      const s = j ? 4 : SUIT_INDEX[suitOf(card)!];
      this.suit.push(s);
      this.plainPow.push(j ? -1 : suitPower(r, rankOf(card)!));
      this.trumpPow.push(j || s === this.trump ? trumpPower(r, card) : -1);
      this.owner.push(own);
      return i;
    };
    this.hands = state.hands.map((h, p) => h.map((card) => add(card, p)));
    for (const pl of state.trick.plays) this.trick.push({ p: pl.player, c: add(pl.card, pl.player), cancelled: pl.cancelled });
    this.leader = state.trick.leader;
    this.ledSuit = state.trick.ledSuit ? SUIT_INDEX[state.trick.ledSuit] : -1;
    this.won = [state.tricksWon[0], state.tricksWon[1]];
    this.played = state.tricksPlayed;

    // trump cards that unlock joker leads
    const req = jr.leadUnlockedWhenTrumpsPlayed;
    this.isReq = this.cards.map(() => false);
    if (req === null) {
      this.reqMode = 'none';
      this.reqRemaining = 1;
    } else {
      this.reqMode = 'list';
      const deck = buildDeck(r, state.mode);
      const ids = req === 'all' ? deck.filter((id) => suitOf(id) === trumpSuit) : req.map((k) => cardId(trumpSuit, RANK_NAME_TO_RANK[k])).filter((id) => deck.includes(id));
      const playedSet = new Set(state.playedCards);
      // required cards already played don't count; those still live must be played during the search
      this.reqRemaining = 0;
      for (const id of ids) {
        if (playedSet.has(id)) continue;
        const i = this.cards.indexOf(id);
        if (i >= 0 && !this.trick.some((t) => t.c === i)) {
          this.isReq[i] = true;
          this.reqRemaining++;
        }
      }
    }
  }

  indexOf(card: CardId): number {
    const p = this.toMove();
    const i = this.hands[p].find((x) => this.cards[x] === card);
    if (i === undefined) throw new Error(`card ${card} not in hand`);
    return i;
  }

  private toMove(): number {
    return (this.leader + this.trick.length) % this.n;
  }

  // ---- rules ----------------------------------------------------------------

  private teamOf(p: number) {
    return this.teams[p];
  }

  private canLeadJoker(p: number, c: number): boolean {
    if (!this.leadAllowed) return false;
    const t = this.teamOf(p);
    if (this.red[c] ? this.permRed[t] : this.permBlack[t]) return true;
    if (this.bidderLacksUnlock) return true;
    return this.reqMode === 'list' && this.reqRemaining === 0;
  }

  private legal(p: number): number[] {
    const hand = this.hands[p];
    if (this.trick.length === 0) {
      const ok = hand.filter((c) => !this.joker[c] || this.canLeadJoker(p, c));
      return ok.length ? ok : hand.slice();
    }
    if (this.ledSuit < 0) return hand.slice();
    const follow = hand.filter((c) => this.suit[c] === this.ledSuit);
    if (!follow.length) return hand.slice();
    if (this.jokerWhileHolding || this.ledSuit === this.trump) return [...follow, ...hand.filter((c) => this.joker[c])];
    return follow;
  }

  /** drop cards equivalent to one already kept (same suit, nothing live between them) */
  private distinct(moves: number[]): number[] {
    if (moves.length <= 1) return moves;
    const out: number[] = [];
    const bySuit = new Map<number, number[]>();
    for (const m of moves) {
      if (this.joker[m]) out.push(m);
      else {
        const a = bySuit.get(this.suit[m]) ?? [];
        a.push(m);
        bySuit.set(this.suit[m], a);
      }
    }
    for (const [s, list] of bySuit) {
      if (list.length === 1) {
        out.push(list[0]);
        continue;
      }
      const pow = (c: number) => (s === this.trump ? this.trumpPow[c] : this.plainPow[c]);
      list.sort((a, b) => pow(a) - pow(b));
      // powers of every live card of this suit (in hands or on the table), jokers too for trump
      const live: number[] = [];
      for (let p = 0; p < this.n; p++) for (const c of this.hands[p]) if (this.suit[c] === s || (s === this.trump && this.joker[c])) live.push(pow(c));
      for (const t of this.trick) if (this.suit[t.c] === s || (s === this.trump && this.joker[t.c])) live.push(pow(t.c));
      let prev = -1;
      for (const c of list) {
        if (prev >= 0) {
          const lo = pow(prev);
          const hi = pow(c);
          if (!live.some((x) => x > lo && x < hi)) {
            prev = c;
            continue;
          }
        }
        out.push(c);
        prev = c;
      }
    }
    return out;
  }

  private score(t: Play): number {
    if (t.cancelled) return -2;
    const c = t.c;
    if (this.trumpPow[c] >= 0) return 1000 + this.trumpPow[c];
    if (this.suit[c] === this.ledSuit) return this.plainPow[c];
    return -1;
  }

  // ---- make / unmake ---------------------------------------------------------

  private undoStack: { ledSuit: number; leader: number; won: [number, number]; played: number; trick: Play[] | null; reqDelta: number; blackOut: boolean }[] = [];

  push(c: number) {
    const p = this.toMove();
    const saved = { ledSuit: this.ledSuit, leader: this.leader, won: [this.won[0], this.won[1]] as [number, number], played: this.played, trick: null as Play[] | null, reqDelta: 0, blackOut: this.blackOut };
    let cancelled = false;
    if (this.trick.length === 0) {
      if (this.joker[c]) {
        const legal = this.canLeadJoker(p, c);
        if (!legal && this.cancelIllegal) cancelled = true;
        else if (this.ledCounts) this.ledSuit = this.trump;
        else this.ledSuit = -1;
      } else this.ledSuit = this.suit[c];
    } else if (this.ledSuit < 0) {
      if (this.joker[c]) {
        if (this.trick.some((t) => t.cancelled)) cancelled = true;
      } else this.ledSuit = this.suit[c];
    }
    // الجوكر المحترق: the red joker before the black one has no value
    if (this.joker[c]) {
      if (this.red[c]) {
        if (this.burnRule && !this.blackOut) cancelled = true;
      } else this.blackOut = true;
    }
    const h = this.hands[p];
    h.splice(h.indexOf(c), 1);
    if (this.isReq[c]) {
      this.reqRemaining--;
      saved.reqDelta = 1;
    }
    this.trick.push({ p, c, cancelled });
    if (this.trick.length === this.n) {
      // trick complete
      let best = 0;
      let bestScore = -Infinity;
      this.trick.forEach((t, i) => {
        const sc = this.score(t);
        if (sc > bestScore) {
          bestScore = sc;
          best = i;
        }
      });
      const winner = this.trick[best].p;
      this.won[this.teamOf(winner)]++;
      this.played++;
      saved.trick = this.trick;
      this.trick = [];
      this.leader = winner;
      this.ledSuit = -1;
    }
    this.undoStack.push(saved);
  }

  pop() {
    const saved = this.undoStack.pop()!;
    if (saved.trick) this.trick = saved.trick;
    const last = this.trick.pop()!;
    this.hands[last.p].push(last.c);
    if (saved.reqDelta) this.reqRemaining++;
    this.blackOut = saved.blackOut;
    this.ledSuit = saved.ledSuit;
    this.leader = saved.leader;
    this.won = saved.won;
    this.played = saved.played;
  }

  // ---- evaluation -------------------------------------------------------------

  /** terminal value, or null if the hand isn't decided yet */
  private terminal(): number | null {
    const ct = this.contractTeam;
    const bid = this.won[ct];
    const opp = this.won[1 - ct];
    const left = this.total - this.played;
    let made: boolean | null = null;
    if (this.bawn) {
      if (opp > this.bawnOpp) made = false;
      else if (left === 0) made = true;
    } else if (bid >= this.value) made = true;
    else if (bid + left < this.value) made = false;
    if (made === null) {
      if (left === 0 && this.trick.length === 0) made = bid >= this.value;
      else return null;
    }
    // a tiny bonus per trick taken breaks ties in favour of taking tricks (never outweighs a point)
    const tricks = 0.01 * (this.won[this.team] - this.won[1 - this.team]);
    if (made && this.larensWin) return (ct === this.team ? this.winValue : -this.winValue) + tricks;
    const pts = made ? this.madePts : this.failedPts;
    return pts[this.team] - pts[1 - this.team] + tricks;
  }

  search(alpha: number, beta: number): number {
    if (this.aborted) return 0;
    if (++this.nodes > this.maxNodes) {
      this.aborted = true;
      return 0;
    }
    if (this.trick.length === 0) {
      const t = this.terminal();
      if (t !== null) return t;
    }
    let key = '';
    const alpha0 = alpha;
    if (this.trick.length === 0) {
      key = `${this.leader}|${this.won[0]},${this.won[1]}|${this.hands.map((h) => h.slice().sort((a, b) => a - b).join('.')).join('/')}`;
      const hit = this.tt.get(key);
      if (hit) {
        if (hit.flag === 0) return hit.v;
        if (hit.flag === 1 && hit.v >= beta) return hit.v;
        if (hit.flag === 2 && hit.v <= alpha) return hit.v;
      }
    }
    const p = this.toMove();
    const maxing = this.teamOf(p) === this.team;
    const moves = this.distinct(this.legal(p));
    // cheap move ordering: strong cards first for the side that wants tricks
    moves.sort((a, b) => this.strength(b) - this.strength(a));
    let best = maxing ? -Infinity : Infinity;
    for (const m of moves) {
      this.push(m);
      const v = this.search(alpha, beta);
      this.pop();
      if (this.aborted) return 0;
      if (maxing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    if (key) {
      const flag: 0 | 1 | 2 = best <= alpha0 ? 2 : best >= beta ? 1 : 0;
      this.tt.set(key, { v: best, flag });
    }
    return best;
  }

  private strength(c: number): number {
    return this.trumpPow[c] >= 0 ? 100 + this.trumpPow[c] : this.plainPow[c];
  }
}

/** Is the result exact-searchable cheaply? (few cards left) */
export function cardsPerPlayer(state: GameState): number {
  return Math.max(...state.hands.map((h) => h.length));
}
