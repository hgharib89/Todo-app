// Browser-safe part of the room codes (used by the app and the server).
// no 0/O, 1/I/L: easy to read out loud and type
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function isRoomCode(s: unknown): s is string {
  return typeof s === 'string' && new RegExp(`^[${ALPHABET}]{6}$`).test(s);
}
