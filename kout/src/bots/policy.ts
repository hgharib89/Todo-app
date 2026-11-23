/**
 * Playout policy for the simulations: every hand is known (one sampled deal), every player plays a
 * sensible card quickly. It is used to finish a hand after a candidate move when the hand is too big
 * for the exact solver, and for the bidding simulations.
 *
 * Partnership:  never overtake a partner who already has the trick; play low under them.
 * Jokers:       used to win a trick that matters when nothing cheaper wins it for sure — not hoarded,
 *               never thrown on a trick that is already won by partner or cannot be won.
 * Bidders:      draw the opponents' trumps with sure winners, cash sure side winners, lead to partner.
 * Defenders:    lead to partner's sure winners, attack trumps when they hold the top ones, otherwise
 *               lead short suits (to ruff later) or through the bidding team's weak suits.
 */
import {
  type CardId,
  type GameState,
  type Suit,
  type Trick,
  applyAction,
  canLeadJoker,
  isJoker,
  legalPlays,
  nextSeat,
  rankOf,
  suitOf,
  suitPower,
  teamOf,
  trumpPower,
  winningPlayIndex,
} from '../engine';

const trumpLike = (c: CardId, trump: Suit) => isJoker(c) || suitOf(c) === trump;

/** may `p` NOT lead this joker now (so it can only be played on other players' tricks)? */
export function jokerStuck(s: GameState, p: number, joker: CardId): boolean {
  return !!s.contract?.trump && !canLeadJoker(s, p, joker);
}

/**
 * cheaper first; jokers and high trumps are the most valuable — except a joker its owner may not lead:
 * it can only ever be played on someone else's trick, so keeping it risks a cancelled last-card lead.
 * Such a joker is worth spending before a trump that can be led later.
 */
export function cost(s: GameState, c: CardId, trump: Suit, owner: number = s.currentPlayer): number {
  if (isJoker(c)) return (jokerStuck(s, owner, c) ? 100 : 200) + trumpPower(s.rules, c);
  if (suitOf(c) === trump) return 100 + trumpPower(s.rules, c);
  return suitPower(s.rules, rankOf(c)!);
}

function withPlay(trick: Trick, player: number, card: CardId): Trick {
  const ledSuit = trick.ledSuit ?? (isJoker(card) ? null : suitOf(card));
  return { ...trick, ledSuit, plays: [...trick.plays, { player, card, cancelled: false }] };
}

function laterSeats(s: GameState, me: number): number[] {
  const out: number[] = [];
  let p = me;
  for (let i = s.trick.plays.length + 1; i < s.numPlayers; i++) {
    p = nextSeat(s, p);
    out.push(p);
  }
  return out;
}

/** Could any opponent still to play beat `card` (with the trick as it would be)? */
function oppCanBeat(s: GameState, me: number, trick: Trick, later: number[]): boolean {
  const trump = s.contract!.trump as Suit;
  const myTeam = teamOf(s, me);
  for (const p of later) {
    if (teamOf(s, p) === myTeam) continue;
    const hand = s.hands[p];
    const follow = trick.ledSuit ? hand.filter((c) => suitOf(c) === trick.ledSuit) : [];
    const jokersOk = s.rules.jokers.canPlayWhileHoldingLedSuit || trick.ledSuit === trump;
    const options = follow.length ? [...follow, ...(jokersOk ? hand.filter(isJoker) : [])] : hand;
    for (const c of options) {
      const t = withPlay(trick, p, c);
      const w = winningPlayIndex(s.rules, t, trump);
      if (w >= 0 && t.plays[w].player === p) return true;
    }
  }
  return false;
}

function wins(s: GameState, me: number, card: CardId): Trick | null {
  const trump = s.contract!.trump as Suit;
  const t = withPlay(s.trick, me, card);
  const w = winningPlayIndex(s.rules, t, trump);
  return w >= 0 && t.plays[w].player === me ? t : null;
}

/** Does my team still need tricks (attack), or can my team still break the bid (defence)? */
function trickMatters(s: GameState, me: number): boolean {
  const c = s.contract!;
  const total = s.rules.modes[s.mode].handSize;
  const left = total - s.tricksPlayed;
  const bid = s.tricksWon[c.team];
  if (c.bawn) return true;
  if (bid >= c.value) return false; // already made
  if (bid + left < c.value) return false; // already broken
  void me;
  return true;
}

export function playoutCard(s: GameState): CardId {
  const me = s.currentPlayer;
  const legal = legalPlays(s, me);
  if (legal.length === 1) return legal[0];
  const c = s.contract!;
  const trump = c.trump as Suit;
  const myTeam = teamOf(s, me);
  const byCost = [...legal].sort((a, b) => cost(s, a, trump) - cost(s, b, trump));
  const cheapest = byCost.find((x) => !isJoker(x)) ?? byCost[0];
  const trick = s.trick;

  // ---------------- following ----------------
  if (trick.plays.length > 0) {
    const later = laterSeats(s, me);
    const wi = winningPlayIndex(s.rules, trick, trump);
    const partnerHasIt = wi >= 0 && teamOf(s, trick.plays[wi].player) === myTeam && !oppCanBeat(s, me, trick, later);
    if (partnerHasIt) return discard(s, me, byCost, trump); // never overtake a partner who has it
    const winners = byCost.filter((x) => wins(s, me, x));
    const safe = winners.filter((x) => !oppCanBeat(s, me, wins(s, me, x)!, later));
    if (safe.length) {
      const plain = safe.find((x) => !isJoker(x));
      if (plain) return plain;
      // only a joker wins for sure: use it if this trick matters (don't hoard it to the last card)
      if (trickMatters(s, me)) return safe[0];
    }
    // a winner that might still be beaten: play the cheapest non-joker one when I'm last but one
    const plainWinner = winners.find((x) => !isJoker(x) && cost(s, x, trump) < 100);
    if (plainWinner && later.length <= 1) return plainWinner;
    return discard(s, me, byCost, trump);
  }

  // ---------------- leading ----------------
  const opps = s.hands.flatMap((h, p) => (teamOf(s, p) !== myTeam ? h : []));
  const partners = s.hands.map((h, p) => (p !== me && teamOf(s, p) === myTeam ? h : null));
  const others = s.hands.flatMap((h, p) => (p !== me ? h : []));
  const oppTrumpMax = Math.max(-1, ...opps.filter((x) => trumpLike(x, trump)).map((x) => trumpPower(s.rules, x)));
  const isBossTrump = (x: CardId) => trumpLike(x, trump) && trumpPower(s.rules, x) > Math.max(-1, ...others.filter((o) => trumpLike(o, trump)).map((o) => trumpPower(s.rules, o)));
  const sideBoss = (x: CardId, holderPool: CardId[]) =>
    !trumpLike(x, trump) && !holderPool.some((o) => suitOf(o) === suitOf(x) && suitPower(s.rules, rankOf(o)!) > suitPower(s.rules, rankOf(x)!));
  const ruffable = (suit: Suit | null) => s.hands.some((h, p) => teamOf(s, p) !== myTeam && !h.some((o) => suitOf(o) === suit) && h.some((o) => trumpLike(o, trump)));

  const attacking = myTeam === c.team;
  // draw trumps with sure winners while the opponents still hold some (bidders, or defenders holding the top)
  if (oppTrumpMax >= 0) {
    const boss = legal.filter(isBossTrump).sort((a, b) => Number(isJoker(a)) - Number(isJoker(b)) || cost(s, a, trump) - cost(s, b, trump));
    if (boss.length && (attacking || boss.length >= 2)) return boss[0];
  }
  // cash sure side winners that can't be ruffed
  const cash = legal.filter((x) => sideBoss(x, others) && !ruffable(suitOf(x)));
  if (cash.length) return cash.sort((a, b) => cost(s, b, trump) - cost(s, a, trump))[0];
  // lead to partner: a suit where partner holds the top card (and can't be ruffed)
  for (const ph of partners) {
    if (!ph) continue;
    const rest = s.hands.flatMap((h) => (h === ph ? [] : h));
    const toPartner = legal.filter((x) => !trumpLike(x, trump) && ph.some((o) => suitOf(o) === suitOf(x) && sideBoss(o, rest)) && !ruffable(suitOf(x)));
    if (toPartner.length) return toPartner.sort((a, b) => cost(s, a, trump) - cost(s, b, trump))[0];
  }
  const side = legal.filter((x) => !trumpLike(x, trump));
  if (side.length) {
    const len = (st: Suit | null) => s.hands[me].filter((h) => suitOf(h) === st).length;
    // attackers: long suits; defenders: short suits (to ruff later) unless they have no trumps
    const iHaveTrump = s.hands[me].some((h) => trumpLike(h, trump));
    const sorted = side.sort((a, b) =>
      attacking || !iHaveTrump ? len(suitOf(b)) - len(suitOf(a)) || cost(s, a, trump) - cost(s, b, trump) : len(suitOf(a)) - len(suitOf(b)) || cost(s, a, trump) - cost(s, b, trump),
    );
    return sorted[0];
  }
  return byCost.find((x) => !isJoker(x)) ?? cheapest;
}

/** Throw away the least useful card (never a joker if anything else will do): lowest card of the weakest suit. */
function discard(s: GameState, me: number, byCost: CardId[], trump: Suit): CardId {
  const nonJ = byCost.filter((x) => !isJoker(x));
  if (!nonJ.length) return byCost[0];
  const plain = nonJ.filter((x) => suitOf(x) !== trump);
  const pool = plain.length ? plain : nonJ;
  const len = (st: Suit | null) => s.hands[me].filter((h) => suitOf(h) === st).length;
  // lowest card; among equals prefer the shorter suit (keeps length where it may win later)
  return [...pool].sort((a, b) => cost(s, a, trump) - cost(s, b, trump) || len(suitOf(a)) - len(suitOf(b)))[0];
}

/** Play the hand out with the policy (bawn questions answered "no"). */
export function playout(s: GameState): GameState {
  let guard = 0;
  while (guard++ < 200) {
    if (s.phase === 'bawnAsk') {
      s = applyAction(s, { type: 'BAWN', player: s.currentPlayer, accept: false });
      continue;
    }
    if (s.phase !== 'playing' || s.hands[s.currentPlayer].length === 0) break;
    s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card: playoutCard(s) });
  }
  return s;
}
