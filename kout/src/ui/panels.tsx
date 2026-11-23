import { BidOptions, CatchResult, CompletedTrick, GameState, HandResult, RulesConfig, SUIT_NAME_AR, SUIT_SYMBOL, Suit, Trick, isRedSuit, teamOf } from '../engine';
import { useState } from 'react';
import { Card } from './Card';
import { SEAT_NAMES, ar, useSeatNames } from './layout';

export function bidLabel(rules: RulesConfig, value: number, forced = false): string {
  if (forced) return 'ملزوم';
  const name = rules.bidding.names[value];
  return name && name !== ar(value) ? `${name}` : ar(value);
}

export function SuitIcon({ suit }: { suit: Suit }) {
  return <span className={`suit-ic ${isRedSuit(suit) ? 'red' : 'black'}`}>{SUIT_SYMBOL[suit]}</span>;
}

/** Bid buttons to show: the voluntary bids, plus the Malzoom bid only when the dealer is forced. */
export function bidButtons(rules: RulesConfig, forced: boolean): number[] {
  const b = rules.bidding;
  const voluntary = b.values.filter((v) => v >= b.minVoluntaryBid);
  return forced && !voluntary.includes(b.malzoomBid) ? [b.malzoomBid, ...voluntary] : voluntary;
}

export function BidPanel({ rules, opts, highBid, onBid, onPass, canAsk = false, onAsk }: {
  rules: RulesConfig;
  opts: BidOptions;
  highBid: number | null;
  onBid: (v: number) => void;
  onPass: () => void;
  /** show the "عندك الجوكر الثاني؟" button (exactly one joker, forced bids still legal) */
  canAsk?: boolean;
  onAsk?: () => void;
}) {
  return (
    <div className="panel bid-panel">
      <div className="panel-title">
        {opts.forced ? 'الكل طاف — أنت ملزوم' : highBid ? `أعلى طلب: ${ar(highBid)} — زايد أو طاف` : 'دورك — زايد أو طاف'}
      </div>
      <div className="bid-row">
        {!opts.forced && (
          <button className="bid-btn pass" disabled={!opts.canPass} onClick={onPass}>
            <span className="bid-num">طاف</span>
            <span className="bid-name">{'\u00a0'}</span>
          </button>
        )}
        {bidButtons(rules, opts.forced).map((v) => {
          const ok = opts.values.includes(v);
          const isForced = opts.forced && v === rules.bidding.malzoomBid;
          return (
            <button key={v} className={`bid-btn ${v === rules.bidding.larens ? 'larens' : ''}`} disabled={!ok} onClick={() => onBid(v)}>
              <span className="bid-num">{ar(v)}</span>
              <span className="bid-name">{isForced ? 'ملزوم' : rules.bidding.names[v] !== ar(v) ? rules.bidding.names[v] : '\u00a0'}</span>
            </button>
          );
        })}
      </div>
      {canAsk && (
        <button className="ask-btn" onClick={onAsk}>
          🃏 عندك الجوكر الثاني؟
          <small>
            إذا عنده: {bidLabel(rules, rules.jokerAsk.jokerAskYesBid)} · إذا لا: {bidLabel(rules, rules.jokerAsk.jokerAskNoBid)}
          </small>
        </button>
      )}
    </div>
  );
}

/** "تبي باون؟" — the bidder's choice once the bid-7 team has 6 tricks. */
export function BawnPanel({ rules, onAnswer }: { rules: RulesConfig; onAnswer: (accept: boolean) => void }) {
  const b = rules.bawn;
  return (
    <div className="panel bawn-panel">
      <div className="panel-title">تبي باون؟</div>
      <p className="muted small center">
        لازم تاخذون كل الأكلات الباقية: +{ar(b.bawnWinPoints)} لكم · وإذا انكسر: +{ar(b.bawnFailPoints)} لهم
      </p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => onAnswer(false)}>
          لا
        </button>
        <button className="btn primary" onClick={() => onAnswer(true)}>
          نعم، باون
        </button>
      </div>
    </div>
  );
}

export function TrumpPicker({ onPick }: { onPick: (s: Suit) => void }) {
  return (
    <div className="panel trump-panel">
      <div className="panel-title">اختر الحكم</div>
      <div className="trump-row">
        {(['S', 'H', 'C', 'D'] as Suit[]).map((s) => (
          <button key={s} className={`trump-btn ${isRedSuit(s) ? 'red' : 'black'}`} onClick={() => onPick(s)}>
            <span className="trump-sym">{SUIT_SYMBOL[s]}</span>
            <span className="trump-name">{SUIT_NAME_AR[s]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScorePad({ game, onClose }: { game: GameState; onClose: () => void }) {
  const names = useSeatNames(game.mode);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal scorepad" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>النشرة</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="pad-totals">
          <div className="pad-team us">
            <span>لنا</span>
            <b>{ar(game.scores[0])}</b>
          </div>
          <div className="pad-target">الهدف {ar(game.rules.gameEnd.targetScore)}</div>
          <div className="pad-team them">
            <span>لهم</span>
            <b>{ar(game.scores[1])}</b>
          </div>
        </div>
        {game.history.length === 0 ? (
          <p className="muted center">ما في أيادي للحين</p>
        ) : (
          <div className="pad-scroll">
            <table className="pad-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الخبّاص</th>
                  <th>المزايد</th>
                  <th>الطلب</th>
                  <th>أكلات</th>
                  <th>لنا</th>
                  <th>لهم</th>
                </tr>
              </thead>
              <tbody>
                {game.history.map((h: HandResult) => (
                  <tr key={h.handNumber} className={h.made ? 'made' : 'failed'}>
                    <td>{ar(h.handNumber)}</td>
                    <td className="dealer-cell">{names[h.dealer]}</td>
                    <td className={h.team === 0 ? 'us-txt' : 'them-txt'}>{names[h.bidder]}</td>
                    <td>
                      {h.forced ? 'ملزوم' : bidLabel(game.rules, h.bid)} <SuitIcon suit={h.trump} />
                    </td>
                    <td>
                      {h.caught ? (
                        <span className="caught-tag">صيد</span>
                      ) : h.larensWin ? (
                        <span className="bawn-tag">قيم</span>
                      ) : h.bawn ? (
                        <span className="bawn-tag">باون {h.made ? '✓' : '✗'}</span>
                      ) : (
                        <>
                          {ar(h.tricks[h.team])}/{ar(h.bid)} {h.made ? '✓' : '✗'}
                        </>
                      )}
                    </td>
                    <td>
                      {h.points[0] ? <span className="plus">+{ar(h.points[0])}</span> : null}
                      <div className="run">{ar(h.totals[0])}</div>
                    </td>
                    <td>
                      {h.points[1] ? <span className="plus">+{ar(h.points[1])}</span> : null}
                      <div className="run">{ar(h.totals[1])}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function HandResultModal({ game, onNext, onPad }: { game: GameState; onNext: () => void; onPad: () => void }) {
  const r = game.lastResult!;
  const names = useSeatNames(game.mode);
  const ours = r.team === 0;
  const good = r.caught ? r.points[0] > 0 : ours === r.made;
  const caughtUs = r.caught ? teamOf(game, r.caught.accused) === 0 : false;
  return (
    <div className="modal-back">
      <div className={`modal result ${good ? 'good' : 'bad'}`}>
        <div className="result-badge">{r.caught ? '🎯' : r.made ? '✓' : '✗'}</div>
        <h2>{r.caught ? (caughtUs ? 'انصدنا!' : 'صدناهم!') : r.made ? (ours ? 'جبنا الطلب!' : 'جابوا الطلب') : ours ? 'انكسر طلبنا' : 'كسرناهم!'}</h2>
        {r.caught && <p className="catch-line">{catchMessage(game, r.caught, r.points, names)}</p>}
        {!r.caught && r.bawn && <p className="catch-line">{r.made ? `باون! أخذوا كل الأكلات بعد الإعلان: +${ar(r.points[r.team])}` : `انكسر الباون: +${ar(r.points[1 - r.team])} للخصم`}</p>}
        <p className="result-line">
          {names[r.bidder]} — {r.forced ? 'ملزوم' : `طلب ${bidLabel(game.rules, r.bid)}`} · الحكم <SuitIcon suit={r.trump} />
        </p>
        <div className="result-grid">
          <div>
            <span className="muted">أكلات لنا</span>
            <b>{ar(r.tricks[0])}</b>
          </div>
          <div>
            <span className="muted">أكلات لهم</span>
            <b>{ar(r.tricks[1])}</b>
          </div>
          <div>
            <span className="muted">النقاط</span>
            <b className={r.points[0] ? 'us-txt' : 'them-txt'}>+{ar(r.points[0] || r.points[1])} {r.points[0] ? 'لنا' : 'لهم'}</b>
          </div>
        </div>
        {r.endedEarly && !r.caught && <p className="muted small">انتهت اليد مبكراً — النتيجة محسومة</p>}
        <div className="score-big">
          <span className="us-txt">لنا {ar(game.scores[0])}</span>
          <span className="sep">—</span>
          <span className="them-txt">لهم {ar(game.scores[1])}</span>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onPad}>
            النشرة
          </button>
          <button className="btn primary" onClick={onNext} autoFocus>
            اليد التالية
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverModal({ game, onAgain, onHome, onPad }: { game: GameState; onAgain: () => void; onHome: () => void; onPad: () => void }) {
  const won = game.winner === 0;
  const r = game.lastResult;
  const larensWin = !!r?.larensWin;
  const names = useSeatNames(game.mode);
  const shut = game.scores[0] === 0 || game.scores[1] === 0;
  return (
    <div className="modal-back">
      <div className={`modal result ${won ? 'good' : 'bad'}`}>
        <div className="result-badge big">{won ? '🏆' : '☕'}</div>
        <h2>{won ? 'مبروك! فزتوا' : 'خسرتوا هالمرة'}</h2>
        <p className="result-line">
          {larensWin ? `لارنس! ${names[r!.bidder]} أخذ كل الأكلات — قيم` : shut ? 'فوز بدون ما يسجل الخصم' : 'وصلوا للهدف'}
        </p>
        <div className="score-big">
          <span className="us-txt">لنا {ar(game.scores[0])}</span>
          <span className="sep">—</span>
          <span className="them-txt">لهم {ar(game.scores[1])}</span>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onPad}>
            النشرة
          </button>
          <button className="btn ghost" onClick={onHome}>
            الرئيسية
          </button>
          <button className="btn primary" onClick={onAgain}>
            لعبة جديدة
          </button>
        </div>
      </div>
    </div>
  );
}

/** "خليفة قطع في الأكلة ٣ (ما لحق الهاس) — صاده محمد: +١٢ لنا" */
export function catchMessage(game: GameState, c: CatchResult, points?: [number, number], names: string[] = SEAT_NAMES[game.mode]): string {
  if (!c.success) return `${names[c.catcher]} صاد غلط على ${names[c.accused]} — ما في شي`;
  const suit = c.suit ? ` (ما لحق ${SUIT_NAME_AR[c.suit]})` : '';
  let pts = '';
  if (points) {
    const team = points[0] > 0 ? 0 : 1;
    pts = `: +${ar(points[team])} ${team === 0 ? 'لنا' : 'لهم'}`;
  }
  return `${names[c.accused]} قطع في الأكلة ${ar(c.trick + 1)}${suit} — صاده ${names[c.catcher]}${pts}`;
}

/** The human's صيد picker: choose an opponent, then the trick where they reneged. */
export function CatchModal({ game, me, onCatch, onClose }: { game: GameState; me: number; onCatch: (accused: number, trick: number) => void; onClose: () => void }) {
  const names = useSeatNames(game.mode);
  const myTeam = teamOf(game, me);
  const opponents = Array.from({ length: game.numPlayers }, (_, i) => i).filter((i) => teamOf(game, i) !== myTeam);
  const [accused, setAccused] = useState<number | null>(null);
  const tricks: (Trick | CompletedTrick)[] = [...game.tricks, ...(game.trick.plays.length ? [game.trick] : [])];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal catch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>صيد</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <p className="muted small center">{accused === null ? 'منو قطع؟' : `وين قطع ${names[accused]}؟ اختر الأكلة`}</p>
        {accused === null ? (
          <div className="catch-list">
            {opponents.map((p) => (
              <button key={p} className="preset" onClick={() => setAccused(p)}>
                <b>{names[p]}</b>
              </button>
            ))}
          </div>
        ) : (
          <div className="catch-list">
            {tricks.map((t, i) => {
              const mine = t.plays.find((x) => x.player === accused);
              if (!mine) return null;
              return (
                <button key={i} className="preset catch-trick" onClick={() => onCatch(accused, i)}>
                  <b>الأكلة {ar(i + 1)}</b>
                  <span className="catch-cards">
                    {t.ledSuit ? (
                      <>
                        النقش <SuitIcon suit={t.ledSuit} /> ·
                      </>
                    ) : null}
                    لعب <Card id={mine.card} className="mini-face" />
                  </span>
                </button>
              );
            })}
            <button className="btn ghost" onClick={() => setAccused(null)}>
              رجوع
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** End-of-hand review: the human may still call صيد before the hand is scored. */
export function ReviewPanel({ onCatch, onDone }: { onCatch: () => void; onDone: () => void }) {
  return (
    <div className="panel review-panel">
      <div className="panel-title">انتهت الأوراق — تبي تصيد قبل الحساب؟</div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCatch}>
          🎯 صيد
        </button>
        <button className="btn primary" onClick={onDone}>
          متابعة
        </button>
      </div>
    </div>
  );
}
