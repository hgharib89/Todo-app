/**
 * Hard bot.
 *
 * - Card counting: tracks every card played and knows which jokers / high cards are still out.
 * - Void inference: learns from past tricks which players can't follow which suits.
 * - Bidding: a hand-strength evaluation (jokers, trump Ace, trump length, side winners, ruffs)
 *   turned into a probability of making each bid; it only bids when the expected score is good.
 * - Play: Monte Carlo. It samples hidden hands consistent with everything it knows,
 *   plays each legal card out to the end of the hand with a partner-aware policy, and
 *   picks the card with the best average result. Ties go to the cheaper card, so jokers
 *   and the trump Ace are kept for when they matter.
 *
 * It reads only its own hand and public information (played cards, trick history, bids,
 * hand sizes), and only ever picks from engine.legalActions / legalPlays, so it always
 * obeys the active rules config.
 */
import {
  Action,
  CardId,
  GameState,
  RulesConfig,
  Suit,
  SUITS,
  Trick,
  applyAction,
  bidOptions,
  buildDeck,
  handPoints,
  provisionalPoints,
  isJoker,
  legalPlays,
  nextSeat,
  rankOf,
  suitOf,
  suitPower,
  teamOf,
  totalTricks,
  trumpPower,
  winningPlayIndex,
} from '../engine';

export type Rng = () => number;

export interface HardOptions {
  /** number of sampled deals per decision (more = stronger and slower) */
  samples?: number;
}

export const HARD_DEFAULT_SAMPLES = 40;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const trumpLike = (c: CardId, trump: Suit) => isJoker(c) || suitOf(c) === trump;

/** How "expensive" a card is to give away. Lower = cheaper. Jokers are the most valuable. */
export function cardCost(rules: RulesConfig, c: CardId, trump: Suit): number {
  if (isJoker(c)) return 100 + trumpPower(rules, c);
  if (suitOf(c) === trump) return 40 + trumpPower(rules, c);
  return suitPower(rules, rankOf(c)!);
}

/** Does `challenger` beat `current` in a trick led with `ledSuit`? */
function beats(rules: RulesConfig, challenger: CardId, current: CardId, ledSuit: Suit | null, trump: Suit): boolean {
  const led = ledSuit ?? (isJoker(current) ? trump : suitOf(current));
  const t: Trick = {
    leader: 0,
    ledSuit: led,
    plays: [
      { player: 0, card: current, cancelled: false },
      { player: 1, card: challenger, cancelled: false },
    ],
  };
  return winningPlayIndex(rules, t, trump) === 1;
}

/** The trick after `player` plays `card` (approximate: sets the led suit like the engine does). */
function withPlay(trick: Trick, player: number, card: CardId): Trick {
  const ledSuit = trick.ledSuit ?? (isJoker(card) ? null : suitOf(card));
  return { ...trick, ledSuit, plays: [...trick.plays, { player, card, cancelled: false }] };
}

/** Seats still to play in the current trick after `me`. */
function seatsAfter(state: GameState, me: number): number[] {
  const left = state.numPlayers - state.trick.plays.length - 1;
  const out: number[] = [];
  let p = me;
  for (let i = 0; i < left; i++) {
    p = nextSeat(state, p);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// card counting & inference (only public info + own hand)
// ---------------------------------------------------------------------------

/** Cards that are in someone else's hand: the deck minus my hand minus everything played. */
export function unseenCards(state: GameState, me: number): CardId[] {
  const mine = new Set(state.hands[me]);
  const played = new Set(state.playedCards);
  return buildDeck(state.rules, state.mode).filter((c) => !mine.has(c) && !played.has(c));
}

export interface CardCount {
  /** cards still out (in other players' hands) */
  unseen: CardId[];
  /** jokers still out */
  jokersOut: CardId[];
  /** trump-like cards still out, strongest first */
  trumpsOut: CardId[];
  /** the highest card still out in each plain suit (null if none) */
  highestOut: Record<Suit, CardId | null>;
}

export function countCards(state: GameState, me: number): CardCount {
  const unseen = unseenCards(state, me);
  const trump = state.contract?.trump ?? null;
  const rules = state.rules;
  const highestOut = { S: null, H: null, D: null, C: null } as Record<Suit, CardId | null>;
  for (const c of unseen) {
    if (isJoker(c)) continue;
    const s = suitOf(c)!;
    const h = highestOut[s];
    if (!h || suitPower(rules, rankOf(c)!) > suitPower(rules, rankOf(h)!)) highestOut[s] = c;
  }
  const trumpsOut = trump
    ? unseen.filter((c) => trumpLike(c, trump)).sort((a, b) => trumpPower(rules, b) - trumpPower(rules, a))
    : unseen.filter(isJoker);
  return { unseen, jokersOut: unseen.filter(isJoker), trumpsOut, highestOut };
}

/** Index of the play that fixed the trick's led suit, or -1 if none yet. */
function suitSetAt(trick: Trick, rules: RulesConfig): number {
  for (let i = 0; i < trick.plays.length; i++) {
    const p = trick.plays[i];
    if (!isJoker(p.card)) return i;
    if (i === 0 && !p.cancelled && rules.jokers.ledJokerCountsAsTrump) return 0;
  }
  return -1;
}

/**
 * For each seat, the suits it has shown it doesn't hold: a player who didn't follow
 * the led suit with a normal card (or played a joker where the rules only allow that
 * when out of the suit) has none left.
 */
export function inferVoids(state: GameState): Set<Suit>[] {
  const voids = Array.from({ length: state.numPlayers }, () => new Set<Suit>());
  const trump = state.contract?.trump ?? null;
  const jr = state.rules.jokers;
  for (const t of [...(state.tricks ?? []), state.trick]) {
    // a card of a suit proves its player held that suit (an earlier "void" was a renege)
    for (const p of t.plays) if (!isJoker(p.card)) voids[p.player].delete(suitOf(p.card)!);
    if (!t.ledSuit) continue;
    const from = suitSetAt(t, state.rules);
    if (from < 0) continue;
    for (let i = from + 1; i < t.plays.length; i++) {
      const p = t.plays[i];
      if (isJoker(p.card)) {
        if (!jr.canPlayWhileHoldingLedSuit && t.ledSuit !== trump) voids[p.player].add(t.ledSuit);
      } else if (suitOf(p.card) !== t.ledSuit) {
        voids[p.player].add(t.ledSuit);
      }
    }
  }
  return voids;
}

/**
 * Deal the unseen cards to the other players at random, respecting their hand sizes
 * and known voids. Falls back to ignoring voids if no consistent deal is found.
 */
export function sampleHands(state: GameState, me: number, voids: Set<Suit>[], rng: Rng): CardId[][] {
  const unseen = unseenCards(state, me);
  const n = state.numPlayers;
  const need = state.hands.map((h, i) => (i === me ? 0 : h.length));
  const allowed = (p: number, c: CardId, strict: boolean) => !strict || isJoker(c) || !voids[p].has(suitOf(c)!);

  for (let attempt = 0; attempt < 40; attempt++) {
    const strict = attempt < 30;
    const cap = need.slice();
    const hands: CardId[][] = Array.from({ length: n }, () => []);
    const order = unseen.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // most constrained cards first
    const elig = (c: CardId) => need.filter((k, p) => k > 0 && allowed(p, c, strict)).length;
    order.sort((a, b) => elig(a) - elig(b));
    let ok = true;
    let left = cap.reduce((x, y) => x + y, 0);
    for (const c of order) {
      if (left === 0) break; // every hand is full (extra unseen cards only occur in hand-built positions)
      let total = 0;
      for (let p = 0; p < n; p++) if (cap[p] > 0 && allowed(p, c, strict)) total += cap[p];
      if (total === 0) {
        if (unseen.length > need.reduce((x, y) => x + y, 0)) continue;
        ok = false;
        break;
      }
      let r = rng() * total;
      let pick = -1;
      for (let p = 0; p < n; p++) {
        if (cap[p] > 0 && allowed(p, c, strict)) {
          r -= cap[p];
          pick = p;
          if (r < 0) break;
        }
      }
      hands[pick].push(c);
      cap[pick]--;
      left--;
    }
    if (ok && left === 0) {
      hands[me] = state.hands[me].slice();
      return hands;
    }
  }
  // unreachable in practice (the non-strict attempts always succeed)
  return state.hands.map((h) => h.slice());
}

// ---------------------------------------------------------------------------
// rollout policy (used inside the simulations, where every hand is "known")
// ---------------------------------------------------------------------------

function opponentCanBeat(s: GameState, me: number, trick: Trick, card: CardId, later: number[]): boolean {
  const trump = s.contract!.trump as Suit;
  const myTeam = teamOf(s, me);
  for (const p of later) {
    if (teamOf(s, p) === myTeam) continue;
    const hand = s.hands[p];
    const follow = trick.ledSuit ? hand.filter((c) => suitOf(c) === trick.ledSuit) : [];
    const options = follow.length ? [...follow, ...hand.filter(isJoker)] : hand;
    if (options.some((c) => beats(s.rules, c, card, trick.ledSuit, trump))) return true;
  }
  return false;
}

/** A fast partner-aware policy: draw trumps, cash winners, don't overtake partner, win cheaply. */
export function rolloutCard(s: GameState): CardId {
  const me = s.currentPlayer;
  const legal = legalPlays(s, me);
  if (legal.length === 1) return legal[0];
  const c = s.contract!;
  const trump = c.trump as Suit;
  const rules = s.rules;
  const byCost = [...legal].sort((a, b) => cardCost(rules, a, trump) - cardCost(rules, b, trump));
  const cheapest = byCost.find((x) => !isJoker(x)) ?? byCost[0];
  const myTeam = teamOf(s, me);
  const trick = s.trick;

  if (trick.plays.length === 0) {
    const opps = s.hands.flatMap((h, p) => (teamOf(s, p) !== myTeam ? h : []));
    const oppTrumpMax = Math.max(-1, ...opps.filter((x) => trumpLike(x, trump)).map((x) => trumpPower(rules, x)));
    if (myTeam === c.team && oppTrumpMax >= 0) {
      const boss = legal
        .filter((x) => trumpLike(x, trump) && trumpPower(rules, x) > oppTrumpMax)
        .sort((a, b) => Number(isJoker(a)) - Number(isJoker(b)) || cardCost(rules, a, trump) - cardCost(rules, b, trump));
      if (boss.length) return boss[0];
    }
    const others = s.hands.flatMap((h, p) => (p !== me ? h : []));
    const side = legal.filter((x) => !trumpLike(x, trump));
    for (const x of [...side].sort((a, b) => cardCost(rules, b, trump) - cardCost(rules, a, trump))) {
      const st = suitOf(x);
      const higher = others.some((o) => suitOf(o) === st && suitPower(rules, rankOf(o)!) > suitPower(rules, rankOf(x)!));
      const ruffable = s.hands.some(
        (h, p) => teamOf(s, p) !== myTeam && !h.some((o) => suitOf(o) === st) && h.some((o) => trumpLike(o, trump)),
      );
      if (!higher && !ruffable) return x;
    }
    if (side.length) {
      const len = (st: Suit | null) => s.hands[me].filter((h) => suitOf(h) === st).length;
      return side.sort((a, b) => len(suitOf(b)) - len(suitOf(a)) || cardCost(rules, a, trump) - cardCost(rules, b, trump))[0];
    }
    return cheapest;
  }

  const later = seatsAfter(s, me);
  const wi = winningPlayIndex(rules, trick, trump);
  if (wi >= 0 && teamOf(s, trick.plays[wi].player) === myTeam && !opponentCanBeat(s, me, trick, trick.plays[wi].card, later)) {
    return cheapest; // partner has it: feed a low card
  }
  const winners = byCost.filter((x) => {
    const t = withPlay(trick, me, x);
    const w = winningPlayIndex(rules, t, trump);
    return w >= 0 && t.plays[w].player === me;
  });
  for (const x of winners) {
    if (!opponentCanBeat(s, me, withPlay(trick, me, x), x, later)) return x;
  }
  return cheapest;
}

/** Play the hand out from `s` with the rollout policy. */
function rollout(s: GameState): GameState {
  let guard = 0;
  while (s.phase === 'playing' && s.hands[s.currentPlayer].length > 0 && guard++ < 200) {
    s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card: rolloutCard(s) });
  }
  return s;
}

/** Score of a finished hand from `team`'s point of view: points difference, plus a little for tricks. */
function handValue(s: GameState, team: number): number {
  const other = 1 - team;
  // a finished simulation is either in review (all cards played) or scored (handOver/gameOver)
  const points = s.phase === 'review' || s.phase === 'playing' ? provisionalPoints(s) : s.lastResult!.points;
  return points[team] - points[other] + 0.05 * (s.tricksWon[team] - s.tricksWon[other]);
}

// ---------------------------------------------------------------------------
// Monte Carlo card play
// ---------------------------------------------------------------------------

/** Drop cards that are interchangeable (same suit, nothing still out between them): keep the lowest. */
function distinctCandidates(state: GameState, me: number, legal: CardId[]): CardId[] {
  const rules = state.rules;
  // a card "between" two of mine that is still out, or on the table right now, makes them differ
  const between = new Set([...unseenCards(state, me), ...state.trick.plays.map((p) => p.card)]);
  const out: CardId[] = [];
  for (const s of SUITS) {
    const cards = legal.filter((c) => suitOf(c) === s).sort((a, b) => suitPower(rules, rankOf(a)!) - suitPower(rules, rankOf(b)!));
    let prev: CardId | null = null;
    for (const c of cards) {
      if (prev) {
        const lo = suitPower(rules, rankOf(prev)!);
        const hi = suitPower(rules, rankOf(c)!);
        const gap = [...between].some((u) => suitOf(u) === s && suitPower(rules, rankOf(u)!) > lo && suitPower(rules, rankOf(u)!) < hi);
        if (!gap) {
          prev = c;
          continue; // equivalent to the lower card already kept
        }
      }
      out.push(c);
      prev = c;
    }
  }
  return [...out, ...legal.filter(isJoker)];
}

export interface MoveScore {
  card: CardId;
  /** average hand value over the samples (points difference for my team) */
  expected: number;
  /** final score after tie-breaks */
  score: number;
}

export function monteCarloScores(state: GameState, rng: Rng, samples = HARD_DEFAULT_SAMPLES): MoveScore[] {
  const me = state.currentPlayer;
  const legal = legalPlays(state, me);
  const trump = state.contract!.trump as Suit;
  const myTeam = teamOf(state, me);
  const cands = distinctCandidates(state, me, legal);
  const voids = inferVoids(state);
  const totals = new Map<CardId, number>(cands.map((c) => [c, 0]));
  const simRules = { ...state.rules, playToLastCard: false };
  for (let k = 0; k < samples; k++) {
    // simulations may stop once the result is decided (later tricks can't change the points)
    const world: GameState = { ...state, rules: simRules, hands: sampleHands(state, me, voids, rng) };
    for (const card of cands) {
      const end = rollout(applyAction(world, { type: 'PLAY', player: me, card }));
      totals.set(card, totals.get(card)! + handValue(end, myTeam));
    }
  }
  const trick = state.trick;
  const wi = winningPlayIndex(state.rules, trick, trump);
  const partnerWinning = wi >= 0 && teamOf(state, trick.plays[wi].player) === myTeam;
  return cands.map((card) => {
    const expected = totals.get(card)! / samples;
    let score = expected - 0.0005 * cardCost(state.rules, card, trump);
    if (partnerWinning) {
      const t = withPlay(trick, me, card);
      const w = winningPlayIndex(state.rules, t, trump);
      if (w >= 0 && t.plays[w].player === me) score -= 0.05; // don't overtake partner without a reason
    }
    return { card, expected, score };
  });
}

export function hardPlay(state: GameState, rng: Rng, samples = HARD_DEFAULT_SAMPLES): CardId {
  const legal = legalPlays(state, state.currentPlayer);
  if (legal.length === 1) return legal[0];
  const scores = monteCarloScores(state, rng, samples);
  scores.sort((a, b) => b.score - a.score);
  return scores[0].card;
}

// ---------------------------------------------------------------------------
// hand evaluation, trump choice and bidding
// ---------------------------------------------------------------------------

/** Expected number of tricks this hand takes by itself with `trump` (above the trick count = extra safety). */
export function handStrength(state: Pick<GameState, 'rules' | 'mode' | 'numPlayers'>, hand: CardId[], trump: Suit): number {
  const rules = state.rules;
  const n = state.numPlayers;
  const deck = buildDeck(rules, state.mode);
  const mine = new Set(hand);
  let est = 0;

  // trumps (jokers included), by how many stronger ones are missing from my hand
  const deckTrumps = deck.filter((c) => trumpLike(c, trump)).sort((a, b) => trumpPower(rules, b) - trumpPower(rules, a));
  const myTrumps = deckTrumps.filter((c) => mine.has(c));
  const L = myTrumps.length;
  let topWinners = 0;
  for (const c of myTrumps) {
    const k = deckTrumps.slice(0, deckTrumps.indexOf(c)).filter((x) => !mine.has(x)).length;
    let v: number;
    if (k === 0) v = 1;
    else if (L > k) v = k === 1 ? 0.75 : k === 2 ? 0.55 : 0.3;
    else v = k === 1 ? 0.4 : k === 2 ? 0.2 : 0.05;
    if (v >= 0.55) topWinners++;
    est += v;
  }
  // long trumps take extra tricks once the others' trumps are gone
  const othersTrumps = deckTrumps.length - L;
  const perOpp = othersTrumps / (n - 1);
  est += Math.max(0, L - Math.max(3, Math.ceil(perOpp) + 1)) * (n === 4 ? 0.6 : 0.5);

  // side suits
  let ruffs = 0;
  for (const s of SUITS) {
    if (s === trump) continue;
    const suitCards = deck.filter((c) => suitOf(c) === s).sort((a, b) => suitPower(rules, rankOf(b)!) - suitPower(rules, rankOf(a)!));
    const my = suitCards.filter((c) => mine.has(c));
    const len = my.length;
    if (len === 0) ruffs += 2;
    else if (len === 1) ruffs += 1;
    for (const c of my) {
      const k = suitCards.slice(0, suitCards.indexOf(c)).filter((x) => !mine.has(x)).length;
      const pos = my.indexOf(c);
      let v = 0;
      if (k === 0) v = (n === 4 ? 0.9 : 0.75) - Math.max(0, len - 3) * 0.1 - pos * 0.1;
      else if (k === 1 && len >= 2) v = n === 4 ? 0.45 : 0.3;
      else if (k === 2 && len >= 3) v = n === 4 ? 0.15 : 0.08;
      est += Math.max(0, v);
    }
  }
  // ruffing short side suits needs spare trumps
  const spare = Math.max(0, L - Math.max(1, topWinners));
  est += Math.min(ruffs, spare) * (n === 4 ? 0.3 : 0.25);
  // not capped at the number of tricks: anything above it is a safety margin (matters for Bawan)
  return est;
}

export function chooseTrump(state: Pick<GameState, 'rules' | 'mode' | 'numPlayers'>, hand: CardId[]): { suit: Suit; strength: number } {
  let best: { suit: Suit; strength: number } = { suit: 'S', strength: -1 };
  for (const s of SUITS) {
    const v = handStrength(state, hand, s) + 0.01 * hand.filter((c) => suitOf(c) === s).length;
    if (v > best.strength) best = { suit: s, strength: v };
  }
  return { suit: best.suit, strength: handStrength(state, hand, best.suit) };
}

/** My team's expected tricks, combining my hand with what the bidding says about the others. */
export function teamEstimate(state: GameState, me: number): { own: number; team: number; trump: Suit } {
  const { suit, strength } = chooseTrump(state, state.hands[me]);
  const n = state.numPlayers;
  const total = totalTricks(state);
  const partners = n / 2 - 1;
  let partnerTricks = ((total - strength) * partners) / (n - 1) * 0.85;
  const myTeam = teamOf(state, me);
  for (const b of state.bids) {
    if (b.player === me) continue;
    const partner = teamOf(state, b.player) === myTeam;
    if (b.value === null) partnerTricks += partner ? -0.3 : 0.1;
    else partnerTricks += partner ? 0.7 : -0.5;
  }
  // calibration from simulated hands: the raw estimate runs a little low, more so in Bo 6
  const bias = n === 6 ? 0.5 : 0.15;
  return { own: strength, team: strength + Math.max(0, partnerTricks) + bias, trump: suit };
}

/**
 * Chance of making `value` tricks given an expected `team` tricks (fitted to simulated hands:
 * at estimate = bid about 60% are made, one trick above about 85%). Bawan is judged more strictly.
 */
export function makeChance(team: number, value: number, bawan: number): number {
  if (value >= bawan) return 1 / (1 + Math.exp(-(team - value - 0.3) / 0.5));
  return 1 / (1 + Math.exp(-(team - value + 0.3) / 0.8));
}

/**
 * The minimum chance of making a bid that the Hard bot accepts. A failed bid costs double,
 * so anything under 2/3 loses points on average; this keeps a small safety margin.
 */
export const HARD_MIN_MAKE_CHANCE = 0.7;

export function hardBid(state: GameState): Action {
  const me = state.currentPlayer;
  const opts = bidOptions(state, me);
  const rules = state.rules;
  const b = rules.bidding;
  const { own, team } = teamEstimate(state, me);
  const myTeam = teamOf(state, me);
  const partnerHolds = state.highBid !== null && teamOf(state, state.highBid.player) === myTeam;

  let best: { value: number; ev: number } | null = null;
  for (const v of opts.values) {
    const forced = opts.forced && v === b.malzoomBid;
    const p = makeChance(team, v, b.bawan);
    if (v >= b.bawan && own < totalTricks(state) - 1.5) continue; // Bawan needs a monster hand of my own
    const [made] = handPoints(rules, { team: 0, value: v, forced }, true);
    const [, failed] = handPoints(rules, { team: 0, value: v, forced }, false);
    const ev = p * made - (1 - p) * failed;
    const need = forced ? 0 : partnerHolds ? 0.85 : HARD_MIN_MAKE_CHANCE;
    if (!forced && p < need) continue;
    if (!best || ev > best.ev) best = { value: v, ev };
  }
  if (opts.forced) return { type: 'BID', player: me, value: best ? best.value : b.malzoomBid };
  if (!best || best.ev <= 0) return { type: 'PASS', player: me };
  return { type: 'BID', player: me, value: best.value };
}
