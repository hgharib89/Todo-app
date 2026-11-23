/**
 * The Hard bot (v2): Perfect Information Monte Carlo.
 *
 *  Card memory  — every card played, which jokers / high trumps are still out, who is void in what
 *                 (hard.ts: countCards, inferVoids), and what the joker question revealed.
 *  Inference    — sampled deals are weighted by how well each player's hand fits their bids and passes
 *                 (a strong hand that passed, or a weak hand that bid high, is unlikely), then
 *                 resampled, so the simulations concentrate on believable deals.
 *  Play         — for every candidate card, the bot averages the result over 200 sampled deals
 *                 (time budget ~1 s). In the endgame (≤ 5 cards each in Bo 4, ≤ 4 in Bo 6) each deal is
 *                 solved EXACTLY with the double-dummy solver (dd.ts); earlier, each deal is played
 *                 out with the strong playout policy (policy.ts). Ties go to the cheaper card, so a
 *                 joker is never thrown away, yet it is played as soon as the simulations show that
 *                 it matters.
 *  Bidding      — the hidden cards are dealt many times and the hand is played out with each trump
 *                 suit; the bot bids only what it makes with high probability, picks the trump the
 *                 same way, and uses the joker question when its expected value is best.
 *  Bawn         — decided by solving the remaining tricks on sampled deals (only asked at 6–0).
 *
 * It only reads public information and its own hand, and only plays legal moves; it never reneges.
 */
import {
  type Action,
  type CardId,
  type Contract,
  type GameState,
  type Suit,
  SUITS,
  applyAction,
  bidOptions,
  buildDeck,
  canAskJoker,
  cardId,
  firstLeader,
  handOutcome,
  handPoints,
  isJoker,
  legalPlays,
  rankOf,
  suitOf,
  suitPower,
  teamOf,
  trumpPower,
} from '../engine';
import { cardsPerPlayer, solveCandidates, solvePosition } from './dd';
import { handStrength, inferVoids, makeChance, sampleHands, teamEstimate, unseenCards, type Rng } from './hard';
import { cost, playout } from './policy';

export interface PimcOptions {
  /** sampled deals per decision (default 200) */
  deals?: number;
  /** time budget per decision in ms (default 1000); at least `minDeals` deals are always used */
  timeMs?: number;
  minDeals?: number;
  /** deals per trump suit in the bidding simulation (default 60) */
  bidDeals?: number;
}

const DEFAULTS = { deals: 200, timeMs: 1000, minDeals: 24, bidDeals: 60 };
/**
 * chance of making a bid (in the full-information simulations) the bot requires before it bids.
 * The simulations see every card, so they overstate what a real bidder makes; a high bar keeps the
 * bot from overbidding (a failed bid costs double).
 */
export let PIMC_MIN_MAKE = 0.7;
export function setPimcMinMake(v: number) {
  PIMC_MIN_MAKE = v;
}
/** weight of the simulation in the bid's make-chance (the rest is the hand-strength estimate) */
export let BLEND = 0.5;
export function setPimcBlend(v: number) {
  BLEND = v;
}

function withDefaults(opts: PimcOptions) {
  const o = { ...DEFAULTS };
  for (const k of Object.keys(opts) as (keyof PimcOptions)[]) if (opts[k] !== undefined) o[k] = opts[k]!;
  return o;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function winValueOf(state: GameState): number {
  return state.rules.gameEnd.targetScore;
}

/** exact search from this many cards per player down */
export function exactLimit(state: GameState): number {
  return state.numPlayers <= 4 ? 5 : 4;
}

// ---------------------------------------------------------------------------
// inference: how believable is a deal given the bidding?
// ---------------------------------------------------------------------------

function bestStrength(state: GameState, hand: CardId[]): number {
  let best = 0;
  for (const s of SUITS) best = Math.max(best, handStrength(state, hand, s));
  return best;
}

/** Likelihood of the other players' hands in `hands` given their bids / passes (me excluded). */
export function dealWeight(state: GameState, me: number, hands: CardId[][]): number {
  const partnerShare = state.numPlayers === 4 ? 1.6 : 2.4;
  const trump = state.contract?.trump ?? null;
  let w = 1;
  let high = 0;
  const strengthCache = new Map<number, number>();
  const est = (p: number) => {
    let v = strengthCache.get(p);
    if (v === undefined) {
      v = trump && state.contract!.bidder === p ? handStrength(state, hands[p], trump) : bestStrength(state, hands[p]);
      strengthCache.set(p, v);
    }
    return v;
  };
  const minBid = state.rules.bidding.minVoluntaryBid;
  for (const b of state.bids) {
    if (b.player !== me && !b.jokerAsk) {
      const team = est(b.player) + partnerShare;
      if (b.value === null) {
        // passed: a hand that could have bid above the current high bid is less likely
        const need = Math.max(minBid, high + 1);
        const pStrong = 1 / (1 + Math.exp(-(team - need - 0.3) / 0.8));
        w *= Math.max(0.15, 1 - pStrong);
      } else if (!b.forced) {
        const pOk = 1 / (1 + Math.exp(-(team - b.value + 0.8) / 0.8));
        w *= Math.max(0.1, pOk);
      }
    }
    if (b.value !== null && b.value > high) high = b.value;
  }
  return w;
}

/** Sample `n` deals consistent with what is known, focused on believable ones (importance resampling). */
export function believableDeals(state: GameState, me: number, n: number, rng: Rng): CardId[][][] {
  const voids = inferVoids(state);
  const pool = Math.min(n * 3, 900);
  const cand: CardId[][][] = [];
  const weights: number[] = [];
  for (let i = 0; i < pool; i++) {
    const h = sampleHands(state, me, voids, rng);
    cand.push(h);
    weights.push(state.bids.length ? dealWeight(state, me, h) : 1);
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return cand.slice(0, n);
  // systematic resampling
  const out: CardId[][][] = [];
  const step = sum / n;
  let u = rng() * step;
  let acc = 0;
  let i = 0;
  for (let k = 0; k < n; k++) {
    while (acc + weights[i] < u && i < cand.length - 1) acc += weights[i++];
    out.push(cand[i]);
    u += step;
  }
  return out;
}

// ---------------------------------------------------------------------------
// evaluation of a finished / decided simulated hand
// ---------------------------------------------------------------------------

function value(s: GameState, team: number): number {
  const scored = s.phase === 'handOver' || s.phase === 'gameOver';
  const o = scored ? { points: s.lastResult!.points, larensWin: s.lastResult!.larensWin } : handOutcome(s);
  const tricks = 0.01 * (s.tricksWon[team] - s.tricksWon[1 - team]); // tie-break: take tricks
  if (o.larensWin) return (s.contract!.team === team ? 1 : -1) * winValueOf(s) + tricks;
  return o.points[team] - o.points[1 - team] + tricks;
}

/** candidate cards: drop cards interchangeable with a lower one (same suit, nothing still out between) */
function candidates(state: GameState, me: number, legal: CardId[]): CardId[] {
  const rules = state.rules;
  const between = new Set([...unseenCards(state, me), ...state.trick.plays.map((p) => p.card)]);
  const out: CardId[] = [];
  for (const s of SUITS) {
    const cards = legal.filter((c) => suitOf(c) === s).sort((a, b) => suitPower(rules, rankOf(a)!) - suitPower(rules, rankOf(b)!));
    let prev: CardId | null = null;
    for (const c of cards) {
      if (prev) {
        const lo = suitPower(rules, rankOf(prev)!);
        const hi = suitPower(rules, rankOf(c)!);
        if (![...between].some((u) => suitOf(u) === s && suitPower(rules, rankOf(u)!) > lo && suitPower(rules, rankOf(u)!) < hi)) {
          prev = c;
          continue;
        }
      }
      out.push(c);
      prev = c;
    }
  }
  return [...out, ...legal.filter(isJoker)];
}

// ---------------------------------------------------------------------------
// card play
// ---------------------------------------------------------------------------

export interface PimcScore {
  card: CardId;
  mean: number;
  deals: number;
  /** the value on each deal (same deals for every card, so cards can be compared deal by deal) */
  perDeal: number[];
}

export function pimcScores(state: GameState, rng: Rng, opts: PimcOptions = {}): { scores: PimcScore[]; exact: boolean; deals: number } {
  const o = withDefaults(opts);
  const me = state.currentPlayer;
  const team = teamOf(state, me);
  const legal = legalPlays(state, me);
  const cands = candidates(state, me, legal);
  const exact = cardsPerPlayer(state) <= exactLimit(state);
  const simRules = { ...state.rules, playToLastCard: false };
  const winV = winValueOf(state);
  const per = new Map<CardId, number[]>(cands.map((c) => [c, []]));
  const t0 = now();
  const deals = believableDeals(state, me, o.deals, rng);
  let used = 0;
  for (const hands of deals) {
    if (used >= o.minDeals && now() - t0 > o.timeMs) break;
    const world: GameState = { ...state, rules: simRules, hands };
    let done = false;
    if (exact) {
      const r = solveCandidates(world, team, cands, winV, 150000);
      if (r.complete) {
        for (const c of cands) per.get(c)!.push(r.values.get(c)!);
        done = true;
      }
    }
    if (!done) {
      for (const c of cands) per.get(c)!.push(value(playout(applyAction(world, { type: 'PLAY', player: me, card: c })), team));
    }
    used++;
  }
  const scores = cands.map((card) => {
    const v = per.get(card)!;
    return { card, mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), deals: used, perDeal: v };
  });
  return { scores, exact, deals: used };
}

/** Is the hand's result already certain (bid made or broken; Bawn broken)? Then no card matters. */
export function handDecidedNow(state: GameState): boolean {
  const c = state.contract!;
  const left = state.rules.modes[state.mode].handSize - state.tricksPlayed;
  const bid = state.tricksWon[c.team];
  if (c.bawn) return state.tricksWon[1 - c.team] > (c.bawnOppTricks ?? 0);
  return bid >= c.value || bid + left < c.value;
}

export function pimcPlay(state: GameState, rng: Rng, opts: PimcOptions = {}): CardId {
  const legal = legalPlays(state, state.currentPlayer);
  if (legal.length === 1) return legal[0];
  // the result is settled: cash the strongest cards (like a person would), jokers included
  if (handDecidedNow(state)) {
    const trump = state.contract!.trump as Suit;
    return [...legal].sort((a, b) => cost(state, b, trump) - cost(state, a, trump))[0];
  }
  const { scores } = pimcScores(state, rng, opts);
  const trump = state.contract!.trump as Suit;
  const best = [...scores].sort((a, b) => b.mean - a.mean)[0];
  // a card counts as as-good-as-the-best unless it is worse by more than the sampling noise
  // (paired over the same deals); among those, the cheapest wins — never waste a joker or a high trump
  const near = scores.filter((s) => {
    if (s === best) return true;
    const d = best.perDeal.map((v, i) => v - s.perDeal[i]);
    const n = d.length;
    const mean = d.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
    return mean <= 0.005 + sd / Math.sqrt(n);
  });
  near.sort((a, b) => cost(state, a.card, trump) - cost(state, b.card, trump));
  return near[0].card;
}

// ---------------------------------------------------------------------------
// bidding, trump, joker question — by simulation
// ---------------------------------------------------------------------------

interface SuitSim {
  suit: Suit;
  /** weighted distribution of my team's tricks: P(tricks >= k) for k = 0..9 */
  atLeast: number[];
  /** the same split by whether a partner holds the other joker (for the joker question) */
  yes: { w: number; atLeast: number[] };
  no: { w: number; atLeast: number[] };
}

/** Play the hand out many times with me as the bidder and `suit` as trump. */
export function simulateSuits(state: GameState, me: number, rng: Rng, dealsPerSuit: number, value = 7, suits: readonly Suit[] = SUITS): SuitSim[] {
  const team = teamOf(state, me);
  const total = state.rules.modes[state.mode].handSize;
  const simRules = { ...state.rules, playToLastCard: true, renege: { ...state.rules.renege, allowRenege: false }, bawn: { ...state.rules.bawn, bawnOnBid: null } };
  const myJoker = state.hands[me].filter(isJoker);
  const otherJoker = myJoker.length === 1 ? state.rules.modes[state.mode].jokers.find((j) => j !== myJoker[0]) ?? null : null;
  const deals = believableDeals(state, me, dealsPerSuit, rng);
  return suits.map((suit) => {
    const hist = Array(total + 1).fill(0);
    const yesH = Array(total + 1).fill(0);
    const noH = Array(total + 1).fill(0);
    let yesW = 0;
    let noW = 0;
    for (const hands of deals) {
      const contract: Contract = {
        bidder: me,
        team: team as 0 | 1,
        value,
        forced: false,
        trump: suit,
        bidderHeldUnlockCard: hands[me].includes(cardId(suit, 14)),
        bawn: false,
      };
      const base: GameState = { ...state, rules: simRules, phase: 'playing', hands, contract, bids: [], highBid: null, tricks: [], tricksWon: [0, 0], tricksPlayed: 0, playedCards: [], lastTrick: null };
      const leader = firstLeader(base, me);
      const world: GameState = { ...base, currentPlayer: leader, trick: { leader, plays: [], ledSuit: null } };
      const end = playout(world);
      const t = end.tricksWon[team];
      hist[t]++;
      if (otherJoker) {
        const partnerHas = hands.some((h, p) => p !== me && teamOf(state, p) === team && h.includes(otherJoker));
        if (partnerHas) {
          yesH[t]++;
          yesW++;
        } else {
          noH[t]++;
          noW++;
        }
      }
    }
    const tail = (h: number[], n: number) => {
      const out = Array(total + 1).fill(0);
      let acc = 0;
      for (let k = total; k >= 0; k--) {
        acc += h[k];
        out[k] = n ? acc / n : 0;
      }
      return out;
    };
    return { suit, atLeast: tail(hist, deals.length), yes: { w: yesW / deals.length, atLeast: tail(yesH, yesW) }, no: { w: noW / deals.length, atLeast: tail(noH, noW) } };
  });
}

/** expected points of bidding v (Larens = winning the game) with chance p of making it */
function bidEV(state: GameState, v: number, forced: boolean, p: number): number {
  const r = state.rules;
  const [made] = handPoints(r, { team: 0, value: v, forced }, true);
  const [, failed] = handPoints(r, { team: 0, value: v, forced }, false);
  const win = !forced && v === r.bidding.larens && r.larens.larensWinsGame ? winValueOf(state) : made;
  return p * win - (1 - p) * failed;
}

export function pimcBid(state: GameState, rng: Rng, opts: PimcOptions = {}): Action {
  const o = withDefaults(opts);
  const me = state.currentPlayer;
  const b = state.rules.bidding;
  const opt = bidOptions(state, me);
  const sims = simulateSuits(state, me, rng, o.bidDeals);
  // blend the simulation (sees every card: optimistic) with the calibrated hand-strength estimate
  const est = teamEstimate(state, me);
  const chance = (v: number) => {
    const sim = Math.max(...sims.map((s) => s.atLeast[v]));
    return BLEND * sim + (1 - BLEND) * makeChance(est.team, v, b.larens);
  };
  const partnerHolds = state.highBid !== null && teamOf(state, state.highBid.player) === teamOf(state, me);
  const need = partnerHolds ? 0.85 : PIMC_MIN_MAKE;
  let best: { value: number; ev: number } | null = null;
  for (const v of opt.values) {
    const forced = opt.forced && v === b.malzoomBid;
    const p = chance(v);
    if (!forced && p < (v >= b.larens ? Math.max(need, 0.75) : need)) continue;
    const ev = bidEV(state, v, forced, p);
    if (!best || ev > best.ev) best = { value: v, ev };
  }
  // سؤال الجوكر: forced Larens if partner has the other joker, forced 8 if not
  if (canAskJoker(state, me)) {
    const ja = state.rules.jokerAsk;
    const s = [...sims].sort((x, y) => y.atLeast[ja.jokerAskNoBid] - x.atLeast[ja.jokerAskNoBid])[0];
    const pNo = s.no.atLeast[ja.jokerAskNoBid];
    const pYes = s.yes.atLeast[ja.jokerAskYesBid];
    const ev = s.yes.w * bidEV(state, ja.jokerAskYesBid, false, pYes) + s.no.w * bidEV(state, ja.jokerAskNoBid, false, pNo);
    const baseline = Math.max(opt.forced ? -Infinity : 0, best?.ev ?? -Infinity);
    if (pNo >= need && ev > baseline) return { type: 'JOKER_ASK', player: me };
  }
  if (opt.forced) return { type: 'BID', player: me, value: best ? best.value : b.malzoomBid };
  if (!best || best.ev <= 0) return { type: 'PASS', player: me };
  return { type: 'BID', player: me, value: best.value };
}

export function pimcTrump(state: GameState, rng: Rng, opts: PimcOptions = {}): Suit {
  const o = withDefaults(opts);
  const me = state.currentPlayer;
  const c = state.contract!;
  const sims = simulateSuits(state, me, rng, o.bidDeals, c.value);
  const ev = (s: SuitSim) => bidEV(state, c.value, c.forced, s.atLeast[c.value]) + 0.01 * s.atLeast.reduce((a, b) => a + b, 0);
  return [...sims].sort((a, b) => ev(b) - ev(a))[0].suit;
}

// ---------------------------------------------------------------------------
// Bawn: solve the remaining tricks on sampled deals
// ---------------------------------------------------------------------------

export function pimcBawnChances(state: GameState, rng: Rng, opts: PimcOptions = {}): { yes: number; no: number; deals: number } {
  const o = withDefaults(opts);
  const me = state.currentPlayer;
  const c = state.contract!;
  const team = teamOf(state, me);
  const winV = winValueOf(state);
  const rules = { ...state.rules, playToLastCard: false, renege: { ...state.rules.renege, allowRenege: false } };
  const t0 = now();
  let yes = 0;
  let no = 0;
  let used = 0;
  for (const hands of believableDeals(state, me, o.deals, rng)) {
    if (used >= o.minDeals && now() - t0 > o.timeMs) break;
    const base: GameState = { ...state, rules, phase: 'playing', currentPlayer: state.trick.leader, hands };
    const withBawn: GameState = { ...base, contract: { ...c, bawn: true, bawnOppTricks: state.tricksWon[1 - c.team] } };
    const without: GameState = { ...base, contract: { ...c, bawn: false } };
    const exact = cardsPerPlayer(base) <= exactLimit(base) + 1;
    const solve = (w: GameState) => {
      if (exact) {
        const r = solvePosition(w, team, winV, 150000);
        if (r.complete) return r.value;
      }
      return value(playout(w), team);
    };
    yes += solve(withBawn);
    no += solve(without);
    used++;
  }
  return { yes: yes / Math.max(1, used), no: no / Math.max(1, used), deals: used };
}

export function pimcBawn(state: GameState, rng: Rng, opts: PimcOptions = {}): Action {
  const r = pimcBawnChances(state, rng, opts);
  return { type: 'BAWN', player: state.currentPlayer, accept: r.yes > r.no };
}

export function pimcAction(state: GameState, rng: Rng, opts: PimcOptions = {}): Action {
  const me = state.currentPlayer;
  switch (state.phase) {
    case 'bidding':
      return pimcBid(state, rng, opts);
    case 'choosingTrump':
      return { type: 'CHOOSE_TRUMP', player: me, suit: pimcTrump(state, rng, opts) };
    case 'playing':
      return { type: 'PLAY', player: me, card: pimcPlay(state, rng, opts) };
    case 'bawnAsk':
      return pimcBawn(state, rng, opts);
    case 'review':
      return { type: 'END_REVIEW' };
    default:
      return { type: 'NEXT_HAND' };
  }
}

export { buildDeck, trumpPower };
