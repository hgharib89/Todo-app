import { useEffect, useState } from 'react';
import { CardId, Suit, isJoker, rankOf, suitOf } from '../engine';
import { Card } from './Card';

/** Sort: jokers, then trump (if known), then suits alternating colours; high → low. */
export function sortHand(hand: CardId[], trump: Suit | null): CardId[] {
  const base: Suit[] = ['S', 'H', 'C', 'D'];
  const order: Suit[] = trump ? [trump, ...base.filter((s) => s !== trump)] : base;
  const key = (c: CardId) => {
    if (isJoker(c)) return c === 'XR' ? -2 : -1;
    return order.indexOf(suitOf(c)!) * 100 + (20 - rankOf(c)!);
  };
  return [...hand].sort((a, b) => key(a) - key(b));
}

interface Props {
  cards: CardId[];
  trump: Suit | null;
  legal: CardId[] | null; // null = not my turn to play
  onPlay: (c: CardId) => void;
  dealKey: string;
  dealMs: number;
}

export function Hand({ cards, trump, legal, onPlay, dealKey, dealMs }: Props) {
  const [selected, setSelected] = useState<CardId | null>(null);
  const sorted = sortHand(cards, trump);
  const n = sorted.length;
  const mid = (n - 1) / 2;

  useEffect(() => {
    if (!legal) setSelected(null);
  }, [legal]);

  return (
    <div className="hand" dir="ltr" style={{ ['--n' as any]: n }}>
      {sorted.map((c, i) => {
        const off = i - mid;
        const canPlay = legal ? legal.includes(c) : false;
        const disabled = legal !== null && !canPlay;
        const isSel = selected === c;
        return (
          <div
            key={`${dealKey}-${c}`}
            className={`hand-slot ${isSel ? 'sel' : ''}`}
            style={{
              ['--off' as any]: off,
              ['--rot' as any]: `${off * 2.6}deg`,
              ['--lift' as any]: `${Math.abs(off) * Math.abs(off) * 0.7}px`,
              ['--deal-delay' as any]: `${i * dealMs}ms`,
              zIndex: i + 1,
            }}
          >
            <Card
              id={c}
              disabled={disabled}
              selected={isSel}
              onClick={
                canPlay
                  ? () => {
                      if (isSel || legal!.length === 1) onPlay(c);
                      else setSelected(c);
                    }
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
