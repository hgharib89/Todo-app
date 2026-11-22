import { buildRules, createGame, GameState, JokerPresetId, ModeId, RulesConfig, Suit, teamOf } from '../src/engine';

export interface Setup {
  mode?: ModeId;
  preset?: JokerPresetId;
  rules?: RulesConfig;
  hands: string[][];
  trump: Suit;
  bidder: number;
  bid: number;
  forced?: boolean;
  leader?: number;
  played?: string[];
  bidderHeldUnlockCard?: boolean;
  tricksWon?: [number, number];
  tricksPlayed?: number;
}

/** Build a state in the 'playing' phase with exact hands, for rule tests. */
export function playingState(o: Setup): GameState {
  const mode = o.mode ?? 'bo4';
  const rules = o.rules ?? buildRules(o.preset ?? 'default');
  const g = createGame(rules, mode, 1);
  const leader = o.leader ?? o.bidder;
  return {
    ...g,
    phase: 'playing',
    hands: o.hands.map((h) => h.slice()),
    contract: {
      bidder: o.bidder,
      team: teamOf(g, o.bidder),
      value: o.bid,
      forced: o.forced ?? false,
      trump: o.trump,
      bidderHeldUnlockCard: o.bidderHeldUnlockCard ?? true,
    },
    currentPlayer: leader,
    trick: { leader, plays: [], ledSuit: null },
    playedCards: o.played ?? [],
    tricksWon: o.tricksWon ?? [0, 0],
    tricksPlayed: o.tricksPlayed ?? 0,
  };
}
