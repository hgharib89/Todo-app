import type { CSSProperties } from 'react';
import { CardId, SUIT_SYMBOL, isRedSuit, parseCard, rankLabel } from '../engine';

const FACE_LETTER: Record<number, string> = { 11: 'و', 12: 'ب', 13: 'ش' };

interface Props {
  id?: CardId;
  faceDown?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export function Card({ id, faceDown, className = '', style, onClick, disabled, selected }: Props) {
  if (faceDown || !id) {
    return (
      <div className={`card back ${className}`} style={style} aria-hidden>
        <div className="back-inner">
          <span className="back-emblem">ك</span>
        </div>
      </div>
    );
  }
  const c = parseCard(id);
  const cls = ['card', 'face', className, disabled ? 'disabled' : '', selected ? 'selected' : '', onClick && !disabled ? 'clickable' : '']
    .filter(Boolean)
    .join(' ');

  if (c.joker) {
    const red = c.jokerColor === 'red';
    return (
      <div className={`${cls} joker ${red ? 'red' : 'black'}`} style={style} onClick={disabled ? undefined : onClick} role="button" aria-label={red ? 'الجوكر الأحمر' : 'الجوكر الأسود'}>
        <div className="corner tl">
          <span className="rk">★</span>
        </div>
        <div className="joker-center">
          <div className="joker-star">✦</div>
          <div className="joker-word">جوكر</div>
          <div className="joker-sub">{red ? 'كبير' : 'صغير'}</div>
        </div>
        <div className="corner br">
          <span className="rk">★</span>
        </div>
      </div>
    );
  }

  const suit = c.suit!;
  const rank = c.rank!;
  const sym = SUIT_SYMBOL[suit];
  const color = isRedSuit(suit) ? 'red' : 'black';
  const label = rankLabel(rank);
  let center;
  if (rank >= 11 && rank <= 13) {
    center = (
      <div className="court">
        <span className="court-letter">{FACE_LETTER[rank]}</span>
        <span className="court-suit">{sym}</span>
      </div>
    );
  } else if (rank === 14) {
    center = (
      <div className="ace">
        <span className="ace-star" />
        <span className="ace-suit">{sym}</span>
      </div>
    );
  } else {
    center = <div className="pip">{sym}</div>;
  }
  return (
    <div className={`${cls} ${color}`} style={style} onClick={disabled ? undefined : onClick} role="button" aria-label={`${label} ${sym}`}>
      <div className="corner tl">
        <span className="rk">{label}</span>
        <span className="st">{sym}</span>
      </div>
      {center}
      <div className="corner br">
        <span className="rk">{label}</span>
        <span className="st">{sym}</span>
      </div>
    </div>
  );
}
