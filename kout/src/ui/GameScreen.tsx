import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Action,
  CardId,
  CompletedTrick,
  DealerDraw,
  GameState,
  bidOptions,
  buildRules,
  createGame,
  applyAction,
  canAskJoker,
  catchOptions,
  playableCards,
  rankOf,
  teamOf,
} from '../engine';
import { chooseBotCatch } from '../bots';
import { decideAsync } from '../bots/async';
import { Card } from './Card';
import { Hand } from './Hand';
import { BawnPanel, BidPanel, CatchModal, GameOverModal, HandResultModal, ReviewPanel, ScorePad, SuitIcon, TrumpPicker, bidLabel, catchMessage } from './panels';
import { SEAT_NAMES, SEAT_POS, SeatNamesContext, ar, trickOffset } from './layout';
import type { OnlineState } from '../net/online';
import { SPEED_MS, Settings, saveGame } from './settings';
import { setSoundEnabled, sfx } from './sound';

const HUMAN = 0;
/** first-dealer draw animation timing (the online server waits about as long) */
const DRAW_ROUND_MS = 1300;
const DRAW_RESULT_MS = 1400;

/** The first-dealer draw: each player's face-up card; ties draw again; the lowest card deals. */
function DealerDrawView({ draw, step, mode, names }: { draw: DealerDraw; step: number; mode: GameState['mode']; names: string[] }) {
  const done = step >= draw.rounds.length;
  const cur = Math.min(step, draw.rounds.length - 1);
  const round = draw.rounds[cur];
  const low = Math.min(...round.map((d) => rankOf(d.card)!));
  return (
    <div className="dealer-draw">
      <div className="draw-caption">
        {done ? `الخبّاص: ${names[draw.dealer]}` : cur === 0 ? 'سحب الخبّاص — أصغر ورقة تخبّص' : 'تعادل! المتعادلين يسحبون مرة ثانية'}
      </div>
      {round.map((d) => {
        const off = trickOffset(mode, d.player);
        const from = SEAT_POS[mode][d.player];
        const lowest = rankOf(d.card) === low;
        return (
          <div
            key={`${cur}-${d.player}`}
            className={`trick-card draw-card ${done && d.player === draw.dealer ? 'win' : ''} ${!done && lowest && cur < draw.rounds.length - 1 ? 'tie' : ''} ${done && d.player !== draw.dealer ? 'dim' : ''}`}
            style={{ left: `calc(50% + ${off.dx}px)`, top: `calc(48% + ${off.dy}px)`, ['--fx' as any]: `${from.x}%`, ['--fy' as any]: `${from.y}%` }}
          >
            <Card id={d.card} />
          </div>
        );
      })}
    </div>
  );
}

export function newGame(s: Settings): GameState {
  return createGame(buildRules(s.preset), s.mode, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
}

/** An online table: the server owns the game; we only show its view and send actions. */
export interface OnlineTable {
  state: OnlineState & { game: GameState };
  send: (a: Action) => void;
  leave: () => void;
}

interface Props {
  settings: Settings;
  /** local game against bots */
  initial?: GameState;
  /** or an online table */
  online?: OnlineTable;
  onExit: () => void;
  onToggleSound: () => void;
}

type Collect = { trick: CompletedTrick; stage: 'show' | 'fly' };

export function GameScreen({ settings, initial, online, onExit, onToggleSound }: Props) {
  const [localGame, setGame] = useState<GameState>(() => (online ? online.state.game : initial!));
  const game = online ? online.state.game : localGame;
  const gameRef = useRef(game);
  gameRef.current = game;
  const prevRef = useRef<GameState | null>(null);
  const [collecting, setCollecting] = useState<Collect | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [catchOpen, setCatchOpen] = useState(false);
  const [dealing, setDealing] = useState(true);
  const speed = SPEED_MS[settings.speed];
  const n = game.numPlayers;
  const names = online ? online.state.view!.names : SEAT_NAMES[game.mode];

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  useEffect(() => {
    if (!online) saveGame(game.phase === 'gameOver' ? null : game);
  }, [game, online]);

  // the first-dealer card draw, shown once at the start of a game (step = round shown; = rounds.length → result)
  const draw = game.dealerDraw ?? null;
  const [drawStep, setDrawStep] = useState<number | null>(() =>
    draw && game.handNumber === 1 && game.phase === 'bidding' && game.bids.length === 0 ? 0 : null,
  );
  useEffect(() => {
    if (drawStep === null || !draw) return;
    if (drawStep === 0) for (let i = 0; i < draw.rounds[0].length; i++) setTimeout(() => sfx.deal(), i * 120);
    const t = setTimeout(() => setDrawStep((st) => (st === null || st >= draw.rounds.length ? null : st + 1)), drawStep < draw.rounds.length ? DRAW_ROUND_MS : DRAW_RESULT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawStep]);
  const drawing = drawStep !== null && !!draw;

  // deal animation at the start of each hand (after the dealer draw)
  const dealKey = `${game.handNumber}-${game.redeals}${drawing ? '-draw' : ''}`;
  useEffect(() => {
    if (drawing) return;
    setDealing(true);
    const cards = game.rules.modes[game.mode].handSize;
    for (let i = 0; i < cards; i++) setTimeout(() => sfx.deal(), i * speed.deal);
    const t = setTimeout(() => setDealing(false), cards * speed.deal + 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  const showToast = useCallback((msg: string, ms = 1800) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  /** Local: apply with the engine. Online: send to the server (it answers with the new view). */
  const act = useCallback(
    (a: Action) => {
      if (online) {
        online.send(a);
        return;
      }
      try {
        const next = applyAction(gameRef.current, a);
        gameRef.current = next;
        setGame(next);
      } catch (e) {
        console.warn(e);
      }
    },
    [online],
  );

  // sounds, messages and the trick animation follow the state, whoever changed it (us, a bot or the server)
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = game;
    if (!prev || prev.handNumber !== game.handNumber) return;
    if (game.playedCards.length > prev.playedCards.length) sfx.card();
    if (game.tricksPlayed > prev.tricksPlayed && game.lastTrick) setCollecting({ trick: game.lastTrick, stage: 'show' });
    if (game.bids.length > prev.bids.length) {
      sfx.bid();
      const entry = game.bids[game.bids.length - 1];
      if (entry.jokerAsk) {
        const ans = entry.jokerAsk;
        showToast(
          `${names[entry.player]}: عندك الجوكر الثاني؟ — ${ans.answer ? `${names[ans.holder!]}: عندي ✓` : 'ما عندي ✗'} ← ${bidLabel(game.rules, entry.value!)}`,
          3200,
        );
      }
    }
    const c = game.contract;
    if (c?.trump && !prev.contract?.trump) {
      showToast(`${names[c.bidder]}: ${c.forced ? 'ملزوم' : bidLabel(game.rules, c.value)} — الحكم ${'♠♥♦♣'['SHDC'.indexOf(c.trump)]}`);
    }
    if (c && typeof c.bawn === 'boolean' && (prev.contract?.bawn ?? null) === null) {
      sfx.bid();
      showToast(`${names[c.bidder]}: ${c.bawn ? 'باون! 🔥' : 'بدون باون'}`, 2200);
    }
    const lc = game.lastCatch;
    if (lc && JSON.stringify(lc) !== JSON.stringify(prev.lastCatch)) {
      if (lc.success) sfx.collect();
      showToast(`${lc.success ? 'أكاشف! ' : ''}${catchMessage(game, lc, lc.success ? game.lastResult?.points : undefined, names)}`, 3200);
    }
    if (game.phase === 'gameOver' && prev.phase !== 'gameOver') {
      setTimeout(() => (game.winner === 0 ? sfx.win() : sfx.lose()), speed.hold + 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // trick collection animation
  useEffect(() => {
    if (!collecting) return;
    if (collecting.stage === 'show') {
      const t = setTimeout(() => setCollecting((c) => (c ? { ...c, stage: 'fly' } : c)), speed.hold);
      return () => clearTimeout(t);
    }
    sfx.collect();
    const t = setTimeout(() => setCollecting(null), 420);
    return () => clearTimeout(t);
  }, [collecting, speed.hold]);

  // bots
  const busy = collecting !== null || dealing || drawing;
  const humanCanCatch = game.phase === 'review' && catchOptions(game, HUMAN).length > 0;
  useEffect(() => {
    if (busy) return;
    if (online) {
      if (game.currentPlayer === HUMAN && ['bidding', 'choosingTrump', 'playing', 'bawnAsk'].includes(game.phase)) sfx.turn();
      return; // the server runs the bots
    }
    // أكاشف: any bot that has seen evidence against an opponent may call it (never peeking)
    if (game.phase === 'playing' || game.phase === 'review' || game.phase === 'bawnAsk') {
      for (let seat = 0; seat < game.numPlayers; seat++) {
        if (seat === HUMAN) continue;
        const c = chooseBotCatch(game, seat, settings.difficulty);
        if (c) {
          const t = setTimeout(() => act(c), speed.bot);
          return () => clearTimeout(t);
        }
      }
    }
    if (game.phase === 'review') {
      // nothing left for the bots to catch: wait for the human only if they could catch someone
      if (humanCanCatch) return;
      const t = setTimeout(() => act({ type: 'END_REVIEW' }), speed.bot);
      return () => clearTimeout(t);
    }
    if (!['bidding', 'choosingTrump', 'playing', 'bawnAsk'].includes(game.phase)) return;
    if (game.currentPlayer === HUMAN) {
      sfx.turn();
      return;
    }
    // the bot starts thinking at once (in a background thread) and moves after its "thinking" pause
    let cancelled = false;
    const decision = decideAsync(game, settings.difficulty);
    const t = setTimeout(() => {
      decision.then((a) => {
        if (!cancelled && gameRef.current === game) act(a);
      });
    }, speed.bot);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [game, busy, act, settings.difficulty, speed.bot, humanCanCatch, online]);

  const myTurn = !busy && game.currentPlayer === HUMAN;
  const legal = useMemo<CardId[] | null>(
    () => (myTurn && game.phase === 'playing' ? playableCards(game, HUMAN) : null),
    [game, myTurn],
  );

  const restart = () => {
    if (online) return onExit();
    const g = newGame(settings);
    gameRef.current = g;
    setCollecting(null);
    setGame(g);
  };

  const trickPlays = collecting ? collecting.trick.plays : game.trick.plays;
  const c = game.contract;
  const showResult = !collecting && game.phase === 'handOver';
  const showGameOver = !collecting && game.phase === 'gameOver';

  // last bid of each seat during this hand's bidding
  const seatBid = (seat: number) => {
    const b = [...game.bids].reverse().find((x) => x.player === seat);
    if (!b) return null;
    return b.value === null ? 'طاف' : b.forced ? 'ملزوم' : `${bidLabel(game.rules, b.value)}${b.jokerAsk ? ' 🃏' : ''}`;
  };
  // the answer to "عندك الجوكر الثاني؟", shown under the partner(s) for the whole hand
  const askTag = (seat: number): { text: string; yes: boolean } | null => {
    for (const b of game.bids) {
      if (!b.jokerAsk || b.player === seat || teamOf(game, b.player) !== teamOf(game, seat)) continue;
      if (b.jokerAsk.answer) return b.jokerAsk.holder === seat ? { text: '🃏 عندي', yes: true } : null;
      return { text: 'ما عندي 🃏', yes: false };
    }
    return null;
  };

  // online: the server's turn clock (whose turn and how long is left), bots and connection status
  const view = online?.state.view ?? null;
  const clock = view?.deadline ? { seat: view.deadline.seat, ms: Math.max(0, view.deadline.ms - (Date.now() - online!.state.receivedAt)), key: online!.state.receivedAt } : null;
  const clockBar = (seat: number) =>
    clock && clock.seat === seat && clock.ms > 0 ? <div key={clock.key} className="turn-clock" style={{ animationDuration: `${clock.ms}ms` }} /> : null;

  return (
    <SeatNamesContext.Provider value={online ? names : null}>
    <div className="game">
      {online && !online.state.connected && <div className="net-banner">انقطع الاتصال… نحاول نرجعك لنفس الكرسي</div>}
      {online?.state.outdated && <div className="net-banner warn">في تحديث جديد للعبة — حدّث الصفحة</div>}
      {/* ---------- HUD ---------- */}
      <header className="hud">
        <div className="hud-score us">
          <span>لنا</span>
          <b>{ar(game.scores[0])}</b>
        </div>
        <div className="hud-center">
          {c && c.trump ? (
            <div className="contract">
              <SuitIcon suit={c.trump} />
              <span className="contract-bid">{c.forced ? 'ملزوم' : bidLabel(game.rules, c.value)}</span>
              {c.bawn && <span className="bawn-badge">باون</span>}
              <span className={`contract-who ${c.team === 0 ? 'us-txt' : 'them-txt'}`}>{names[c.bidder]}</span>
            </div>
          ) : (
            <div className="contract muted">{game.phase === 'choosingTrump' ? 'يختار الحكم…' : `اليد ${ar(game.handNumber)} — مزايدة`}</div>
          )}
          {c && c.trump && (
            <div className="tricks">
              <span className="us-txt">لنا {ar(game.tricksWon[0])}</span>
              <span className="tricks-need">
                {ar(game.tricksWon[c.team])}/{ar(c.value)}
              </span>
              <span className="them-txt">لهم {ar(game.tricksWon[1])}</span>
            </div>
          )}
        </div>
        <div className="hud-score them">
          <span>لهم</span>
          <b>{ar(game.scores[1])}</b>
        </div>
      </header>
      <div className="toolbar">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="القائمة">
          ☰
        </button>
        <div className="toolbar-mid">
          <button className="chip-btn" onClick={() => setPadOpen(true)}>
            📜 النشرة
          </button>
          {game.rules.renege.allowRenege && (
            <button
              className="chip-btn catch-btn"
              disabled={!(game.phase === 'playing' || game.phase === 'review') || (game.tricks.length === 0 && game.trick.plays.length === 0)}
              onClick={() => setCatchOpen(true)}
            >
              أكاشف
            </button>
          )}
        </div>
        <button className="icon-btn" onClick={onToggleSound} aria-label="الصوت">
          {settings.sound ? '🔊' : '🔇'}
        </button>
      </div>

      {/* ---------- TABLE ---------- */}
      <main className={`table ${game.mode}`}>
        <div className="felt" />
        {Array.from({ length: n }, (_, seat) => {
          const p = SEAT_POS[game.mode][seat];
          const isTurn = !busy && game.currentPlayer === seat && ['bidding', 'choosingTrump', 'playing', 'bawnAsk'].includes(game.phase);
          const ask = askTag(seat);
          const bid = game.phase === 'bidding' || game.phase === 'choosingTrump' ? seatBid(seat) : null;
          const team = teamOf(game, seat);
          return (
            <div key={seat} className={`seat ${team === 0 ? 'us' : 'them'} ${isTurn ? 'turn' : ''} ${seat === HUMAN ? 'me' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              {seat !== HUMAN && !drawing && (
                <div className="mini-hand">
                  {game.hands[seat].slice(0, 9).map((_, i) => (
                    <Card key={`${dealKey}-${i}`} faceDown className="mini" style={{ ['--i' as any]: i, ['--deal-delay' as any]: `${i * speed.deal}ms` }} />
                  ))}
                </div>
              )}
              <div className="avatar">
                <span>{seat === HUMAN ? '★' : names[seat][0]}</span>
                {game.dealer === seat && !drawing && <i className="dealer-badge" title="الخبّاص (الموزع)">خبّاص</i>}
                {c && c.bidder === seat && c.trump && <i className="bidder-badge"><SuitIcon suit={c.trump} /></i>}
              </div>
              <div className="seat-name">
                {names[seat]}
                {view?.bots[seat] && seat !== HUMAN && <i className="seat-flag">🤖</i>}
                {view && !view.online[seat] && <i className="seat-flag">📵</i>}
              </div>
              {clockBar(seat)}
              {bid && <div className={`bubble ${bid === 'طاف' ? 'pass' : ''}`}>{bid}</div>}
              {ask && <div className={`ask-tag ${ask.yes ? '' : 'no'}`}>{ask.text}</div>}
              {isTurn && seat !== HUMAN && <div className="thinking">•••</div>}
            </div>
          );
        })}

        {/* trick */}
        <div className="trick">
          {trickPlays.map((pl) => {
            const off = trickOffset(game.mode, pl.player);
            const from = SEAT_POS[game.mode][pl.player];
            const fly = collecting?.stage === 'fly' ? SEAT_POS[game.mode][collecting.trick.winner] : null;
            const isWinner = collecting && collecting.trick.winner === pl.player;
            return (
              <div
                key={`${pl.player}-${pl.card}`}
                className={`trick-card ${fly ? 'fly' : ''} ${pl.cancelled ? 'void' : ''} ${isWinner && collecting?.stage === 'show' ? 'win' : ''}`}
                style={{
                  left: fly ? `${fly.x}%` : `calc(50% + ${off.dx}px)`,
                  top: fly ? `${fly.y}%` : `calc(48% + ${off.dy}px)`,
                  ['--fx' as any]: `${from.x}%`,
                  ['--fy' as any]: `${from.y}%`,
                }}
              >
                <Card id={pl.card} />
                {pl.cancelled && <span className="void-tag">ملغي</span>}
              </div>
            );
          })}
        </div>
        {drawing && draw && <DealerDrawView draw={draw} step={drawStep!} mode={game.mode} names={names} />}
        {toast && <div className={`toast ${toast.length > 24 ? 'wide' : ''}`}>{toast}</div>}
      </main>

      {/* ---------- MY AREA ---------- */}
      <section className="my-area">
        {myTurn && game.phase === 'bidding' && (
          <BidPanel
            rules={game.rules}
            opts={bidOptions(game, HUMAN)}
            highBid={game.highBid?.value ?? null}
            onBid={(v) => act({ type: 'BID', player: HUMAN, value: v })}
            onPass={() => act({ type: 'PASS', player: HUMAN })}
            canAsk={canAskJoker(game, HUMAN)}
            onAsk={() => act({ type: 'JOKER_ASK', player: HUMAN })}
          />
        )}
        {myTurn && game.phase === 'bawnAsk' && <BawnPanel rules={game.rules} onAnswer={(accept) => act({ type: 'BAWN', player: HUMAN, accept })} />}
        {myTurn && game.phase === 'choosingTrump' && <TrumpPicker onPick={(s) => act({ type: 'CHOOSE_TRUMP', player: HUMAN, suit: s })} />}
        {myTurn && game.phase === 'playing' && <div className="your-turn">دورك — اضغط الورقة مرتين للعب</div>}
        {online && clock && clock.seat === HUMAN && <div className="my-clock">{clockBar(HUMAN)}</div>}
        {!busy && humanCanCatch && <ReviewPanel onCatch={() => setCatchOpen(true)} onDone={() => act({ type: 'END_REVIEW' })} />}
        <Hand
          cards={drawing ? [] : game.hands[HUMAN]}
          trump={c?.trump ?? null}
          legal={legal}
          onPlay={(card) => act({ type: 'PLAY', player: HUMAN, card })}
          dealKey={dealKey}
          dealMs={speed.deal}
        />
      </section>

      {padOpen && <ScorePad game={game} onClose={() => setPadOpen(false)} />}
      {catchOpen && (game.phase === 'playing' || game.phase === 'review' || game.phase === 'bawnAsk') && (
        <CatchModal
          game={game}
          me={HUMAN}
          onClose={() => setCatchOpen(false)}
          onCatch={(accused, trick) => {
            setCatchOpen(false);
            act({ type: 'CATCH', player: HUMAN, accused, trick });
          }}
        />
      )}
      {showResult && !padOpen && <HandResultModal game={game} onPad={() => setPadOpen(true)} onNext={() => act({ type: 'NEXT_HAND' })} />}
      {showGameOver && !padOpen && <GameOverModal game={game} onPad={() => setPadOpen(true)} onAgain={restart} onHome={onExit} />}
      {menuOpen && online && (
        <div className="modal-back" onClick={() => setMenuOpen(false)}>
          <div className="modal menu" onClick={(e) => e.stopPropagation()}>
            <h2>القائمة</h2>
            {view?.code && <p className="muted small center">كود الطاولة: <b className="code">{view.code}</b></p>}
            <button className="btn primary" onClick={() => setMenuOpen(false)}>
              متابعة اللعب
            </button>
            <button className="btn ghost" onClick={() => online.leave()}>
              مغادرة الطاولة (بوت يكمّل عنك)
            </button>
          </div>
        </div>
      )}
      {menuOpen && !online && (
        <div className="modal-back" onClick={() => setMenuOpen(false)}>
          <div className="modal menu" onClick={(e) => e.stopPropagation()}>
            <h2>القائمة</h2>
            <button className="btn primary" onClick={() => setMenuOpen(false)}>
              متابعة اللعب
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setMenuOpen(false);
                restart();
              }}
            >
              لعبة جديدة
            </button>
            <button className="btn ghost" onClick={onExit}>
              الرئيسية (تُحفظ اللعبة)
            </button>
          </div>
        </div>
      )}
    </div>
    </SeatNamesContext.Provider>
  );
}
