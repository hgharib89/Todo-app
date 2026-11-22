import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Action,
  CardId,
  CompletedTrick,
  GameState,
  bidOptions,
  buildRules,
  createGame,
  applyAction,
  canAskJoker,
  catchOptions,
  playableCards,
  teamOf,
} from '../engine';
import { chooseBotAction, chooseBotCatch } from '../bots';
import { Card } from './Card';
import { Hand } from './Hand';
import { BawnPanel, BidPanel, CatchModal, GameOverModal, HandResultModal, ReviewPanel, ScorePad, SuitIcon, TrumpPicker, bidLabel, catchMessage } from './panels';
import { SEAT_NAMES, SEAT_POS, ar, trickOffset } from './layout';
import { SPEED_MS, Settings, saveGame } from './settings';
import { setSoundEnabled, sfx } from './sound';

const HUMAN = 0;

export function newGame(s: Settings): GameState {
  return createGame(buildRules(s.preset), s.mode, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
}

interface Props {
  settings: Settings;
  initial: GameState;
  onExit: () => void;
  onToggleSound: () => void;
}

type Collect = { trick: CompletedTrick; stage: 'show' | 'fly' };

export function GameScreen({ settings, initial, onExit, onToggleSound }: Props) {
  const [game, setGame] = useState<GameState>(initial);
  const gameRef = useRef(game);
  const [collecting, setCollecting] = useState<Collect | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [catchOpen, setCatchOpen] = useState(false);
  const [dealing, setDealing] = useState(true);
  const speed = SPEED_MS[settings.speed];
  const n = game.numPlayers;
  const names = SEAT_NAMES[game.mode];

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  useEffect(() => {
    saveGame(game.phase === 'gameOver' ? null : game);
  }, [game]);

  // deal animation at the start of each hand
  const dealKey = `${game.handNumber}-${game.redeals}`;
  useEffect(() => {
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

  const act = useCallback(
    (a: Action) => {
      const prev = gameRef.current;
      let next: GameState;
      try {
        next = applyAction(prev, a);
      } catch (e) {
        console.warn(e);
        return;
      }
      if (a.type === 'PLAY') {
        sfx.card();
        if (next.lastTrick !== prev.lastTrick && next.lastTrick) setCollecting({ trick: next.lastTrick, stage: 'show' });
      } else if (a.type === 'BID' || a.type === 'PASS') {
        sfx.bid();
      } else if (a.type === 'JOKER_ASK') {
        sfx.bid();
        const entry = next.bids[next.bids.length - 1];
        const ans = entry.jokerAsk!;
        showToast(
          `${names[a.player]}: عندك الجوكر الثاني؟ — ${ans.answer ? `${names[ans.holder!]}: عندي ✓` : 'ما عندي ✗'} ← ${bidLabel(next.rules, entry.value!)}`,
          3200,
        );
      } else if (a.type === 'BAWN') {
        sfx.bid();
        showToast(`${names[a.player]}: ${a.accept ? 'باون! 🔥' : 'بدون باون'}`, 2200);
      } else if (a.type === 'CATCH' && next.lastCatch) {
        const c = next.lastCatch;
        if (c.success) sfx.collect();
        showToast(`${c.success ? '🎯 صيد! ' : ''}${catchMessage(next, c, c.success ? next.lastResult?.points : undefined)}`, 3200);
      } else if (a.type === 'CHOOSE_TRUMP' && next.contract) {
        const c = next.contract;
        showToast(`${names[c.bidder]}: ${c.forced ? 'ملزوم' : bidLabel(next.rules, c.value)} — الحكم ${'♠♥♦♣'['SHDC'.indexOf(a.suit)]}`);
      }
      if (next.phase === 'gameOver' && prev.phase !== 'gameOver') {
        setTimeout(() => (next.winner === 0 ? sfx.win() : sfx.lose()), speed.hold + 500);
      }
      gameRef.current = next;
      setGame(next);
    },
    [names, showToast, speed.hold],
  );

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
  const busy = collecting !== null || dealing;
  const humanCanCatch = game.phase === 'review' && catchOptions(game, HUMAN).length > 0;
  useEffect(() => {
    if (busy) return;
    // صيد: any bot that has seen evidence against an opponent may call it (never peeking)
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
    const t = setTimeout(() => act(chooseBotAction(game, settings.difficulty)), speed.bot);
    return () => clearTimeout(t);
  }, [game, busy, act, settings.difficulty, speed.bot, humanCanCatch]);

  const myTurn = !busy && game.currentPlayer === HUMAN;
  const legal = useMemo<CardId[] | null>(
    () => (myTurn && game.phase === 'playing' ? playableCards(game, HUMAN) : null),
    [game, myTurn],
  );

  const restart = () => {
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

  return (
    <div className="game">
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
              🎯 صيد
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
              {seat !== HUMAN && (
                <div className="mini-hand">
                  {game.hands[seat].slice(0, 9).map((_, i) => (
                    <Card key={`${dealKey}-${i}`} faceDown className="mini" style={{ ['--i' as any]: i, ['--deal-delay' as any]: `${i * speed.deal}ms` }} />
                  ))}
                </div>
              )}
              <div className="avatar">
                <span>{seat === HUMAN ? '★' : names[seat][0]}</span>
                {game.dealer === seat && <i className="dealer-badge" title="الموزع">م</i>}
                {c && c.bidder === seat && c.trump && <i className="bidder-badge"><SuitIcon suit={c.trump} /></i>}
              </div>
              <div className="seat-name">{names[seat]}</div>
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
        {!busy && humanCanCatch && <ReviewPanel onCatch={() => setCatchOpen(true)} onDone={() => act({ type: 'END_REVIEW' })} />}
        <Hand
          cards={game.hands[HUMAN]}
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
      {menuOpen && (
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
  );
}
