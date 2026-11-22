/**
 * Pure Kout state machine:  applyAction(state, action) → new state.
 * No UI code, no globals, no Math.random — every rule comes from state.rules
 * (a RulesConfig from rules.config.ts) and randomness from state.seed.
 *
 * Seats are numbered 0..n-1 in COUNTER-CLOCKWISE order, so "the player to the
 * right" of seat i is (i + 1) % n. Dealing, bidding and play all go that way.
 */
import {
  BLACK_JOKER,
  CardId,
  RANK_NAME_TO_RANK,
  buildDeck,
  cardId,
  isJoker,
  suitOf,
  suitPower,
  rankOf,
  trumpPower,
} from './cards';
import type { ModeId, RulesConfig, Suit } from './rules.config';
import { randomInt, shuffle } from './rng';

export type Team = 0 | 1;
export type Phase = 'bidding' | 'choosingTrump' | 'playing' | 'handOver' | 'gameOver';

export interface BidEntry {
  player: number;
  /** null = pass (طاف) */
  value: number | null;
  forced: boolean;
}

export interface Contract {
  bidder: number;
  team: Team;
  value: number;
  /** true when this is a Malzoom (dealer forced) bid */
  forced: boolean;
  trump: Suit | null;
  /** did the bidder hold the "leadUnlockedIfBidderLacks" card when trump was chosen? */
  bidderHeldUnlockCard: boolean;
}

export interface TrickPlay {
  player: number;
  card: CardId;
  /** a void joker (illegal forced lead): no rank, cannot win */
  cancelled: boolean;
}

export interface Trick {
  leader: number;
  plays: TrickPlay[];
  /** the suit others must follow; null until set */
  ledSuit: Suit | null;
}

export interface CompletedTrick extends Trick {
  winner: number;
}

export interface HandResult {
  handNumber: number;
  dealer: number;
  bidder: number;
  team: Team;
  bid: number;
  forced: boolean;
  trump: Suit;
  tricks: [number, number];
  made: boolean;
  points: [number, number];
  totals: [number, number];
  endedEarly: boolean;
}

export interface GameState {
  rules: RulesConfig;
  mode: ModeId;
  numPlayers: number;
  seed: number;
  phase: Phase;
  handNumber: number;
  dealer: number;
  hands: CardId[][];
  currentPlayer: number;
  bids: BidEntry[];
  passed: boolean[];
  highBid: BidEntry | null;
  contract: Contract | null;
  trick: Trick;
  lastTrick: CompletedTrick | null;
  /** every completed trick of the current hand, in order (public information) */
  tricks: CompletedTrick[];
  tricksWon: [number, number];
  tricksPlayed: number;
  playedCards: CardId[];
  scores: [number, number];
  history: HandResult[];
  winner: Team | null;
  /** last hand's result, for the UI */
  lastResult: HandResult | null;
  /** number of all-pass redeals (only if forcing is disabled) */
  redeals: number;
}

export type Action =
  | { type: 'BID'; player: number; value: number }
  | { type: 'PASS'; player: number }
  | { type: 'CHOOSE_TRUMP'; player: number; suit: Suit }
  | { type: 'PLAY'; player: number; card: CardId }
  | { type: 'NEXT_HAND' };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Team of a seat, following rules.modes[mode].teamLayout. */
export function teamOf(state: Pick<GameState, 'rules' | 'mode'>, seat: number): Team {
  const m = state.rules.modes[state.mode];
  switch (m.teamLayout) {
    case 'alternate':
      return (seat % 2) as Team;
    case 'halves':
      return (seat < m.players / 2 ? 0 : 1) as Team;
  }
}

export function nextSeat(state: Pick<GameState, 'numPlayers'>, seat: number): number {
  return (seat + 1) % state.numPlayers;
}

export function totalTricks(state: GameState): number {
  return state.rules.modes[state.mode].handSize;
}

function emptyTrick(leader: number): Trick {
  return { leader, plays: [], ledSuit: null };
}

function deal(rules: RulesConfig, mode: ModeId, dealer: number, seed: number): [CardId[][], number] {
  const m = rules.modes[mode];
  const [deck, s] = shuffle(buildDeck(rules, mode), seed);
  const hands: CardId[][] = Array.from({ length: m.players }, () => []);
  let i = 0;
  // deal in chunks, starting with the player to the dealer's right, counter-clockwise
  while (i < m.players * m.handSize) {
    for (let k = 1; k <= m.players; k++) {
      const p = (dealer + k) % m.players;
      for (let c = 0; c < m.dealChunk && hands[p].length < m.handSize; c++) hands[p].push(deck[i++]);
    }
  }
  return [hands, s];
}

function startHand(state: GameState, dealer: number, handNumber: number): GameState {
  const [hands, seed] = deal(state.rules, state.mode, dealer, state.seed);
  return {
    ...state,
    seed,
    phase: 'bidding',
    handNumber,
    dealer,
    hands,
    currentPlayer: nextSeat(state, dealer),
    bids: [],
    passed: Array(state.numPlayers).fill(false),
    highBid: null,
    contract: null,
    trick: emptyTrick(nextSeat(state, dealer)),
    lastTrick: null,
    tricks: [],
    tricksWon: [0, 0],
    tricksPlayed: 0,
    playedCards: [],
  };
}

export function createGame(rules: RulesConfig, mode: ModeId, seed: number): GameState {
  const m = rules.modes[mode];
  let s = seed >>> 0;
  let dealer: number;
  if (rules.firstDealer === 'random') {
    [dealer, s] = randomInt(m.players, s);
  } else {
    dealer = rules.firstDealer % m.players;
  }
  const base: GameState = {
    rules,
    mode,
    numPlayers: m.players,
    seed: s,
    phase: 'bidding',
    handNumber: 0,
    dealer,
    hands: [],
    currentPlayer: 0,
    bids: [],
    passed: [],
    highBid: null,
    contract: null,
    trick: emptyTrick(0),
    lastTrick: null,
    tricks: [],
    tricksWon: [0, 0],
    tricksPlayed: 0,
    playedCards: [],
    scores: [0, 0],
    history: [],
    winner: null,
    lastResult: null,
    redeals: 0,
  };
  return startHand(base, dealer, 1);
}

// ---------------------------------------------------------------------------
// bidding
// ---------------------------------------------------------------------------

/** Is the current bidder the dealer being forced (everyone else passed, no bid yet)? */
export function isForcedBidder(state: GameState, player: number = state.currentPlayer): boolean {
  const b = state.rules.bidding;
  if (!b.forceDealerIfAllPass || state.phase !== 'bidding') return false;
  if (player !== state.dealer || state.highBid) return false;
  return state.passed.every((p, i) => i === player || p);
}

export interface BidOptions {
  canPass: boolean;
  values: number[];
  forced: boolean;
}

export function bidOptions(state: GameState, player: number = state.currentPlayer): BidOptions {
  if (state.phase !== 'bidding' || player !== state.currentPlayer) return { canPass: false, values: [], forced: false };
  const b = state.rules.bidding;
  if (isForcedBidder(state, player)) {
    const raises = b.forcedDealerMayRaise ? b.values.filter((v) => v > b.malzoomBid && v >= b.minVoluntaryBid) : [];
    return { canPass: false, values: [b.malzoomBid, ...raises], forced: true };
  }
  const min = Math.max(b.minVoluntaryBid, state.highBid ? (state.highBid.value as number) + b.minRaise : b.minVoluntaryBid);
  return { canPass: true, values: b.values.filter((v) => v >= min), forced: false };
}

function finishBidding(state: GameState): GameState {
  if (!state.highBid) {
    // everyone passed and forcing is disabled → redeal with the next dealer
    const dealer = state.rules.rotateDealer ? nextSeat(state, state.dealer) : state.dealer;
    return startHand({ ...state, redeals: state.redeals + 1 }, dealer, state.handNumber);
  }
  const hb = state.highBid;
  return {
    ...state,
    phase: 'choosingTrump',
    currentPlayer: hb.player,
    contract: {
      bidder: hb.player,
      team: teamOf(state, hb.player),
      value: hb.value as number,
      forced: hb.forced,
      trump: null,
      bidderHeldUnlockCard: false,
    },
  };
}

function applyBid(state: GameState, player: number, value: number | null): GameState {
  const opts = bidOptions(state, player);
  if (value === null && !opts.canPass) throw new Error('Pass not allowed');
  if (value !== null && !opts.values.includes(value)) throw new Error(`Bid ${value} not allowed`);
  const b = state.rules.bidding;
  const forced = opts.forced && value === b.malzoomBid;
  const entry: BidEntry = { player, value, forced };
  const passed = state.passed.slice();
  if (value === null) passed[player] = true;
  let s: GameState = {
    ...state,
    bids: [...state.bids, entry],
    passed,
    highBid: value !== null ? entry : state.highBid,
  };
  const maxBid = b.values[b.values.length - 1];
  if (value !== null && value === maxBid && b.endOnMaxBid) return finishBidding(s);

  if (b.singleRound) {
    if (s.bids.length >= s.numPlayers) return finishBidding(s);
    return { ...s, currentPlayer: nextSeat(s, player) };
  }
  // multi-round: continue until everyone but the high bidder has passed
  const active = passed.map((p, i) => (!p ? i : -1)).filter((i) => i >= 0);
  if (s.highBid && active.length === 1 && active[0] === s.highBid.player) return finishBidding(s);
  if (active.length === 0) return finishBidding(s);
  let n = nextSeat(s, player);
  while (passed[n]) n = nextSeat(s, n);
  s = { ...s, currentPlayer: n };
  return s;
}

// ---------------------------------------------------------------------------
// trump & joker-lead rules
// ---------------------------------------------------------------------------

/** Who leads the first trick of the hand, per rules.firstLead. */
export function firstLeader(state: GameState, bidder: number): number {
  switch (state.rules.firstLead) {
    case 'bidder':
      return bidder;
    case 'rightOfDealer':
      return nextSeat(state, state.dealer);
    case 'rightOfBidder':
    default:
      return nextSeat(state, bidder);
  }
}

function applyChooseTrump(state: GameState, player: number, suit: Suit): GameState {
  if (state.phase !== 'choosingTrump' || !state.contract) throw new Error('Not choosing trump');
  if (player !== state.contract.bidder) throw new Error('Only the bidder chooses trump');
  const lacks = state.rules.jokers.leadUnlockedIfBidderLacks;
  const held = lacks ? state.hands[player].includes(cardId(suit, RANK_NAME_TO_RANK[lacks])) : false;
  const leader = firstLeader(state, player);
  return {
    ...state,
    phase: 'playing',
    contract: { ...state.contract, trump: suit, bidderHeldUnlockCard: held },
    currentPlayer: leader,
    trick: emptyTrick(leader),
  };
}

/** May `player` legally LEAD this joker right now (per rules.jokers)? */
export function canLeadJoker(state: GameState, player: number, joker: CardId): boolean {
  const c = state.contract;
  if (!c || !c.trump) return false;
  const jr = state.rules.jokers;
  // a) / b) bid-based permission for the bidding team
  if (teamOf(state, player) === c.team) {
    const perm = jr.leadAllowedByBid[c.value];
    if (perm && (joker === BLACK_JOKER ? perm.black : perm.red)) return true;
  }
  // relaxed: bidder did not hold the key trump card
  if (jr.leadUnlockedIfBidderLacks && !c.bidderHeldUnlockCard) return true;
  // c) required trump cards have all been played
  const req = jr.leadUnlockedWhenTrumpsPlayed;
  if (req === null) return false;
  const deck = buildDeck(state.rules, state.mode);
  const required =
    req === 'all'
      ? deck.filter((id) => suitOf(id) === c.trump)
      : req.map((r) => cardId(c.trump as Suit, RANK_NAME_TO_RANK[r])).filter((id) => deck.includes(id));
  return required.every((id) => state.playedCards.includes(id));
}

/** True if the trick so far started with a void (cancelled) joker and no suit is set yet. */
function voidLeadPending(trick: Trick): boolean {
  return trick.ledSuit === null && trick.plays.length > 0 && trick.plays.some((p) => p.cancelled);
}

/** Legal cards for `player` right now (empty if it isn't their turn to play). */
export function legalPlays(state: GameState, player: number = state.currentPlayer): CardId[] {
  if (state.phase !== 'playing' || player !== state.currentPlayer || !state.contract) return [];
  const hand = state.hands[player];
  const trick = state.trick;
  const jr = state.rules.jokers;
  const trump = state.contract.trump as Suit;

  if (trick.plays.length === 0) {
    // leading
    const normal = hand.filter((c) => !isJoker(c));
    const legalJokers = hand.filter((c) => isJoker(c) && canLeadJoker(state, player, c));
    const legal = [...normal, ...legalJokers];
    // forced illegal joker lead: only jokers left and none legal
    return legal.length > 0 ? legal : hand.slice();
  }

  if (trick.ledSuit === null) return hand.slice(); // void lead / joker lead without suit: anything goes

  const led = trick.ledSuit;
  const follow = hand.filter((c) => suitOf(c) === led);
  if (follow.length === 0) return hand.slice();
  const jokers = hand.filter(isJoker);
  const jokersAllowed = jr.canPlayWhileHoldingLedSuit || led === trump;
  return jokersAllowed ? [...follow, ...jokers] : follow;
}

/** Index (into trick.plays) of the currently winning play, or -1. */
export function winningPlayIndex(rules: RulesConfig, trick: Trick, trump: Suit): number {
  let best = -1;
  let bestScore = -Infinity;
  trick.plays.forEach((p, i) => {
    if (p.cancelled) return;
    let score: number;
    if (isJoker(p.card) || suitOf(p.card) === trump) {
      score = 1000 + trumpPower(rules, p.card);
    } else if (suitOf(p.card) === trick.ledSuit) {
      score = suitPower(rules, rankOf(p.card)!);
    } else {
      score = -1; // off-suit discard
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export function trickWinner(rules: RulesConfig, trick: Trick, trump: Suit): number {
  const i = winningPlayIndex(rules, trick, trump);
  return i < 0 ? -1 : trick.plays[i].player;
}

// ---------------------------------------------------------------------------
// playing
// ---------------------------------------------------------------------------

function applyPlay(state: GameState, player: number, card: CardId): GameState {
  if (!legalPlays(state, player).includes(card)) throw new Error(`Illegal play ${card} by ${player}`);
  const c = state.contract as Contract;
  const trump = c.trump as Suit;
  const jr = state.rules.jokers;
  const trick = state.trick;
  let cancelled = false;
  let ledSuit = trick.ledSuit;

  if (trick.plays.length === 0) {
    if (isJoker(card)) {
      const legal = canLeadJoker(state, player, card);
      if (!legal && jr.illegalForcedLead === 'cancel') {
        cancelled = true;
      } else if (jr.ledJokerCountsAsTrump) {
        ledSuit = trump;
      }
    } else {
      ledSuit = suitOf(card);
    }
  } else if (ledSuit === null) {
    if (isJoker(card)) {
      if (voidLeadPending(trick)) cancelled = true; // a joker on a void lead is void too
    } else {
      ledSuit = suitOf(card);
    }
  }

  const hands = state.hands.slice();
  hands[player] = hands[player].filter((x) => x !== card);
  const newTrick: Trick = { ...trick, ledSuit, plays: [...trick.plays, { player, card, cancelled }] };
  let s: GameState = { ...state, hands, trick: newTrick, playedCards: [...state.playedCards, card] };

  if (newTrick.plays.length < s.numPlayers) {
    return { ...s, currentPlayer: nextSeat(s, player) };
  }
  // trick complete
  const winner = trickWinner(s.rules, newTrick, trump);
  const tricksWon: [number, number] = [...s.tricksWon];
  tricksWon[teamOf(state, winner)]++;
  const tricksPlayed = s.tricksPlayed + 1;
  s = {
    ...s,
    tricksWon,
    tricksPlayed,
    lastTrick: { ...newTrick, winner },
    tricks: [...(s.tricks ?? []), { ...newTrick, winner }],
    trick: emptyTrick(winner),
    currentPlayer: winner,
  };
  const total = totalTricks(s);
  const bidTricks = tricksWon[c.team];
  const made = bidTricks >= c.value;
  const failed = bidTricks + (total - tricksPlayed) < c.value;
  if (tricksPlayed >= total || (s.rules.endHandEarly && (made || failed))) {
    return scoreHand(s, made, tricksPlayed < total);
  }
  return s;
}

/** Points [team0, team1] for a hand result, from rules.scoring / rules.malzoomScoring. */
export function handPoints(rules: RulesConfig, contract: Pick<Contract, 'team' | 'value' | 'forced'>, made: boolean): [number, number] {
  const row = contract.forced ? rules.malzoomScoring : rules.scoring[contract.value];
  if (!row) throw new Error(`No scoring row for bid ${contract.value}`);
  const pts: [number, number] = [0, 0];
  if (made) pts[contract.team] += row.made;
  else pts[(1 - contract.team) as Team] += row.failed;
  return pts;
}

/** Winner per rules.gameEnd, or null. */
export function checkGameEnd(
  rules: RulesConfig,
  scores: [number, number],
  lastHand?: Pick<HandResult, 'handNumber' | 'made' | 'bid' | 'team'>,
): Team | null {
  const g = rules.gameEnd;
  if (g.bawanFirstHandInstantWin && lastHand && lastHand.handNumber === 1 && lastHand.made && lastHand.bid === rules.bidding.bawan) {
    return lastHand.team;
  }
  const [a, b] = scores;
  if (a >= g.targetScore || b >= g.targetScore) return a >= b ? 0 : 1;
  if (g.shutoutTarget !== null) {
    if (a >= g.shutoutTarget && b === 0) return 0;
    if (b >= g.shutoutTarget && a === 0) return 1;
  }
  return null;
}

function scoreHand(state: GameState, made: boolean, endedEarly: boolean): GameState {
  const c = state.contract as Contract;
  const points = handPoints(state.rules, c, made);
  const totals: [number, number] = [state.scores[0] + points[0], state.scores[1] + points[1]];
  const result: HandResult = {
    handNumber: state.handNumber,
    dealer: state.dealer,
    bidder: c.bidder,
    team: c.team,
    bid: c.value,
    forced: c.forced,
    trump: c.trump as Suit,
    tricks: [...state.tricksWon] as [number, number],
    made,
    points,
    totals,
    endedEarly,
  };
  const winner = checkGameEnd(state.rules, totals, result);
  return {
    ...state,
    scores: totals,
    history: [...state.history, result],
    lastResult: result,
    winner,
    phase: winner !== null ? 'gameOver' : 'handOver',
  };
}

// ---------------------------------------------------------------------------
// public reducer
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'BID':
    case 'PASS': {
      if (state.phase !== 'bidding') throw new Error('Not bidding');
      if (action.player !== state.currentPlayer) throw new Error('Not your turn');
      return applyBid(state, action.player, action.type === 'BID' ? action.value : null);
    }
    case 'CHOOSE_TRUMP':
      return applyChooseTrump(state, action.player, action.suit);
    case 'PLAY': {
      if (state.phase !== 'playing') throw new Error('Not playing');
      if (action.player !== state.currentPlayer) throw new Error('Not your turn');
      return applyPlay(state, action.player, action.card);
    }
    case 'NEXT_HAND': {
      if (state.phase !== 'handOver') throw new Error('Hand not over');
      const dealer = state.rules.rotateDealer ? nextSeat(state, state.dealer) : state.dealer;
      return startHand(state, dealer, state.handNumber + 1);
    }
  }
}

/** Every legal action for whoever must act now (for bots, servers and tests). */
export function legalActions(state: GameState): Action[] {
  const p = state.currentPlayer;
  switch (state.phase) {
    case 'bidding': {
      const o = bidOptions(state, p);
      const acts: Action[] = o.values.map((value) => ({ type: 'BID', player: p, value }));
      if (o.canPass) acts.unshift({ type: 'PASS', player: p });
      return acts;
    }
    case 'choosingTrump':
      return (['S', 'H', 'D', 'C'] as Suit[]).map((suit) => ({ type: 'CHOOSE_TRUMP', player: p, suit }));
    case 'playing':
      return legalPlays(state, p).map((card) => ({ type: 'PLAY', player: p, card }));
    case 'handOver':
      return [{ type: 'NEXT_HAND' }];
    default:
      return [];
  }
}

/**
 * What one seat is allowed to see (for future online play): other hands are
 * replaced by their card counts, and the RNG seed is hidden.
 */
export function playerView(state: GameState, seat: number) {
  return {
    ...state,
    seed: 0,
    hands: state.hands.map((h, i) => (i === seat ? h : h.map(() => '??'))),
  };
}
