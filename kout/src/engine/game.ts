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
/** 'review' = all cards played; the table may still call a catch (صيد) before the hand is scored */
/** 'bawnAsk' = bid 7 reached 6 tricks: the bidder answers "تبي باون؟" */
export type Phase = 'bidding' | 'choosingTrump' | 'playing' | 'bawnAsk' | 'review' | 'handOver' | 'gameOver';

/** The (public) answer to "عندك الجوكر الثاني؟" */
export interface JokerAskAnswer {
  answer: boolean;
  /** the partner who has the other joker (null when the answer is no) */
  holder: number | null;
}

export interface BidEntry {
  player: number;
  /** null = pass (طاف) */
  value: number | null;
  forced: boolean;
  /** set when this bid was forced by asking partner about the other joker */
  jokerAsk?: JokerAskAnswer;
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
  /** Bawn (باون): null = not asked, true = declared, false = declined */
  bawn?: boolean | null;
  /** the opponents' tricks when Bawn was declared (they must not win another) */
  bawnOppTricks?: number;
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

/** A renege (قطع غلط): not following the led suit while holding a card of it (jokers excluded). */
export interface Renege {
  player: number;
  team: Team;
  /** index of the trick in this hand (0 = first) */
  trick: number;
  /** the off-suit card that was played */
  card: CardId;
  /** the suit that should have been followed */
  ledSuit: Suit;
}

/** A catch (صيد) call and how it went. */
export interface CatchResult {
  catcher: number;
  accused: number;
  /** index of the trick in this hand (0 = first) */
  trick: number;
  success: boolean;
  /** the suit that was not followed (successful catches) */
  suit: Suit | null;
}

/** The draw for the first dealer: one face-up card per player per round; ties for lowest draw again. */
export interface DealerDraw {
  rounds: { player: number; card: CardId }[][];
  dealer: number;
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
  /** set when the hand was broken by a successful catch */
  caught: CatchResult | null;
  /** Bawn declared this hand (true), declined (false) or not asked (null) */
  bawn: boolean | null;
  /** the bidding team made Larens and so won the whole game (قيم) */
  larensWin: boolean;
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
  /** how the first dealer was chosen this game (public: shown as an animation at the start) */
  dealerDraw?: DealerDraw | null;
  /**
   * Every renege this hand, recorded silently. HIDDEN information: not part of playerView,
   * and bots never read it. Catches are judged only from the public cards (renegeEvidence).
   */
  reneges: Renege[];
  /** the latest catch call this hand (for the UI) */
  lastCatch: CatchResult | null;
}

export type Action =
  | { type: 'BID'; player: number; value: number }
  | { type: 'PASS'; player: number }
  | { type: 'CHOOSE_TRUMP'; player: number; suit: Suit }
  | { type: 'PLAY'; player: number; card: CardId }
  | { type: 'NEXT_HAND' }
  /** صيد: `player` accuses `accused` of reneging in trick number `trick` (0 = first) of this hand */
  | { type: 'CATCH'; player: number; accused: number; trick: number }
  /** finish the end-of-hand review and score the hand */
  | { type: 'END_REVIEW' }
  /** the bidder's answer to "تبي باون؟" */
  | { type: 'BAWN'; player: number; accept: boolean }
  /** "عندك الجوكر الثاني؟": ask partner, then bid jokerAskYesBid / jokerAskNoBid by the answer */
  | { type: 'JOKER_ASK'; player: number };

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
    reneges: [],
    lastCatch: null,
  };
}

/**
 * Draw for the first dealer: every player draws one face-up card from the shuffled deck without jokers;
 * the lowest rank deals (2 lowest, Ace highest). If several tie for lowest, only they draw again.
 */
export function drawForDealer(rules: RulesConfig, mode: ModeId, seed: number): [DealerDraw, number] {
  const n = rules.modes[mode].players;
  const plain = buildDeck(rules, mode).filter((c) => !isJoker(c));
  let [deck, s] = shuffle(plain, seed);
  const rounds: { player: number; card: CardId }[][] = [];
  let drawing = Array.from({ length: n }, (_, i) => i);
  for (let guard = 0; guard < 50; guard++) {
    if (deck.length < drawing.length) [deck, s] = shuffle(plain, s); // ran out: shuffle a fresh deck
    const round = drawing.map((player) => ({ player, card: deck.shift()! }));
    rounds.push(round);
    const low = Math.min(...round.map((d) => rankOf(d.card)!));
    drawing = round.filter((d) => rankOf(d.card) === low).map((d) => d.player);
    if (drawing.length === 1) return [{ rounds, dealer: drawing[0] }, s];
  }
  return [{ rounds, dealer: drawing[0] }, s];
}

/** The next hand's dealer, per rules.dealerRotation. */
export function nextDealer(state: GameState): number {
  if (state.rules.dealerRotation === 'alwaysRotate' || !state.lastResult) return nextSeat(state, state.dealer);
  const dealerTeam = teamOf(state, state.dealer);
  const dealerTeamScored = state.lastResult.points[dealerTeam] > 0;
  // the dealer's team lost (0 points): same dealer again; it scored: pass to the right (the losing team)
  return dealerTeamScored ? nextSeat(state, state.dealer) : state.dealer;
}

export function createGame(rules: RulesConfig, mode: ModeId, seed: number): GameState {
  const m = rules.modes[mode];
  let s = seed >>> 0;
  let dealer: number;
  let dealerDraw: DealerDraw | null = null;
  if (rules.firstDealer === 'lowestCardDraw') {
    [dealerDraw, s] = drawForDealer(rules, mode, s);
    dealer = dealerDraw.dealer;
  } else if (rules.firstDealer === 'random') {
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
    reneges: [],
    lastCatch: null,
    dealerDraw,
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
    return startHand({ ...state, redeals: state.redeals + 1 }, nextSeat(state, state.dealer), state.handNumber);
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
      bawn: null,
    },
  };
}

function applyBid(state: GameState, player: number, value: number | null, jokerAsk?: JokerAskAnswer): GameState {
  const opts = bidOptions(state, player);
  if (value === null && !opts.canPass) throw new Error('Pass not allowed');
  if (value !== null && !opts.values.includes(value)) throw new Error(`Bid ${value} not allowed`);
  const b = state.rules.bidding;
  const forced = opts.forced && value === b.malzoomBid && !jokerAsk;
  const entry: BidEntry = jokerAsk ? { player, value, forced, jokerAsk } : { player, value, forced };
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
// asking partner about the other joker (سؤال الجوكر)
// ---------------------------------------------------------------------------

/**
 * May `player` ask "عندك الجوكر الثاني؟" now? Only on their bidding turn, holding exactly one joker,
 * and only while both forced answers (jokerAskYesBid and jokerAskNoBid) are still legal bids.
 */
export function canAskJoker(state: GameState, player: number = state.currentPlayer): boolean {
  const ja = state.rules.jokerAsk;
  if (!ja.allowJokerAsk || state.phase !== 'bidding' || player !== state.currentPlayer) return false;
  const jokers = state.hands[player].filter(isJoker);
  if (jokers.length !== 1) return false;
  const deck = state.rules.modes[state.mode].jokers;
  if (!deck.some((j) => j !== jokers[0])) return false; // no second joker in this deck
  const opts = bidOptions(state, player);
  return opts.values.includes(ja.jokerAskYesBid) && opts.values.includes(ja.jokerAskNoBid);
}

/** The truthful answer: does a partner of `player` hold the other joker? */
export function jokerAskAnswer(state: GameState, player: number): JokerAskAnswer {
  const mine = state.hands[player].find(isJoker);
  const other = state.rules.modes[state.mode].jokers.find((j) => j !== mine);
  const team = teamOf(state, player);
  for (let p = 0; p < state.numPlayers; p++) {
    if (p !== player && teamOf(state, p) === team && other && state.hands[p].includes(other)) return { answer: true, holder: p };
  }
  return { answer: false, holder: null };
}

function applyJokerAsk(state: GameState, player: number): GameState {
  if (!canAskJoker(state, player)) throw new Error('Joker ask not allowed');
  const ans = jokerAskAnswer(state, player);
  const ja = state.rules.jokerAsk;
  return applyBid(state, player, ans.answer ? ja.jokerAskYesBid : ja.jokerAskNoBid, ans);
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
  if (!playableCards(state, player).includes(card)) throw new Error(`Illegal play ${card} by ${player}`);
  const c = state.contract as Contract;
  const trump = c.trump as Suit;
  const jr = state.rules.jokers;
  const trick = state.trick;
  // a renege: not following the led suit while holding it (jokers can always be played)
  const renege: Renege | null =
    trick.ledSuit && !isJoker(card) && suitOf(card) !== trick.ledSuit && state.hands[player].some((x) => suitOf(x) === trick.ledSuit)
      ? { player, team: teamOf(state, player), trick: state.tricksPlayed, card, ledSuit: trick.ledSuit }
      : null;
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
  let s: GameState = {
    ...state,
    hands,
    trick: newTrick,
    playedCards: [...state.playedCards, card],
    reneges: renege ? [...(state.reneges ?? []), renege] : state.reneges ?? [],
  };

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
  if (tricksPlayed >= total) {
    // every card is on the table: with reneging possible, the table reviews before scoring
    return s.rules.renege.allowRenege ? { ...s, phase: 'review' } : scoreHand(s, false);
  }
  // Bawn (every trick): the bid-7 team just reached 6 tricks AND the opponents have none → ask the bidder.
  // Once the opponents have taken a trick, Bawn is impossible and is never asked.
  const bw = s.rules.bawn;
  const oppTricks = tricksWon[1 - c.team];
  if (bw.bawnOnBid !== null && c.value === bw.bawnOnBid && !c.forced && (c.bawn ?? null) === null && tricksWon[c.team] >= bw.bawnAskAtTricks && oppTricks === 0) {
    return { ...s, phase: 'bawnAsk', currentPlayer: c.bidder };
  }
  if (!s.rules.playToLastCard && handDecided(s)) return scoreHand(s, true);
  return s;
}

/** Is the result of the hand already certain (for playToLastCard: false)? */
function handDecided(state: GameState): boolean {
  const c = state.contract as Contract;
  const total = totalTricks(state);
  const left = total - state.tricksPlayed;
  const bid = state.tricksWon[c.team];
  const opp = state.tricksWon[1 - c.team];
  if (c.bawn) return opp > (c.bawnOppTricks ?? 0) || left === 0;
  return bid >= c.value || bid + left < c.value;
}

function applyBawn(state: GameState, player: number, accept: boolean): GameState {
  if (state.phase !== 'bawnAsk') throw new Error('No Bawn question now');
  const c = state.contract as Contract;
  if (player !== c.bidder) throw new Error('Only the bidder answers');
  const contract: Contract = { ...c, bawn: accept, bawnOppTricks: state.tricksWon[1 - c.team] };
  return { ...state, contract, phase: 'playing', currentPlayer: state.trick.leader };
}

export interface HandOutcome {
  made: boolean;
  points: [number, number];
  larensWin: boolean;
}

/** How the hand scores as it stands (no catch): normal bid, Bawn or Larens. */
export function handOutcome(state: GameState): HandOutcome {
  const c = state.contract as Contract;
  const r = state.rules;
  const bid = state.tricksWon[c.team];
  const opp = state.tricksWon[1 - c.team];
  const other = (1 - c.team) as Team;
  const points: [number, number] = [0, 0];
  if (c.bawn) {
    const made = opp === (c.bawnOppTricks ?? 0);
    points[made ? c.team : other] = made ? r.bawn.bawnWinPoints : r.bawn.bawnFailPoints;
    return { made, points, larensWin: false };
  }
  const made = bid >= c.value;
  const larensWin = made && isLarens(r, c) && r.larens.larensWinsGame;
  return { made, points: handPoints(r, c, made), larensWin };
}

function isLarens(rules: RulesConfig, c: Pick<Contract, 'value' | 'forced'>): boolean {
  return !c.forced && c.value === rules.bidding.larens;
}

// ---------------------------------------------------------------------------
// reneging & catching (القطع والصيد)
// ---------------------------------------------------------------------------

/**
 * Cards `player` may physically put on the table now. With rules.renege.allowRenege this is
 * every legal card plus any non-joker card that breaks follow-suit (a renege); joker rules
 * still apply. Without it, exactly legalPlays.
 */
export function playableCards(state: GameState, player: number = state.currentPlayer): CardId[] {
  const legal = legalPlays(state, player);
  if (!state.rules.renege.allowRenege || legal.length === 0) return legal;
  const extra = state.hands[player].filter((c) => !isJoker(c) && !legal.includes(c));
  return [...legal, ...extra];
}

/** Index of the play that fixed a trick's led suit, or -1 (plays before it can't be reneges). */
function suitFixedAt(rules: RulesConfig, trick: Trick): number {
  for (let i = 0; i < trick.plays.length; i++) {
    const p = trick.plays[i];
    if (!isJoker(p.card)) return i;
    if (i === 0 && !p.cancelled && rules.jokers.ledJokerCountsAsTrump) return 0; // a led joker made trump the suit
  }
  return -1;
}

export interface RenegeEvidence {
  accused: number;
  /** trick index in this hand (0 = first) */
  trick: number;
  /** the suit they showed out of */
  suit: Suit;
  /** the off-suit card they played in that trick */
  card: CardId;
  /** the later card of that suit that proves they still held it */
  proof: CardId;
  proofTrick: number;
}

/**
 * Visible proof of reneges, from the cards on the table only (no hidden information):
 * a player didn't follow suit S in one trick, then played a card of S later in the hand.
 * Once a hand is played to the last card, every renege has such proof.
 */
export function renegeEvidence(state: GameState): RenegeEvidence[] {
  const all: Trick[] = [...(state.tricks ?? []), ...(state.trick.plays.length ? [state.trick] : [])];
  const out: RenegeEvidence[] = [];
  all.forEach((t, i) => {
    if (!t.ledSuit) return;
    const from = suitFixedAt(state.rules, t);
    if (from < 0) return;
    for (let j = from + 1; j < t.plays.length; j++) {
      const p = t.plays[j];
      if (isJoker(p.card) || suitOf(p.card) === t.ledSuit) continue;
      for (let k = i + 1; k < all.length; k++) {
        const later = all[k].plays.find((x) => x.player === p.player && suitOf(x.card) === t.ledSuit);
        if (later) {
          out.push({ accused: p.player, trick: i, suit: t.ledSuit, card: p.card, proof: later.card, proofTrick: k });
          break;
        }
      }
    }
  });
  return out;
}

/** Catches `player` could correctly call right now (evidence against an opponent). */
export function catchOptions(state: GameState, player: number): RenegeEvidence[] {
  if (state.phase !== 'playing' && state.phase !== 'review' && state.phase !== 'bawnAsk') return [];
  const team = teamOf(state, player);
  return renegeEvidence(state).filter((e) => teamOf(state, e.accused) !== team);
}

/** Break the hand: `offender`'s team gets 0, the other team gets bid × renegePenaltyMultiplier. */
function breakHand(state: GameState, offenderTeam: Team, caught: CatchResult): GameState {
  const c = state.contract as Contract;
  const other = (1 - offenderTeam) as Team;
  const points: [number, number] = [0, 0];
  points[other] = c.value * state.rules.renege.renegePenaltyMultiplier;
  const outcome: HandOutcome = { made: other === c.team, points, larensWin: false };
  return finishHand(state, outcome, state.tricksPlayed < totalTricks(state), caught);
}

function applyCatch(state: GameState, player: number, accused: number, trick: number): GameState {
  if (state.phase !== 'playing' && state.phase !== 'review' && state.phase !== 'bawnAsk') throw new Error('No catch now');
  if (!state.rules.renege.allowRenege) throw new Error('Reneging is disabled');
  if (teamOf(state, player) === teamOf(state, accused)) throw new Error('Catch an opponent');
  const ev = renegeEvidence(state).find((e) => e.accused === accused && e.trick === trick);
  if (ev) {
    const caught: CatchResult = { catcher: player, accused, trick, success: true, suit: ev.suit };
    return breakHand({ ...state, lastCatch: caught }, teamOf(state, accused), caught);
  }
  const wrong: CatchResult = { catcher: player, accused, trick, success: false, suit: null };
  if (state.rules.renege.wrongCatchPenalty === 'brokenHand') {
    return breakHand({ ...state, lastCatch: wrong }, teamOf(state, player), wrong);
  }
  return { ...state, lastCatch: wrong };
}

/** The points a hand would score as it stands (bid made or not), ignoring catches. */
export function provisionalPoints(state: GameState): [number, number] {
  return handOutcome(state).points;
}

/**
 * Points [team0, team1] for a hand result, from rules.scoring / rules.malzoomScoring, and
 * rules.larens for bid 9 (making Larens scores 0 when it wins the whole game instead).
 */
export function handPoints(rules: RulesConfig, contract: Pick<Contract, 'team' | 'value' | 'forced'>, made: boolean): [number, number] {
  if (isLarens(rules, contract)) {
    const pts: [number, number] = [0, 0];
    if (made) pts[contract.team] = rules.larens.larensWinsGame ? 0 : rules.larens.larensMadePoints;
    else pts[(1 - contract.team) as Team] = rules.larens.larensFailPoints;
    return pts;
  }
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
  lastHand?: Pick<HandResult, 'team' | 'larensWin'>,
): Team | null {
  const g = rules.gameEnd;
  if (lastHand?.larensWin) return lastHand.team; // Larens wins the whole game (قيم)
  const [a, b] = scores;
  if (a >= g.targetScore || b >= g.targetScore) return a >= b ? 0 : 1;
  if (g.shutoutTarget !== null) {
    if (a >= g.shutoutTarget && b === 0) return 0;
    if (b >= g.shutoutTarget && a === 0) return 1;
  }
  return null;
}

function scoreHand(state: GameState, endedEarly: boolean): GameState {
  return finishHand(state, handOutcome(state), endedEarly, null);
}

function finishHand(state: GameState, outcome: HandOutcome, endedEarly: boolean, caught: CatchResult | null): GameState {
  const c = state.contract as Contract;
  const { made, points } = outcome;
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
    caught,
    bawn: c.bawn ?? null,
    larensWin: outcome.larensWin,
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
    case 'CATCH':
      return applyCatch(state, action.player, action.accused, action.trick);
    case 'END_REVIEW': {
      if (state.phase !== 'review') throw new Error('Not reviewing');
      return scoreHand(state, false);
    }
    case 'BAWN':
      return applyBawn(state, action.player, action.accept);
    case 'JOKER_ASK': {
      if (state.phase !== 'bidding') throw new Error('Not bidding');
      if (action.player !== state.currentPlayer) throw new Error('Not your turn');
      return applyJokerAsk(state, action.player);
    }
    case 'NEXT_HAND': {
      if (state.phase !== 'handOver') throw new Error('Hand not over');
      return startHand(state, nextDealer(state), state.handNumber + 1);
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
      if (canAskJoker(state, p)) acts.push({ type: 'JOKER_ASK', player: p });
      return acts;
    }
    case 'choosingTrump':
      return (['S', 'H', 'D', 'C'] as Suit[]).map((suit) => ({ type: 'CHOOSE_TRUMP', player: p, suit }));
    case 'playing':
      return playableCards(state, p).map((card) => ({ type: 'PLAY', player: p, card }));
    case 'review':
      return [{ type: 'END_REVIEW' }];
    case 'bawnAsk':
      return [
        { type: 'BAWN', player: p, accept: false },
        { type: 'BAWN', player: p, accept: true },
      ];
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
    reneges: [],
  };
}
