/**
 * Perfect-information duel of the playout policies (no hidden cards): the bidding team plays with
 * policy A and the defenders with policy B, then swapped, on the same random deals and contracts.
 */
import { applyAction, buildRules, createGame, type GameState, type Suit } from '../src/engine';
import { playoutCard } from '../src/bots/policy';
import { rolloutCard } from '../src/bots/hard';

const N = Number(process.argv[2] ?? 2000);
const rules = buildRules('default', { playToLastCard: true, renege: { ...buildRules().renege, allowRenege: false }, bawn: { ...buildRules().bawn, bawnOnBid: null } });
function run(bidPolicy: 'new' | 'old', seed: number, bid: number): number {
  let s: GameState = createGame(rules, 'bo4', seed);
  const bidder = s.currentPlayer;
  s = applyAction(s, { type: 'BID', player: bidder, value: bid });
  while (s.phase === 'bidding') s = applyAction(s, { type: 'PASS', player: s.currentPlayer });
  s = applyAction(s, { type: 'CHOOSE_TRUMP', player: bidder, suit: (['S', 'H', 'D', 'C'] as Suit[])[seed % 4] });
  const team = bidder % 2;
  while (s.phase === 'playing') {
    const p = s.currentPlayer;
    const useNew = (p % 2 === team) === (bidPolicy === 'new');
    s = applyAction(s, { type: 'PLAY', player: p, card: useNew ? playoutCard(s) : rolloutCard(s) });
  }
  return s.tricksWon[team];
}
let a = 0, b = 0, madeA = 0, madeB = 0;
for (let i = 1; i <= N; i++) {
  const bid = 6;
  const tA = run('new', i, bid), tB = run('old', i, bid);
  a += tA; b += tB; if (tA >= bid) madeA++; if (tB >= bid) madeB++;
}
console.log(JSON.stringify({ deals: N, bidderTricks_newAttack_oldDefend: (a / N).toFixed(3), bidderTricks_oldAttack_newDefend: (b / N).toFixed(3), madeRate_newAttack: (madeA / N).toFixed(3), madeRate_oldAttack: (madeB / N).toFixed(3) }));
