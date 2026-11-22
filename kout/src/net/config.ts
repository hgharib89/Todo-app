/** Set at build time (VITE_KOUT_SERVER, e.g. "https://kout-server.fly.dev"). Empty = online play hidden. */
export const SERVER_URL: string = (import.meta.env.VITE_KOUT_SERVER as string | undefined)?.trim() || '';
export const onlineAvailable = () => SERVER_URL !== '';
/** sessionStorage key of the last online seat (to come back after a refresh) */
export const TOKEN_KEY = 'kout.online.reconnect';
export function hasOnlineSeat(): boolean {
  try {
    return !!sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}
