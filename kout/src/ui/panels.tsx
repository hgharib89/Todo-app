import { BidOptions, GameState, HandResult, RulesConfig, SUIT_NAME_AR, SUIT_SYMBOL, Suit, isRedSuit } from '../engine';
import { SEAT_NAMES, ar } from './layout';

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

export function BidPanel({ rules, opts, highBid, onBid, onPass }: {
  rules: RulesConfig;
  opts: BidOptions;
  highBid: number | null;
  onBid: (v: number) => void;
  onPass: () => void;
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
            <button key={v} className={`bid-btn ${v === rules.bidding.bawan ? 'bawan' : ''}`} disabled={!ok} onClick={() => onBid(v)}>
              <span className="bid-num">{ar(v)}</span>
              <span className="bid-name">{isForced ? 'ملزوم' : rules.bidding.names[v] !== ar(v) ? rules.bidding.names[v] : '\u00a0'}</span>
            </button>
          );
        })}
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
  const names = SEAT_NAMES[game.mode];
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
                    <td className={h.team === 0 ? 'us-txt' : 'them-txt'}>{names[h.bidder]}</td>
                    <td>
                      {h.forced ? 'ملزوم' : bidLabel(game.rules, h.bid)} <SuitIcon suit={h.trump} />
                    </td>
                    <td>
                      {ar(h.tricks[h.team])}/{ar(h.bid)} {h.made ? '✓' : '✗'}
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
  const names = SEAT_NAMES[game.mode];
  const ours = r.team === 0;
  const good = ours === r.made;
  return (
    <div className="modal-back">
      <div className={`modal result ${good ? 'good' : 'bad'}`}>
        <div className="result-badge">{r.made ? '✓' : '✗'}</div>
        <h2>{r.made ? (ours ? 'جبنا الطلب!' : 'جابوا الطلب') : ours ? 'انكسر طلبنا' : 'كسرناهم!'}</h2>
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
        {r.endedEarly && <p className="muted small">انتهت اليد مبكراً — النتيجة محسومة</p>}
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
  const bawanWin = r && r.handNumber === 1 && r.made && r.bid === game.rules.bidding.bawan && game.rules.gameEnd.bawanFirstHandInstantWin;
  const shut = game.scores[0] === 0 || game.scores[1] === 0;
  return (
    <div className="modal-back">
      <div className={`modal result ${won ? 'good' : 'bad'}`}>
        <div className="result-badge big">{won ? '🏆' : '☕'}</div>
        <h2>{won ? 'مبروك! فزتوا' : 'خسرتوا هالمرة'}</h2>
        <p className="result-line">{bawanWin ? 'بوان من أول يد!' : shut ? 'فوز بدون ما يسجل الخصم' : 'وصلوا للهدف'}</p>
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
