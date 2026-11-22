import type { JokerId, ModeId, Rank, RulesConfig, Suit } from './rules.config';

export type CardId = string;
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const ALL_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const RED_JOKER: JokerId = 'XR';
export const BLACK_JOKER: JokerId = 'XB';

export interface ParsedCard {
  id: CardId;
  joker: boolean;
  /** null for jokers */
  suit: Suit | null;
  /** null for jokers */
  rank: Rank | null;
  jokerColor: 'red' | 'black' | null;
}

export function cardId(suit: Suit, rank: Rank): CardId {
  return `${suit}${rank}`;
}

export function isJoker(id: CardId): boolean {
  return id === RED_JOKER || id === BLACK_JOKER;
}

export function parseCard(id: CardId): ParsedCard {
  if (id === RED_JOKER) return { id, joker: true, suit: null, rank: null, jokerColor: 'red' };
  if (id === BLACK_JOKER) return { id, joker: true, suit: null, rank: null, jokerColor: 'black' };
  const suit = id[0] as Suit;
  const rank = Number(id.slice(1)) as Rank;
  if (!SUITS.includes(suit) || !ALL_RANKS.includes(rank)) throw new Error(`Bad card id: ${id}`);
  return { id, joker: false, suit, rank, jokerColor: null };
}

export function suitOf(id: CardId): Suit | null {
  return isJoker(id) ? null : (id[0] as Suit);
}

export function rankOf(id: CardId): Rank | null {
  return isJoker(id) ? null : (Number(id.slice(1)) as Rank);
}

/** Build the (unshuffled) deck for a mode, entirely from the rules config. */
/** Accepts a card id as 'H6' (suit + rank) or '6H' (rank + suit) and returns the engine form 'H6'. */
export function normalizeCardId(x: string): CardId {
  const m = /^(\d+)([SHDC])$/.exec(x);
  return m ? `${m[2]}${m[1]}` : x;
}

/** Specific cards removed from a mode's deck (modes[mode].removeCards, plus bo4Removed6s for Bo 4). */
export function removedCards(rules: RulesConfig, mode: ModeId): CardId[] {
  const extra = mode === 'bo4' ? rules.bo4Removed6s ?? [] : [];
  return [...rules.modes[mode].removeCards, ...extra].map(normalizeCardId);
}

export function buildDeck(rules: RulesConfig, mode: ModeId): CardId[] {
  const m = rules.modes[mode];
  const removed = new Set(removedCards(rules, mode));
  const deck: CardId[] = [];
  for (const s of SUITS) {
    for (const r of ALL_RANKS) {
      if (m.removeRanks.includes(r)) continue;
      const id = cardId(s, r);
      if (removed.has(id)) continue;
      deck.push(id);
    }
  }
  deck.push(...m.jokers);
  return deck;
}

/** Strength within a plain suit (higher = stronger), from rules.suitRankOrder. */
export function suitPower(rules: RulesConfig, rank: Rank): number {
  const idx = rules.suitRankOrder.indexOf(rank);
  return idx < 0 ? -1 : rules.suitRankOrder.length - idx;
}

/** Strength as trump (jokers included), from rules.trumpPowerOrder. -1 if not in the order. */
export function trumpPower(rules: RulesConfig, id: CardId): number {
  const key: Rank | JokerId = isJoker(id) ? (id as JokerId) : (rankOf(id) as Rank);
  const idx = rules.trumpPowerOrder.indexOf(key);
  return idx < 0 ? -1 : rules.trumpPowerOrder.length - idx;
}

export const RANK_NAME_TO_RANK: Record<'A' | 'K' | 'Q' | 'J', Rank> = { A: 14, K: 13, Q: 12, J: 11 };

export function rankLabel(rank: Rank): string {
  return rank === 14 ? 'A' : rank === 13 ? 'K' : rank === 12 ? 'Q' : rank === 11 ? 'J' : String(rank);
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME_AR: Record<Suit, string> = { S: 'سبيت', H: 'هاص', D: 'ديمن', C: 'شريحة' };
export function isRedSuit(s: Suit): boolean {
  return s === 'H' || s === 'D';
}
