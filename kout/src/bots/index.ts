/**
 * Bots. They pick from the engine's legal moves, so they obey the active rules config,
 * and they read only public information + their own hand (never state.reneges).
 * Easy/Medium bots may renege by mistake (rules.renege.botRenegeChance); Hard never does.
 * Catches (صيد) are decided from visible evidence only: see chooseBotCatch.
 */
import {
  Action,
  BLACK_JOKER,
  CardId,
  GameState,
  RED_JOKER,
  Suit,
  SUITS,
  Trick,
  bidOptions,
  canAskJoker,
  buildDeck,
  isJoker,
  catchOptions,
  legalActions,
  legalPlays,
  playableCards,
  rankOf,
  suitOf,
  teamOf,
  trumpPower,
  suitPower,
  winningPlayIndex,
} from '../engine';
import { HARD_DEFAULT_SAMPLES, HardOptions, Rng, chooseTrump, hardBawn, hardBid, hardPlay } from './hard';
import { pimcAction, type PimcOptions } from './pimc';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type { Rng };
export * from './hard';
export * from './pimc';

export function chooseBotAction(state: GameState, difficulty: Difficulty, rng: Rng = Math.random, opts: HardOptions & PimcOptions = {}): Action {
  const acts = legalActions(state);
  if (acts.length === 0) throw new Error('No legal action');
  if (state.phase === 'playing') {
    const mistake = renegeMistake(state, difficulty, rng);
    if (mistake) return mistake;
  }
  if (difficulty === 'hard') return pimcAction(state, rng, pimcOptions(opts));
  if (state.phase === 'bawnAsk') return simpleBawn(state, difficulty, rng);
  if (difficulty === 'easy') return easyAction(state, acts, rng);
  switch (state.phase) {
    case 'bidding':
      return mediumBid(state);
    case 'choosingTrump':
      return { type: 'CHOOSE_TRUMP', player: state.currentPlayer, suit: bestTrump(state, state.hands[state.currentPlayer]).suit };
    case 'playing':
      return { type: 'PLAY', player: state.currentPlayer, card: mediumPlay(state) };
    default:
      return acts[0];
  }
}

/** `samples` (older option name) = sampled deals per decision */
function pimcOptions(opts: HardOptions & PimcOptions): PimcOptions {
  const out: PimcOptions = {};
  if (opts.deals ?? opts.samples) out.deals = opts.deals ?? opts.samples;
  if (opts.timeMs !== undefined) out.timeMs = opts.timeMs;
  if (opts.minDeals !== undefined) out.minDeals = opts.minDeals;
  if (opts.bidDeals !== undefined) out.bidDeals = opts.bidDeals;
  return out;
}

/**
 * The previous Hard bot (v1: heuristic bidding, 40 Monte Carlo rollouts with a simple policy).
 * Kept only to benchmark the new bot against it.
 */
export function legacyHardAction(state: GameState, rng: Rng = Math.random, opts: HardOptions = {}): Action {
  return hardAction(state, legalActions(state), rng, opts);
}

function hardAction(state: GameState, acts: Action[], rng: Rng, opts: HardOptions): Action {
  const me = state.currentPlayer;
  switch (state.phase) {
    case 'bidding':
      return hardBid(state);
    case 'choosingTrump':
      return { type: 'CHOOSE_TRUMP', player: me, suit: chooseTrump(state, state.hands[me]).suit };
    case 'playing':
      return { type: 'PLAY', player: me, card: hardPlay(state, rng, opts.samples ?? HARD_DEFAULT_SAMPLES) };
    case 'bawnAsk':
      return hardBawn(state, rng, opts.samples ?? HARD_DEFAULT_SAMPLES);
    default:
      return acts[0];
  }
}

/**
 * Easy/Medium answer to "تبي باون؟": yes when the bidder holds a sure winner (no higher card still
 * out) for every remaining trick. Easy sometimes says yes on a hunch.
 */
function simpleBawn(state: GameState, difficulty: Difficulty, rng: Rng): Action {
  const me = state.currentPlayer;
  const trump = state.contract!.trump as Suit;
  const left = state.hands[me].length;
  const sure = state.hands[me].filter((c) => isBoss(state, me, c, trump)).length;
  const accept = sure >= left || (difficulty === 'easy' && rng() < 0.15);
  return { type: 'BAWN', player: me, accept };
}

// ---------------------------------------------------------------------------
// Reneging by mistake, and catching (صيد)
// ---------------------------------------------------------------------------

/** With rules.renege.botRenegeChance[difficulty], play a wrong (off-suit) card while holding the led suit. */
function renegeMistake(state: GameState, difficulty: Difficulty, rng: Rng): Action | null {
  const chance = state.rules.renege.allowRenege ? state.rules.renege.botRenegeChance[difficulty] ?? 0 : 0;
  if (chance <= 0) return null;
  const me = state.currentPlayer;
  const legal = legalPlays(state, me);
  const wrong = playableCards(state, me).filter((c) => !legal.includes(c));
  if (wrong.length === 0 || rng() >= chance) return null;
  return { type: 'PLAY', player: me, card: wrong[Math.floor(rng() * wrong.length)] };
}

/** A stable pseudo-random number in [0, 1) from public facts, so each bot decides once per piece of evidence. */
function stableRoll(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Should bot `seat` call صيد now? Uses only visible evidence (an opponent showed out of a suit,
 * then played it later). Each bot rolls rules.renege.botCatchChance[difficulty] once per piece of
 * evidence during play, and once more in the end-of-hand review. Hard always catches.
 */
export function chooseBotCatch(state: GameState, seat: number, difficulty: Difficulty): Action | null {
  if (!state.rules.renege.allowRenege) return null;
  const chance = state.rules.renege.botCatchChance[difficulty] ?? 0;
  const first = state.tricks[0]?.plays.map((p) => p.card).join('') ?? '';
  for (const e of catchOptions(state, seat)) {
    const key = `${state.handNumber}|${state.dealer}|${first}|${seat}|${e.accused}|${e.trick}|${state.phase === 'review' ? 'r' : 'p'}`;
    if (chance >= 1 || stableRoll(key) < chance) return { type: 'CATCH', player: seat, accused: e.accused, trick: e.trick };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Easy: random legal moves (bidding biased toward passing so games feel sane)
// ---------------------------------------------------------------------------
function easyAction(state: GameState, acts: Action[], rng: Rng): Action {
  if (state.phase === 'bidding') {
    const ask = acts.find((a) => a.type === 'JOKER_ASK');
    if (ask && rng() < 0.1) return ask;
    const pass = acts.find((a) => a.type === 'PASS');
    if (pass && rng() < 0.7) return pass;
    const bids = acts.filter((a) => a.type === 'BID');
    // prefer the lowest few bids
    const pool = bids.slice(0, Math.min(2, bids.length));
    return pool.length ? pool[Math.floor(rng() * pool.length)] : acts[0];
  }
  if (state.phase === 'playing') {
    const legal = legalPlays(state, state.currentPlayer); // mistakes are handled by renegeMistake
    return { type: 'PLAY', player: state.currentPlayer, card: legal[Math.floor(rng() * legal.length)] };
  }
  return acts[Math.floor(rng() * acts.length)];
}

// ---------------------------------------------------------------------------
// Medium: hand evaluation
// ---------------------------------------------------------------------------

/** Rough number of tricks this hand should take by itself with `trump`. */
export function estimateTricks(state: GameState, hand: CardId[], trump: Suit): number {
  const n = state.numPlayers;
  let est = 0;
  const trumps = hand.filter((c) => suitOf(c) === trump).map((c) => rankOf(c)!);
  const tLen = trumps.length;
  if (hand.includes(RED_JOKER)) est += 1;
  if (hand.includes(BLACK_JOKER)) est += 0.85;
  const ranked = [...trumps].sort((a, b) => b - a);
  for (const r of ranked) {
    if (r === 14) est += 1;
    else if (r === 13) est += tLen >= 2 ? 0.75 : 0.35;
    else if (r === 12) est += tLen >= 3 ? 0.5 : 0.2;
    else if (r === 11) est += tLen >= 4 ? 0.4 : 0.1;
  }
  est += Math.max(0, tLen - 3) * 0.6;
  for (const s of SUITS) {
    if (s === trump) continue;
    const cards = hand.filter((c) => suitOf(c) === s).map((c) => rankOf(c)!);
    if (cards.includes(14)) est += n === 6 ? 0.7 : 0.85;
    if (cards.includes(13) && cards.length >= 2) est += n === 6 ? 0.3 : 0.4;
    if (tLen >= 2 && cards.length === 0) est += 0.35;
    else if (tLen >= 2 && cards.length === 1) est += 0.15;
  }
  return est;
}

export function bestTrump(state: GameState, hand: CardId[]): { suit: Suit; est: number } {
  let best: { suit: Suit; est: number } = { suit: 'S', est: -1 };
  for (const s of SUITS) {
    const e = estimateTricks(state, hand, s);
    if (e > best.est) best = { suit: s, est: e };
  }
  return best;
}

function mediumBid(state: GameState): Action {
  const p = state.currentPlayer;
  const opts = bidOptions(state, p);
  const { est } = bestTrump(state, state.hands[p]);
  const partners = state.numPlayers / 2 - 1;
  const partnerShare = state.numPlayers === 6 ? 1.45 : 2.5;
  const team = est + partners * partnerShare;
  const larens = state.rules.bidding.larens;
  let target = Math.floor(team);
  if (target >= larens && team < larens + 0.8) target = larens - 1; // Larens only with a monster hand

  // سؤال الجوكر: with one joker and a strong hand, ask partner (forces Larens or 8)
  if (canAskJoker(state, p) && est >= (state.numPlayers === 6 ? 4.5 : 5)) return { type: 'JOKER_ASK', player: p };

  if (opts.forced) {
    const v = opts.values.filter((x) => x <= Math.max(target, opts.values[0]));
    return { type: 'BID', player: p, value: v[0] };
  }
  const partnerHigh = state.highBid && teamOf(state, state.highBid.player) === teamOf(state, p);
  const possible = opts.values.filter((v) => v <= target);
  if (possible.length === 0 || (partnerHigh && target < (state.highBid!.value as number) + 2)) {
    return { type: 'PASS', player: p };
  }
  const min = possible[0];
  const value = target - min >= 2 && possible.includes(min + 1) ? min + 1 : min;
  return { type: 'BID', player: p, value };
}

// ---------------------------------------------------------------------------
// Medium: card play
// ---------------------------------------------------------------------------

function unseenCards(state: GameState, me: number): CardId[] {
  const mine = new Set(state.hands[me]);
  const played = new Set(state.playedCards);
  return buildDeck(state.rules, state.mode).filter((c) => !mine.has(c) && !played.has(c));
}

function isTrumpLike(c: CardId, trump: Suit) {
  return isJoker(c) || suitOf(c) === trump;
}

/** True if no unseen card can beat `card` in its own category. */
function isBoss(state: GameState, me: number, card: CardId, trump: Suit): boolean {
  const unseen = unseenCards(state, me);
  if (isTrumpLike(card, trump)) {
    const p = trumpPower(state.rules, card);
    return !unseen.some((u) => isTrumpLike(u, trump) && trumpPower(state.rules, u) > p);
  }
  const s = suitOf(card);
  const p = suitPower(state.rules, rankOf(card)!);
  return !unseen.some((u) => suitOf(u) === s && suitPower(state.rules, rankOf(u)!) > p);
}

/** Lower = cheaper to give away. */
function cost(state: GameState, card: CardId, trump: Suit): number {
  if (isJoker(card)) return 100 + trumpPower(state.rules, card);
  if (suitOf(card) === trump) return 40 + trumpPower(state.rules, card);
  return suitPower(state.rules, rankOf(card)!);
}

function simulateTrick(trick: Trick, player: number, card: CardId): Trick {
  const ledSuit = trick.ledSuit ?? (isJoker(card) ? null : suitOf(card));
  return { ...trick, ledSuit, plays: [...trick.plays, { player, card, cancelled: false }] };
}

function wouldWin(state: GameState, me: number, card: CardId, trump: Suit): boolean {
  const t = simulateTrick(state.trick, me, card);
  const i = winningPlayIndex(state.rules, t, trump);
  return i >= 0 && t.plays[i].player === me;
}

function mediumPlay(state: GameState): CardId {
  const me = state.currentPlayer;
  const legal = legalPlays(state, me);
  if (legal.length === 1) return legal[0];
  const c = state.contract!;
  const trump = c.trump as Suit;
  const byCost = [...legal].sort((a, b) => cost(state, a, trump) - cost(state, b, trump));
  const weBid = teamOf(state, me) === c.team;
  const trick = state.trick;

  // ---- leading ----
  if (trick.plays.length === 0) {
    const unseen = unseenCards(state, me);
    const oppTrumpsOut = unseen.some((u) => isTrumpLike(u, trump));
    const myTrumps = legal.filter((x) => isTrumpLike(x, trump));
    // bidders draw trumps with a boss trump (non-joker first, to save jokers)
    if (weBid && oppTrumpsOut) {
      const bossT = myTrumps
        .filter((x) => isBoss(state, me, x, trump))
        .sort((a, b) => Number(isJoker(a)) - Number(isJoker(b)));
      if (bossT.length && !(isJoker(bossT[0]) && myTrumps.length === 1 && legal.length > 2)) return bossT[0];
    }
    // cash side-suit winners
    const bossSide = legal.filter((x) => !isTrumpLike(x, trump) && isBoss(state, me, x, trump));
    if (bossSide.length) return bossSide.sort((a, b) => cost(state, b, trump) - cost(state, a, trump))[0];
    // low card from the longest side suit
    const side = legal.filter((x) => !isTrumpLike(x, trump));
    if (side.length) {
      const len = (s: Suit | null) => state.hands[me].filter((h) => suitOf(h) === s).length;
      return side.sort((a, b) => len(suitOf(b)) - len(suitOf(a)) || cost(state, a, trump) - cost(state, b, trump))[0];
    }
    return byCost.find((x) => !isJoker(x)) ?? byCost[0];
  }

  // ---- following ----
  const wi = winningPlayIndex(state.rules, trick, trump);
  const winner = wi >= 0 ? trick.plays[wi].player : -1;
  const remaining = state.numPlayers - trick.plays.length - 1;
  const partnerWinning = winner >= 0 && teamOf(state, winner) === teamOf(state, me);
  const cheapNonJoker = byCost.find((x) => !isJoker(x)) ?? byCost[0];

  if (partnerWinning) {
    const winCard = trick.plays[wi].card;
    const safe = remaining === 0 || isBoss(state, me, winCard, trump);
    if (safe) return cheapNonJoker;
  }
  const winners = byCost.filter((x) => wouldWin(state, me, x, trump));
  if (winners.length === 0) return cheapNonJoker;
  if (remaining === 0) return winners[0];
  // not last: prefer the cheapest guaranteed winner
  const bossWinners = winners.filter((x) => isBoss(state, me, x, trump));
  if (bossWinners.length) {
    const b = bossWinners[0];
    // avoid burning a joker early when a cheap non-joker winner exists
    const cheap = winners[0];
    if (isJoker(b) && !isJoker(cheap) && remaining <= 1) return cheap;
    return b;
  }
  const cheapest = winners[0];
  if (isJoker(cheapest)) return cheapNonJoker; // jokers that can still be beaten are saved
  return partnerWinning ? cheapNonJoker : cheapest;
}
