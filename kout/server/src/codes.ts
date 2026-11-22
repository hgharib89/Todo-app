import { randomInt } from 'node:crypto';
import { ALPHABET } from './codes-shared';
export { isRoomCode } from './codes-shared';

/** A private-room code like "K7QF3M". */
export function roomCode(length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** A player name safe to show: trimmed, no control characters, at most 16 characters. */
export function cleanName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, 16);
  return s || fallback;
}
