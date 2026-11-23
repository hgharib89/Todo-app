/**
 * Self-play benchmark: the new Hard bot (PIMC) against the previous Hard bot (v1).
 *   npx vite-node scripts/bench-bots.ts --games 100 --mode bo4 --seed 1 --deals 60 --timeMs 300 --out result.json
 * Teams switch sides every game. Reports win rate, bid success, Larens/Bawn, and joker timing.
 */
import { writeFileSync } from 'node:fs';
import { applyAction, buildRules, createGame, type GameState, isJoker, teamOf } from '../src/engine';
import { chooseBotAction, chooseBotCatch, handDecidedNow, legacyHardAction, setPimcBlend, setPimcMinMake } from '../src/bots';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const GAMES = Number(arg('games', '20'));
const MODE = arg('mode', 'bo4') as 'bo4' | 'bo6';
const SEED = Number(arg('seed', '1'));
const DEALS = Number(arg('deals', '200'));
const TIME = Number(arg('timeMs', '1000'));
const BID_DEALS = Number(arg('bidDeals', '60'));
const OUT = arg('out', '');
/** ablation: which parts of the "new" side are really new (default both) */
const NEW_BID = arg('newBid', 'new');
const NEW_PLAY = arg('newPlay', 'new');
if (arg('minMake', '')) setPimcMinMake(Number(arg('minMake', '0.7')));
if (arg('blend', '')) setPimcBlend(Number(arg('blend', '0.5')));

type Side = 'new' | 'old';
const blank = () => ({ games: 0, wins: 0, contracts: 0, made: 0, forced: 0, forcedMade: 0, larens: 0, larensMade: 0, bawn: 0, bawnMade: 0, jokerAsks: 0, jokerPlays: 0, jokerTrickSum: 0, jokerLastTrick: 0, jokerWon: 0, liveJokerPlays: 0, liveJokerTrickSum: 0, liveJokerWon: 0, liveJokerLost: 0, jokersLeftAtDecision: 0, decidedHands: 0, hands: 0, points: 0, catches: 0 });
const R: Record<Side, ReturnType<typeof blank>> = { new: blank(), old: blank() };

let k = SEED * 7919;
const rng = () => ((k = (k * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const t0 = Date.now();

for (let g = 0; g < GAMES; g++) {
  let s: GameState = createGame(buildRules(), MODE, SEED * 100000 + g);
  const newTeam = g % 2;
  const side = (seat: number): Side => (teamOf(s, seat) === newTeam ? 'new' : 'old');
  let guard = 0;
  const pending: { p: number; who: Side; live: boolean; hand: number; trick: number }[] = [];
  let recorded = 0;
  let decidedSeen = false;
  const record = () => {
    // a hand just got scored
    while (recorded < s.history.length) {
      const r = s.history[recorded++];
      const bidder = side(r.bidder);
      R.new.hands++;
      R.old.hands++;
      R[bidder][r.forced ? 'forced' : 'contracts']++;
      if (r.made && !r.caught) R[bidder][r.forced ? 'forcedMade' : 'made']++;
      if (!r.forced && r.bid === s.rules.bidding.larens) {
        R[bidder].larens++;
        if (r.made) R[bidder].larensMade++;
      }
      if (r.bawn) {
        R[bidder].bawn++;
        if (r.made) R[bidder].bawnMade++;
      }
      R.new.points += r.points[newTeam];
      R.old.points += r.points[1 - newTeam];
      decidedSeen = false;
    }
  };
  while (s.phase !== 'gameOver' && guard++ < 5000) {
    record();
    // jokers a team still holds at the moment the hand's result is settled (unused power)
    if (s.phase === 'playing' && !decidedSeen && s.contract?.trump && handDecidedNow(s)) {
      decidedSeen = true;
      for (let p = 0; p < s.numPlayers; p++) R[side(p)].jokersLeftAtDecision += s.hands[p].filter(isJoker).length;
      R.new.decidedHands++;
      R.old.decidedHands++;
    }
    if (s.phase === 'handOver') {
      s = applyAction(s, { type: 'NEXT_HAND' });
      continue;
    }
    // catches: both bots catch every visible renege (neither reneges, so this rarely fires)
    if (s.phase === 'playing' || s.phase === 'review') {
      const c = [...Array(s.numPlayers).keys()].map((p) => chooseBotCatch(s, p, 'hard')).find(Boolean);
      if (c) {
        R[side((c as { player: number }).player)].catches++;
        s = applyAction(s, c);
        continue;
      }
    }
    if (s.phase === 'review') {
      s = applyAction(s, { type: 'END_REVIEW' });
      continue;
    }
    const p = s.currentPlayer;
    const who = side(p);
    const isBidPhase = s.phase === 'bidding' || s.phase === 'choosingTrump' || s.phase === 'bawnAsk';
    const useNew = who === 'new' && (isBidPhase ? NEW_BID === 'new' : NEW_PLAY === 'new');
    const a = useNew ? chooseBotAction(s, 'hard', rng, { deals: DEALS, timeMs: TIME, bidDeals: BID_DEALS }) : legacyHardAction(s, rng);
    if (a.type === 'JOKER_ASK') R[who].jokerAsks++;
    const before = s;
    s = applyAction(s, a);
    if (a.type === 'PLAY' && isJoker(a.card)) {
      const live = !handDecidedNow(before);
      R[who].jokerPlays++;
      R[who].jokerTrickSum += before.tricksPlayed + 1;
      if (before.tricksPlayed === before.rules.modes[before.mode].handSize - 1) R[who].jokerLastTrick++;
      if (live) {
        R[who].liveJokerPlays++;
        R[who].liveJokerTrickSum += before.tricksPlayed + 1;
      }
      pending.push({ p, who, live, hand: before.handNumber, trick: before.tricksPlayed });
    }
    // settle pending joker plays once their trick is complete
    for (let i = pending.length - 1; i >= 0; i--) {
      const j = pending[i];
      if (j.hand !== s.handNumber && s.phase === 'bidding') {
        pending.splice(i, 1);
        continue;
      }
      const t = s.tricks?.[j.trick];
      if (!t) continue;
      pending.splice(i, 1);
      if (t.winner === j.p) {
        R[j.who].jokerWon++;
        if (j.live) R[j.who].liveJokerWon++;
      } else if (j.live && teamOf(s, t.winner) !== teamOf(s, j.p)) R[j.who].liveJokerLost++;
    }
  }
  record();
  R.new.games++;
  R.old.games++;
  if (s.winner === newTeam) R.new.wins++;
  else R.old.wins++;
  if ((g + 1) % 5 === 0) console.log(`[${MODE} seed ${SEED}] ${g + 1}/${GAMES} new ${R.new.wins} – old ${R.old.wins}  (${Math.round((Date.now() - t0) / 1000)}s)`);
}
const out = { mode: MODE, seed: SEED, games: GAMES, deals: DEALS, timeMs: TIME, bidDeals: BID_DEALS, seconds: Math.round((Date.now() - t0) / 1000), R };
console.log('RESULT ' + JSON.stringify(out));
if (OUT) writeFileSync(OUT, JSON.stringify(out));
