import { createContext, useContext } from 'react';
import type { ModeId } from '../engine';
import { BOT_NAMES } from '../bots/names';

/** Seat positions in % of the table box. Seat 0 = you (bottom); seats go counter-clockwise (right side first). */
export const SEAT_POS: Record<ModeId, { x: number; y: number }[]> = {
  bo4: [
    { x: 50, y: 92 },
    { x: 90, y: 48 },
    { x: 50, y: 8 },
    { x: 10, y: 48 },
  ],
  bo6: [
    { x: 50, y: 92 },
    { x: 89, y: 62 },
    { x: 89, y: 26 },
    { x: 50, y: 8 },
    { x: 11, y: 26 },
    { x: 11, y: 62 },
  ],
};

export const SEAT_NAMES: Record<ModeId, string[]> = {
  // team 0 (us) = even seats, team 1 (them) = odd seats
  bo4: ['أنت', ...BOT_NAMES.slice(0, 3)],
  bo6: ['أنت', ...BOT_NAMES],
};

/** Where a played card sits in the trick, as a pixel offset from the table centre. */
const TRICK_OFFSETS: Record<ModeId, { dx: number; dy: number }[]> = {
  bo4: [
    { dx: 0, dy: 48 },
    { dx: 46, dy: 0 },
    { dx: 0, dy: -48 },
    { dx: -46, dy: 0 },
  ],
  bo6: [
    { dx: 0, dy: 78 },
    { dx: 60, dy: 38 },
    { dx: 60, dy: -38 },
    { dx: 0, dy: -78 },
    { dx: -60, dy: -38 },
    { dx: -60, dy: 38 },
  ],
};
export function trickOffset(mode: ModeId, seat: number) {
  return TRICK_OFFSETS[mode][seat];
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function ar(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/** Seat names for the current table (online: the real players, rotated so index 0 = you). */
export const SeatNamesContext = createContext<string[] | null>(null);
export function useSeatNames(mode: ModeId): string[] {
  return useContext(SeatNamesContext) ?? SEAT_NAMES[mode];
}
