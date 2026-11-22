import { describe, expect, it } from 'vitest';
import { applyAction, buildDeck, buildRules, createGame, GameState, legalActions, JokerPresetId, RulesConfig } from '../src/engine';
import {
  HARD_MIN_MAKE_CHANCE,
  chooseBotAction,
  chooseTrump,
  countCards,
  handStrength,
  hardBid,
  inferVoids,
  makeChance,
  monteCarloScores,
  sampleHands,
  teamEstimate,
} from '../src/bots';
import { playingState, Setup } from './helpers';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function play(s: GameState, ...cards: string[]): GameState {
  for (const card of cards) s = applyAction(s, { type: 'PLAY', player: s.currentPlayer, card });
  return s;
}

/**
 * A consistent mid-hand position: every card not in a hand counts as already played, and
 * the trick counts match the hand sizes (by default the bidding team needs one more trick).
 */
function consistent(o: Setup): GameState {
  const maxLen = Math.max(...o.hands.map((h) => h.length));
  const tp = o.tricksPlayed ?? 9 - maxLen;
  const won = Math.min(tp, o.bid - 1);
  const bidTeam = o.bidder % 2;
  const tricksWon = o.tricksWon ?? ((bidTeam === 0 ? [won, tp - won] : [tp - won, won]) as [number, number]);
  const s = playingState({ ...o, tricksPlayed: tp, tricksWon });
  const inHands = new Set(o.hands.flat());
  return { ...s, playedCards: buildDeck(s.rules, s.mode).filter((c) => !inHands.has(c)) };
}

const hard = (s: GameState, seed = 1, samples = 30) => chooseBotAction(s, 'hard', seeded(seed), { samples });

/** A bidding-phase state with exact hands (seat `dealer` deals, the next seat speaks first). */
function biddingState(hands: string[][], dealer = 0, rules: RulesConfig = buildRules('default', { firstDealer: dealer })): GameState {
  const g = createGame(rules, 'bo4', 1);
  return { ...g, hands: hands.map((h) => h.slice()) };
}

const WEAK = ['H6', 'H7', 'C6', 'C7', 'D7', 'D8', 'S6', 'S7', 'C8'];
const MONSTER = ['XR', 'XB', 'S14', 'S13', 'S12', 'S11', 'S10', 'H14', 'D14'];
const GOOD = ['XR', 'S14', 'S13', 'S9', 'S8', 'H14', 'H13', 'C7', 'D8'];
const FILL = [
  ['H8', 'H9', 'H10', 'C9', 'C10', 'D9', 'D10', 'S8', 'C11'],
  ['H11', 'H12', 'C12', 'C13', 'D11', 'D12', 'S9', 'C14', 'D13'],
  ['H13', 'C6', 'D7', 'S6', 'S7', 'D6', 'H6', 'H7', 'C7'],
];

describe('hard bot — card counting', () => {
  it('tracks which jokers and high cards are still out', () => {
    const s0 = consistent({
      trump: 'S', bidder: 0, bid: 6,
      hands: [['H14', 'S12', 'C7'], ['XR', 'H7', 'S6'], ['H13', 'S14', 'C8'], ['XB', 'H8', 'S13']],
    });
    let c = countCards(s0, 0);
    expect(c.jokersOut.sort()).toEqual(['XB', 'XR']);
    expect(c.trumpsOut).toEqual(['XR', 'S14', 'XB', 'S13', 'S6']); // strongest first
    expect(c.highestOut.H).toBe('H13');
    const s1 = play(s0, 'H14', 'XR'); // seat 1 drops the red joker
    c = countCards(s1, 0);
    expect(c.jokersOut).toEqual(['XB']);
    expect(c.unseen).not.toContain('XR');
    expect(c.unseen).not.toContain('S12'); // my own card is not "out"
  });
});

describe('hard bot — void inference', () => {
  const H = [['H14', 'H13', 'C7'], ['H7', 'D9', 'C8'], ['D7', 'D8', 'C9'], ['H8', 'XR', 'C10']];

  it('a player who did not follow suit is void in it; a joker does not prove a void', () => {
    const s = play(playingState({ trump: 'S', bidder: 0, bid: 6, hands: H }), 'H14', 'H7', 'D7', 'XR');
    const v = inferVoids(s);
    expect([...v[2]]).toEqual(['H']);
    expect(v[1].size).toBe(0);
    expect(v[3].size).toBe(0); // jokers may be played while holding the suit
    expect(s.tricks).toHaveLength(1);
  });

  it('when jokers may not be played while holding the suit, a joker proves a void', () => {
    const rules = buildRules('default', { jokers: { canPlayWhileHoldingLedSuit: false } });
    const hands = [H[0], H[1], H[2], ['XR', 'D10', 'C10']];
    const s = play(playingState({ rules, trump: 'S', bidder: 0, bid: 6, hands }), 'H14', 'H7', 'D7', 'XR');
    expect([...inferVoids(s)[3]]).toEqual(['H']);
  });

  it('cards played before the led suit is set (cancelled joker lead) prove nothing', () => {
    // seat 0 must lead its last card, a joker it may not lead → cancelled; seat 1's H7 sets the suit
    const hands = [['XB'], ['H7'], ['D7'], ['H8']];
    let s = playingState({ trump: 'S', bidder: 1, bid: 6, leader: 0, hands, tricksPlayed: 8, tricksWon: [3, 5] });
    s = play(s, 'XB', 'H7', 'D7');
    expect(s.trick.plays[0].cancelled).toBe(true);
    const v = inferVoids(s);
    expect(v[0].size).toBe(0); // the cancelled joker lead proves nothing
    expect(v[1].size).toBe(0); // H7 set the suit
    expect([...v[2]]).toEqual(['H']); // D7 on a heart → void
  });

  it('works across the whole hand (in-progress trick included)', () => {
    let s = playingState({ trump: 'S', bidder: 0, bid: 6, hands: H });
    s = play(s, 'H14', 'H7', 'D7', 'H8'); // seat 2 void H
    s = play(s, 'C7', 'C8', 'C9'); // in progress
    expect([...inferVoids(s)[2]]).toEqual(['H']);
  });
});

describe('hard bot — sampling hidden hands', () => {
  it('deals exactly the unseen cards, respects hand sizes and known voids', () => {
    const g = createGame(buildRules(), 'bo4', 7);
    let s = applyAction(g, { type: 'BID', player: g.currentPlayer, value: 9 });
    s = applyAction(s, { type: 'CHOOSE_TRUMP', player: s.currentPlayer, suit: 'S' });
    const rng = seeded(3);
    // play two tricks with medium bots to build up history
    while (s.tricks.length < 2) s = applyAction(s, chooseBotAction(s, 'medium', rng));
    const me = s.currentPlayer;
    const voids = inferVoids(s);
    const unseen = countCards(s, me).unseen.sort();
    for (let k = 0; k < 50; k++) {
      const hands = sampleHands(s, me, voids, seeded(k + 1));
      expect(hands[me]).toEqual(s.hands[me]);
      hands.forEach((h, p) => expect(h.length).toBe(s.hands[p].length));
      expect(hands.filter((_, p) => p !== me).flat().sort()).toEqual(unseen);
      hands.forEach((h, p) => {
        if (p === me) return;
        for (const suit of voids[p]) expect(h.some((c) => c[0] === suit)).toBe(false);
      });
    }
  });
});

describe('hard bot — hand evaluation, trump and bidding', () => {
  it('chooses the trump suit that suits its hand', () => {
    const s = createGame(buildRules(), 'bo4', 1);
    expect(chooseTrump(s, ['XR', 'XB', 'H14', 'H13', 'H10', 'H9', 'S7', 'C8', 'D6']).suit).toBe('H');
    expect(chooseTrump(s, ['C14', 'C13', 'C12', 'C9', 'C8', 'H6', 'S7', 'D8', 'D9']).suit).toBe('C');
  });

  it('values jokers, the trump Ace, trump length and side winners', () => {
    const s = createGame(buildRules(), 'bo4', 1);
    const base = handStrength(s, ['S9', 'S8', 'H7', 'H8', 'C7', 'C8', 'D7', 'D8', 'C9'], 'S');
    expect(handStrength(s, ['XR', 'S8', 'H7', 'H8', 'C7', 'C8', 'D7', 'D8', 'C9'], 'S')).toBeGreaterThan(base + 0.6);
    expect(handStrength(s, ['S14', 'S8', 'H7', 'H8', 'C7', 'C8', 'D7', 'D8', 'C9'], 'S')).toBeGreaterThan(base + 0.6); // only the red joker ranks above it
    expect(handStrength(s, ['S9', 'S8', 'S7', 'S6', 'S10', 'C8', 'D7', 'D8', 'C9'], 'S')).toBeGreaterThan(base + 1);
    expect(handStrength(s, ['S9', 'S8', 'H14', 'H8', 'C7', 'C8', 'D7', 'D8', 'C9'], 'S')).toBeGreaterThan(base + 0.5);
    expect(handStrength(s, MONSTER, 'S')).toBeGreaterThan(7.5);
  });

  it('passes with a weak hand and bids with a strong one', () => {
    expect(hardBid(biddingState([FILL[0], WEAK, FILL[1], FILL[2]]))).toEqual({ type: 'PASS', player: 1 });
    const strong = hardBid(biddingState([FILL[0], GOOD, FILL[1], FILL[2]]));
    expect(strong.type).toBe('BID');
  });

  it('never bids below the minimum voluntary bid, and takes Malzoom when forced with a weak hand', () => {
    let s = biddingState([WEAK, FILL[0], FILL[1], FILL[2]]);
    for (const p of [1, 2, 3]) s = applyAction(s, { type: 'PASS', player: p });
    expect(hardBid(s)).toEqual({ type: 'BID', player: 0, value: 5 });
  });

  it('only bids Bawan with a monster hand', () => {
    expect(hardBid(biddingState([FILL[0], MONSTER, FILL[1], FILL[2]]))).toMatchObject({ type: 'BID', value: 9 });
    const good = hardBid(biddingState([FILL[0], GOOD, FILL[1], FILL[2]]));
    expect(good.type === 'BID' && good.value).not.toBe(9);
  });

  it('never overbids: every voluntary bid has a good chance of being made', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = createGame(buildRules(), seed % 2 ? 'bo4' : 'bo6', seed);
      const a = hardBid(s);
      if (a.type !== 'BID') continue;
      const { team } = teamEstimate(s, s.currentPlayer);
      expect(makeChance(team, a.value, 9)).toBeGreaterThanOrEqual(HARD_MIN_MAKE_CHANCE);
      expect(a.value).toBeGreaterThanOrEqual(s.rules.bidding.minVoluntaryBid);
    }
  });

  it('does not outbid its partner without a much stronger hand', () => {
    let s = biddingState([FILL[0], FILL[1], FILL[2], GOOD], 0);
    s = applyAction(s, { type: 'BID', player: 1, value: 6 }); // partner of seat 3
    s = applyAction(s, { type: 'PASS', player: 2 });
    const a = hardBid(s);
    if (a.type === 'BID') {
      expect(makeChance(teamEstimate(s, 3).team, a.value, 9)).toBeGreaterThanOrEqual(0.85);
    }
  });
});

describe('hard bot — card play', () => {
  it('does not overtake a partner who is winning; feeds a low card', () => {
    // partner (seat 2) leads the boss heart; seat 3 follows; seat 0 must not waste H13
    let s = consistent({
      trump: 'S', bidder: 0, bid: 6, leader: 2,
      hands: [['H13', 'H7', 'S14'], ['H9', 'C9', 'D9'], ['H14', 'D7', 'C7'], ['H8', 'C8', 'D8']],
    });
    s = play(s, 'H14', 'H8');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'H7' });
  });

  it('plays low as last player when partner already has the trick', () => {
    let s = consistent({
      trump: 'S', bidder: 0, bid: 6, leader: 1,
      hands: [['H14', 'H13', 'H7'], ['H10', 'C9', 'D9'], ['H12', 'C8', 'D8'], ['H6', 'C7', 'D7']],
    });
    s = play(s, 'H10', 'H12', 'H6');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'H7' });
  });

  it('wins as cheaply as possible', () => {
    let s = consistent({
      trump: 'S', bidder: 0, bid: 6, leader: 1,
      hands: [['H14', 'H13', 'H7', 'XR'], ['H10', 'C9', 'D9', 'D10'], ['H6', 'C8', 'D8', 'C10'], ['H12', 'C7', 'D7', 'C11']],
    });
    s = play(s, 'H10', 'H6', 'H12');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'H13' });
  });

  it('saves jokers: ruffs with a small trump instead of a joker', () => {
    let s = consistent({
      trump: 'S', bidder: 1, bid: 6, leader: 1,
      hands: [['XB', 'S9', 'C7'], ['D14', 'H9', 'C9'], ['D6', 'H8', 'C8'], ['D7', 'H7', 'C10']],
    });
    s = play(s, 'D14', 'D6', 'D7');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'S9' });
  });

  it('keeps the trump Ace when a lower trump is enough', () => {
    let s = consistent({
      trump: 'S', bidder: 1, bid: 6, leader: 1,
      hands: [['S14', 'S9', 'C7'], ['D14', 'H9', 'C9'], ['D6', 'H8', 'C8'], ['D7', 'H7', 'C10']],
    });
    s = play(s, 'D14', 'D6', 'D7');
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'S9' });
  });

  it('Monte Carlo: draws trumps before cashing a side Ace that could be ruffed', () => {
    // bid 7, 5 tricks won, 2 to go: both are needed
    const s = consistent({
      trump: 'S', bidder: 0, bid: 7, tricksWon: [5, 2], tricksPlayed: 7,
      hands: [['S14', 'H14'], ['S7', 'D9'], ['H7', 'D7'], ['H8', 'D8']],
    });
    const scores = monteCarloScores(s, seeded(5), 40);
    const by = Object.fromEntries(scores.map((m) => [m.card, m.expected]));
    expect(by.S14).toBeGreaterThan(by.H14);
    expect(hard(s)).toEqual({ type: 'PLAY', player: 0, card: 'S14' });
  });

  it('Monte Carlo is reproducible with a seeded RNG and skips interchangeable cards', () => {
    const s = consistent({
      trump: 'S', bidder: 0, bid: 6,
      hands: [['H14', 'H13', 'H12', 'C7'], ['H9', 'C9', 'D9', 'S6'], ['H8', 'C8', 'D8', 'S7'], ['H6', 'C6', 'D7', 'S8']],
    });
    const a = monteCarloScores(s, seeded(9), 12);
    const b = monteCarloScores(s, seeded(9), 12);
    expect(a).toEqual(b);
    // H14/H13/H12 are touching with nothing out between them → only one is simulated
    expect(a.map((m) => m.card).filter((c) => c[0] === 'H')).toHaveLength(1);
  });

  it('uses what it inferred: leads into a known void only when it helps', () => {
    // seat 1 showed out of hearts earlier, so cashing H14 risks a ruff; trump first.
    // seat 3 leads clubs; seat 0 (us) wins with C14; seat 1 shows out of clubs
    let s = consistent({
      trump: 'S', bidder: 0, bid: 7, leader: 3, tricksPlayed: 6, tricksWon: [5, 1],
      hands: [
        ['C14', 'S14', 'C13'],
        ['D10', 'S7', 'D9'],
        ['C9', 'H7', 'D7'],
        ['C8', 'D8', 'H8'],
      ],
    });
    s = play(s, 'C8', 'C14', 'D10', 'C9');
    expect([...inferVoids(s)[1]]).toEqual(['C']);
    expect(s.currentPlayer).toBe(0);
    // need both remaining tricks: cashing C13 now would be ruffed by seat 1 → draw its trump first
    expect(hard(s, 2, 40)).toEqual({ type: 'PLAY', player: 0, card: 'S14' });
  });
});

describe('hard bot — always obeys the rules', () => {
  const presets: JokerPresetId[] = ['default', 'strict', 'stricter', 'relaxed'];
  for (const mode of ['bo4', 'bo6'] as const) {
    it(`hard bots finish ${mode} games using only legal actions (all presets)`, () => {
      presets.forEach((preset, k) => {
        let s = createGame(buildRules(preset), mode, 77 + k);
        const rng = seeded(k + 1);
        let guard = 0;
        while (s.phase !== 'gameOver') {
          const a = s.phase === 'handOver' ? { type: 'NEXT_HAND' as const } : chooseBotAction(s, 'hard', rng, { samples: 3 });
          expect(legalActions(s)).toContainEqual(a);
          s = applyAction(s, a);
          if (++guard > 5000) throw new Error('stuck');
        }
        expect(s.winner).not.toBeNull();
      });
    }, 60000);
  }

  it('hard bots beat medium bots', () => {
    let hardWins = 0;
    const games = 8;
    for (let g = 0; g < games; g++) {
      let s = createGame(buildRules(), 'bo4', 1000 + g);
      const rng = seeded(g + 1);
      const hardTeam = g % 2;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'handOver') {
          s = applyAction(s, { type: 'NEXT_HAND' });
          continue;
        }
        const diff = s.currentPlayer % 2 === hardTeam ? 'hard' : 'medium';
        s = applyAction(s, chooseBotAction(s, diff, rng, { samples: 12 }));
      }
      if (s.winner === hardTeam) hardWins++;
    }
    expect(hardWins).toBeGreaterThan(games / 2);
  }, 60000);
});
