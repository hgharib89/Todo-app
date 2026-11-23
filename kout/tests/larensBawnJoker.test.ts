import { describe, expect, it } from 'vitest';
import {
  RULES,
  applyAction,
  bidOptions,
  buildDeck,
  buildRules,
  canAskJoker,
  createGame,
  GameState,
  legalActions,
} from '../src/engine';
import { bawnChances, chooseBotAction, countCards, hardBid, inferVoids, jokerKnowledge, sampleHands } from '../src/bots';
import { playingState } from './helpers';

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
const end = (s: GameState) => (s.phase === 'review' ? applyAction(s, { type: 'END_REVIEW' }) : s);

// ---------------------------------------------------------------------------
describe('Larens (لارنس, bid 9)', () => {
  it('config: bid 9 is called لارنس; making it wins the game, failing gives 18', () => {
    expect(RULES.bidding.names[9]).toBe('لارنس');
    expect(RULES.bidding.larens).toBe(9);
    expect(RULES.larens).toMatchObject({ larensWinsGame: true, larensFailPoints: 18 });
  });

  it('making Larens wins the WHOLE game immediately, whatever the score (قيم)', () => {
    const base = playingState({ trump: 'S', bidder: 0, bid: 9, hands: [['S14'], ['H7'], ['H8'], ['H9']], tricksWon: [8, 0], tricksPlayed: 8 });
    const s = end(play({ ...base, scores: [0, 50] }, 'S14', 'H7', 'H8', 'H9'));
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(0);
    expect(s.lastResult).toMatchObject({ made: true, larensWin: true, bid: 9 });
  });

  it('failing Larens gives the opponents 18 and the game goes on', () => {
    const base = playingState({ trump: 'S', bidder: 0, bid: 9, hands: [['H7'], ['S14'], ['H8'], ['H9']], tricksWon: [8, 0], tricksPlayed: 8 });
    const s = end(play(base, 'H7', 'S14', 'H8', 'H9'));
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({ made: false, larensWin: false, points: [0, 18] });
  });

  it('larensWinsGame / larensFailPoints are configurable', () => {
    const rules = buildRules('default', { larens: { larensWinsGame: false, larensMadePoints: 20, larensFailPoints: 25 } });
    const made = end(play(playingState({ rules, trump: 'S', bidder: 0, bid: 9, hands: [['S14'], ['H7'], ['H8'], ['H9']], tricksWon: [8, 0], tricksPlayed: 8 }), 'S14', 'H7', 'H8', 'H9'));
    expect(made.phase).toBe('handOver');
    expect(made.lastResult).toMatchObject({ points: [20, 0], larensWin: false });
    const failed = end(play(playingState({ rules, trump: 'S', bidder: 0, bid: 9, hands: [['H7'], ['S14'], ['H8'], ['H9']], tricksWon: [8, 0], tricksPlayed: 8 }), 'H7', 'S14', 'H8', 'H9'));
    expect(failed.lastResult?.points).toEqual([0, 25]);
  });
});

// ---------------------------------------------------------------------------
describe('Bawn (باون) on bid 7', () => {
  // bid 7 by seat 0 (team 0); after 5 tricks team 0 has all 5 (5–0); four tricks to go
  const hands = () => [
    ['S14', 'S13', 'H14', 'D14'],
    ['H7', 'C7', 'D7', 'D9'],
    ['S12', 'S11', 'C8', 'D10'],
    ['H8', 'C9', 'D8', 'D11'],
  ];
  const at5 = (over: Partial<Parameters<typeof playingState>[0]> = {}) =>
    playingState({ trump: 'S', bidder: 0, bid: 7, hands: hands(), tricksWon: [5, 0], tricksPlayed: 5, ...over });
  const REST = ['S13', 'C7', 'S11', 'C9', 'H14', 'D7', 'C8', 'D8', 'D14', 'D9', 'D10', 'D11'];

  it('config defaults', () => {
    expect(RULES.bawn).toEqual({ bawnOnBid: 7, bawnAskAtTricks: 6, bawnWinPoints: 36, bawnFailPoints: 18 });
  });

  it('asked at 6–0: play pauses and the bidder is asked', () => {
    const s = play(at5(), 'S14', 'H7', 'S12', 'H8');
    expect(s.tricksWon).toEqual([6, 0]);
    expect(s.phase).toBe('bawnAsk');
    expect(s.currentPlayer).toBe(0);
    expect(legalActions(s)).toEqual([
      { type: 'BAWN', player: 0, accept: false },
      { type: 'BAWN', player: 0, accept: true },
    ]);
    expect(() => applyAction(s, { type: 'PLAY', player: 0, card: 'S13' })).toThrow();
    expect(() => applyAction(s, { type: 'BAWN', player: 2, accept: true })).toThrow(); // only the bidder answers
  });

  it.each([1, 2, 3])('never asked at 6–%i: the opponents already have a trick, so the hand stays a normal 7', (opp) => {
    const left = 9 - 5 - opp; // cards left before the trick that makes 6
    const s0 = playingState({
      trump: 'S', bidder: 0, bid: 7, tricksWon: [5, opp], tricksPlayed: 5 + opp,
      hands: hands().map((h, i) => (i === 0 ? ['S14', 'S13', 'H14', 'D14'] : h).slice(0, left)),
    });
    const s = play(s0, 'S14', 'H7', 'S12', 'H8');
    expect(s.tricksWon).toEqual([6, opp]);
    expect(s.phase).not.toBe('bawnAsk');
    expect(s.contract?.bawn ?? null).toBeNull();
  });

  it('6–1 after a trick is lost early: never asked for the rest of the hand, scored as a normal 7', () => {
    // team 0 has 5, team 1 has 1; the 6th trick for team 0 comes later
    const s0 = playingState({ trump: 'S', bidder: 0, bid: 7, hands: hands().map((h) => h.slice(0, 3)), tricksWon: [5, 1], tricksPlayed: 6 });
    let s = play(s0, 'S14', 'H7', 'S12', 'H8');
    expect(s.phase).toBe('playing');
    s = end(play(s, 'S13', 'C7', 'S11', 'C9', 'H14', 'D7', 'C8', 'D8'));
    expect(s.lastResult).toMatchObject({ bawn: null, made: true, points: [7, 0] });
  });

  it('the bidder is asked even when a partner won the 6th trick; play resumes with the trick winner', () => {
    let s = at5({ leader: 2, hands: [['S9', 'S13', 'H14', 'D14'], ['H7', 'C7', 'D7', 'D9'], ['S14', 'S11', 'C8', 'D10'], ['S8', 'C9', 'D8', 'D11']] });
    s = play(s, 'S14', 'S8', 'S9', 'H7');
    expect(s.phase).toBe('bawnAsk');
    expect(s.currentPlayer).toBe(0);
    s = applyAction(s, { type: 'BAWN', player: 0, accept: false });
    expect(s.phase).toBe('playing');
    expect(s.currentPlayer).toBe(2);
  });

  it('No: play continues and the hand scores as a normal 7', () => {
    let s = play(at5(), 'S14', 'H7', 'S12', 'H8');
    s = applyAction(s, { type: 'BAWN', player: 0, accept: false });
    expect(s.contract?.bawn).toBe(false);
    s = end(play(s, ...REST));
    expect(s.lastResult).toMatchObject({ bawn: false, made: true, points: [7, 0] });
  });

  it('Yes + every remaining trick (all 9) → 36', () => {
    let s = play(at5(), 'S14', 'H7', 'S12', 'H8');
    s = applyAction(s, { type: 'BAWN', player: 0, accept: true });
    expect(s.contract?.bawn).toBe(true);
    s = end(play(s, ...REST));
    expect(s.tricksWon).toEqual([9, 0]);
    expect(s.lastResult).toMatchObject({ bawn: true, made: true, points: [36, 0] });
  });

  it('Yes + losing any trick → broken, the opponents get 18', () => {
    let s = play(at5(), 'S14', 'H7', 'S12', 'H8');
    s = applyAction(s, { type: 'BAWN', player: 0, accept: true });
    s = play(s, 'S13', 'C7', 'S11', 'C9'); // team 0: 7 tricks
    // the last two tricks: seat 3's C14 wins one
    s = play({ ...s, hands: [['C7', 'D14'], ['D7', 'D9'], ['C8', 'D10'], ['C14', 'D11']] }, 'C7', 'D7', 'C8', 'C14');
    s = end(play(s, 'D11', 'D14', 'D9', 'D10'));
    expect(s.lastResult).toMatchObject({ bawn: true, made: false, points: [0, 18] });
  });

  it('with playToLastCard off, a failed Bawn ends the hand at once', () => {
    const rules = buildRules('default', { playToLastCard: false });
    let s = play(at5({ rules, hands: [['S14', 'C7', 'H14', 'D14'], ['H7', 'C14', 'D7', 'D9'], ['S12', 'S11', 'C8', 'D10'], ['H8', 'C9', 'D8', 'D11']] }), 'S14', 'H7', 'S12', 'H8');
    s = applyAction(s, { type: 'BAWN', player: 0, accept: true });
    s = play(s, 'C7', 'C14', 'C8', 'C9'); // seat 1 wins a trick
    expect(s.phase).toBe('handOver');
    expect(s.lastResult).toMatchObject({ bawn: true, points: [0, 18], endedEarly: true });
  });

  it('is asked only once, only for bid 7, and can be switched off', () => {
    let s = applyAction(play(at5(), 'S14', 'H7', 'S12', 'H8'), { type: 'BAWN', player: 0, accept: false });
    s = play(s, 'S13', 'C7', 'S11', 'C9');
    expect(s.phase).toBe('playing');
    expect(play(at5({ bid: 8 }), 'S14', 'H7', 'S12', 'H8').phase).toBe('playing');
    const off = buildRules('default', { bawn: { ...RULES.bawn, bawnOnBid: null } });
    expect(play(at5({ rules: off }), 'S14', 'H7', 'S12', 'H8').phase).toBe('playing');
  });

  it('points and the trigger are configurable', () => {
    const rules = buildRules('default', { bawn: { bawnOnBid: 7, bawnAskAtTricks: 5, bawnWinPoints: 40, bawnFailPoints: 20 } });
    const h5 = [
      ['S14', 'S13', 'H14', 'D14', 'C14'],
      ['H7', 'C7', 'D7', 'D9', 'C10'],
      ['S12', 'S11', 'C8', 'D10', 'C11'],
      ['H8', 'C9', 'D8', 'D11', 'C12'],
    ];
    const s = playingState({ rules, trump: 'S', bidder: 0, bid: 7, hands: h5, tricksWon: [4, 0], tricksPlayed: 4 });
    let t = play(s, 'S14', 'H7', 'S12', 'H8');
    expect(t.phase).toBe('bawnAsk');
    t = end(play(applyAction(t, { type: 'BAWN', player: 0, accept: true }), ...REST, 'C14', 'C10', 'C11', 'C12'));
    expect(t.lastResult?.points).toEqual([40, 0]);
  });

  it('bots answer from their hand and the cards still out', () => {
    const ask = (h0: string[], h1 = ['H7', 'C7', 'D7', 'H9'], h3 = ['H8', 'C14', 'D8', 'H10'], h2 = ['S9', 'C8', 'D9', 'D10']) => {
      const all = [h0, h1, h2, h3];
      const s = playingState({ trump: 'S', bidder: 0, bid: 7, tricksWon: [5, 0], tricksPlayed: 5, hands: all });
      const inHands = new Set(all.flat());
      const consistent = { ...s, playedCards: buildDeck(s.rules, s.mode).filter((c) => !inHands.has(c)) };
      return play(consistent, h0[0], h1[0], h2[0], h3[0]);
    };
    // the best trumps left (jokers and the other high trumps are gone) → yes
    const strong = ask(['S14', 'S13', 'S12', 'S10']);
    expect(strong.phase).toBe('bawnAsk');
    for (const d of ['hard', 'medium'] as const) expect(chooseBotAction(strong, d, seeded(1), { samples: 20 })).toEqual({ type: 'BAWN', player: 0, accept: true });
    // three small cards left, no trumps left anywhere, the aces are still out → no
    const all = [['S14', 'C7', 'D7', 'H9'], ['H7', 'C14', 'D14', 'H14'], ['S12', 'C8', 'D9', 'H10'], ['H8', 'C9', 'D8', 'C10']];
    const w0 = playingState({ trump: 'S', bidder: 0, bid: 7, tricksWon: [5, 0], tricksPlayed: 5, hands: all });
    const inHands = new Set(all.flat());
    const weak = play({ ...w0, playedCards: buildDeck(w0.rules, w0.mode).filter((c) => !inHands.has(c)) }, 'S14', 'H7', 'S12', 'H8');
    expect(weak.phase).toBe('bawnAsk');
    for (const d of ['hard', 'medium'] as const) expect(chooseBotAction(weak, d, seeded(1), { samples: 40 })).toEqual({ type: 'BAWN', player: 0, accept: false });
    expect(bawnChances(weak, seeded(2), 40).all).toBeLessThan(0.2);
  });
});

// ---------------------------------------------------------------------------
describe('asking partner about the other joker (سؤال الجوكر)', () => {
  // bo4, dealer 3 → seat 0 speaks first; partner of 0 is 2
  const deal = (h0: string[], h2: string[], dealer = 3, rules = buildRules('default', { firstDealer: dealer })) => {
    const g = createGame(rules, 'bo4', 1);
    const rest = buildDeck(rules, 'bo4').filter((c) => !h0.includes(c) && !h2.includes(c));
    const hands = [h0, rest.slice(0, 9), h2, rest.slice(9, 18)];
    return { ...g, hands };
  };
  const ONE = ['XR', 'S14', 'S13', 'S12', 'H14', 'D14', 'C14', 'S9', 'S8'];
  const P_YES = ['XB', 'H7', 'H8', 'H9', 'D7', 'D8', 'C7', 'C8', 'C9'];
  const P_NO = ['H10', 'H7', 'H8', 'H9', 'D7', 'D8', 'C7', 'C8', 'C9'];

  it('config defaults', () => {
    expect(RULES.jokerAsk).toEqual({ allowJokerAsk: true, jokerAskYesBid: 9, jokerAskNoBid: 8 });
  });

  it('only with exactly one joker, on your bidding turn', () => {
    expect(canAskJoker(deal(ONE, P_YES), 0)).toBe(true);
    expect(legalActions(deal(ONE, P_YES))).toContainEqual({ type: 'JOKER_ASK', player: 0 });
    const none = ['H11', ...ONE.slice(1)];
    expect(canAskJoker(deal(none, P_YES), 0)).toBe(false);
    const two = ['XR', 'XB', ...ONE.slice(2)];
    expect(canAskJoker(deal(two, P_NO), 0)).toBe(false);
    expect(canAskJoker(deal(ONE, P_YES), 1)).toBe(false); // not seat 1's turn
  });

  it('partner has the other joker → forced Larens (9); the answer is recorded and shown', () => {
    const s = applyAction(deal(ONE, P_YES), { type: 'JOKER_ASK', player: 0 });
    expect(s.bids[0]).toMatchObject({ player: 0, value: 9, forced: false, jokerAsk: { answer: true, holder: 2 } });
    expect(s.phase).toBe('choosingTrump'); // Larens ends the bidding
    expect(s.contract).toMatchObject({ bidder: 0, value: 9 });
  });

  it('partner does not → forced 8, bidding continues', () => {
    const s = applyAction(deal(ONE, P_NO), { type: 'JOKER_ASK', player: 0 });
    expect(s.bids[0]).toMatchObject({ value: 8, jokerAsk: { answer: false, holder: null } });
    expect(s.phase).toBe('bidding');
    expect(bidOptions(s).values).toEqual([9]);
  });

  it('only while the forced bid is still legal (highest bid below 8)', () => {
    let s = deal(ONE, P_YES, 2); // dealer 2 → seat 3 speaks first, then seat 0
    s = applyAction(s, { type: 'BID', player: 3, value: 7 });
    expect(canAskJoker(s, 0)).toBe(true);
    let t = deal(ONE, P_YES, 2);
    t = applyAction(t, { type: 'BID', player: 3, value: 8 });
    expect(canAskJoker(t, 0)).toBe(false);
    expect(() => applyAction(t, { type: 'JOKER_ASK', player: 0 })).toThrow();
  });

  it('Bo 6: "yes" when any partner has it', () => {
    const rules = buildRules('default', { firstDealer: 5 });
    const g = createGame(rules, 'bo6', 1);
    const h0 = ['XB', 'S14', 'S13', 'S12', 'H14', 'D14', 'C14', 'S9', 'S8'];
    const h4 = ['XR', 'H2', 'H3', 'H4', 'D2', 'D3', 'C2', 'C3', 'C4'];
    const rest = buildDeck(rules, 'bo6').filter((c) => !h0.includes(c) && !h4.includes(c));
    const hands = [h0, rest.slice(0, 9), rest.slice(9, 18), rest.slice(18, 27), h4, rest.slice(27, 36)];
    const s = applyAction({ ...g, hands }, { type: 'JOKER_ASK', player: 0 });
    expect(s.bids[0].jokerAsk).toEqual({ answer: true, holder: 4 });
  });

  it('configurable: switched off, or other forced bids', () => {
    expect(canAskJoker(deal(ONE, P_YES, 3, buildRules('default', { firstDealer: 3, jokerAsk: { ...RULES.jokerAsk, allowJokerAsk: false } })), 0)).toBe(false);
    const r = buildRules('default', { firstDealer: 3, jokerAsk: { allowJokerAsk: true, jokerAskYesBid: 8, jokerAskNoBid: 7 } });
    expect(applyAction(deal(ONE, P_NO, 3, r), { type: 'JOKER_ASK', player: 0 }).bids[0].value).toBe(7);
  });

  it('what the answer revealed is used when bots imagine the hidden hands', () => {
    const yes = applyAction(deal(ONE, P_YES), { type: 'JOKER_ASK', player: 0 });
    expect(jokerKnowledge(yes)).toMatchObject({ min: [1, 0, 1, 0], max: [1, 2, 1, 2] });
    const no = applyAction(deal(ONE, P_NO), { type: 'JOKER_ASK', player: 0 });
    expect(jokerKnowledge(no)).toMatchObject({ min: [1, 0, 0, 0], max: [1, 2, 0, 2] });
    // from seat 1's view (an opponent), seat 2 never gets a joker after a "no"
    let s = applyAction(no, { type: 'PASS', player: 1 });
    s = applyAction(s, { type: 'PASS', player: 2 });
    s = applyAction(s, { type: 'PASS', player: 3 });
    s = applyAction(s, { type: 'CHOOSE_TRUMP', player: 0, suit: 'S' });
    for (let k = 0; k < 30; k++) {
      const h = sampleHands(s, 1, inferVoids(s), seeded(k + 1));
      expect(h[2].some((c) => c[0] === 'X')).toBe(false);
      expect(h[0].filter((c) => c[0] === 'X')).toHaveLength(1);
    }
    expect(countCards(s, 1).jokersOut).toHaveLength(2); // seat 1 holds neither joker: both are still out
  });

  it('Hard bots ask when it pays, and only then', () => {
    const P2 = deal(ONE, P_YES).hands[2];
    // a strong hand with one joker: an 8 is safe even if partner says no → ask
    const strong = ['XR', 'S14', 'S13', 'S12', 'S11', 'H14', 'D14', 'C14', 'S10'];
    expect(hardBid(deal(strong, P2.filter((c) => !strong.includes(c))))).toEqual({ type: 'JOKER_ASK', player: 0 });
    // a weaker one: a forced 8 would be reckless → a normal bid instead
    const weaker = ['XR', 'S14', 'S13', 'S12', 'S10', 'H14', 'D14', 'C9', 'D9'];
    const a = hardBid(deal(weaker, P2.filter((c) => !weaker.includes(c))));
    expect(a.type).not.toBe('JOKER_ASK');
    // and never without exactly one joker
    for (let seed = 1; seed <= 200; seed++) {
      const s = createGame(buildRules(), seed % 2 ? 'bo4' : 'bo6', seed);
      if (hardBid(s).type === 'JOKER_ASK') expect(canAskJoker(s, s.currentPlayer)).toBe(true);
    }
  });
});

describe('bots play full games with Larens, Bawn and the joker question', () => {
  it('questions get asked and answered, and every action is legal', () => {
    let jokerAsks = 0;
    let bawnQs = 0;
    for (let g = 0; g < 30; g++) {
      let s = createGame(buildRules(), 'bo4', 900 + g);
      const rng = seeded(g + 1);
      let guard = 0;
      while (s.phase !== 'gameOver') {
        if (s.phase === 'bawnAsk') bawnQs++;
        const a = chooseBotAction(s, 'medium', rng);
        expect(legalActions(s)).toContainEqual(a);
        if (a.type === 'JOKER_ASK') jokerAsks++;
        s = applyAction(s, a);
        if (++guard > 20000) throw new Error('stuck');
      }
      expect(s.winner).not.toBeNull();
    }
    expect(jokerAsks).toBeGreaterThan(0);
    expect(bawnQs).toBeGreaterThan(0);
  }, 60000);
});
