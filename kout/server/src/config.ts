/** Server settings (timings, limits). Game RULES are not here: they come from src/engine/rules.config.ts. */
const num = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== '' && process.env[name] !== undefined ? v : def;
};

export interface ServerConfig {
  /** seconds a human has for a bid / trump choice / Bawn answer */
  bidSeconds: number;
  /** seconds a human has to play a card */
  playSeconds: number;
  /** seconds the table may still call صيد after the last card (only when someone could) */
  reviewSeconds: number;
  /** seconds the hand result stays up before the next deal */
  handOverSeconds: number;
  /** public rooms: seconds to wait for more humans before bots fill the empty seats */
  publicWaitSeconds: number;
  /** seconds a dropped player keeps their seat (a bot plays for them meanwhile) */
  reconnectSeconds: number;
  /** a bot's "thinking" delay, ms (min and max) */
  botMinMs: number;
  botMaxMs: number;
  /** pause after a trick completes, ms, so everyone sees it */
  trickPauseMs: number;
  /** at the start of a game: ms per round of the first-dealer card draw, plus the deal (the clients animate it) */
  drawRoundMs: number;
  dealPauseMs: number;
  /** Monte Carlo samples per Hard-bot decision */
  botSamples: number;
  /** consecutive timeouts after which a player is treated as away (a bot plays immediately) */
  awayAfterTimeouts: number;
  /** rate limit per client */
  rateCapacity: number;
  ratePerSecond: number;
  /** rate-limit strikes before a client is disconnected */
  floodStrikes: number;
  /** comma-separated allowed web origins (empty = allow all) */
  allowedOrigins: string[];
  /** seconds a finished game stays open */
  gameOverSeconds: number;
}

export function loadConfig(over: Partial<ServerConfig> = {}): ServerConfig {
  return {
    bidSeconds: num('KOUT_BID_SECONDS', 20),
    playSeconds: num('KOUT_PLAY_SECONDS', 20),
    reviewSeconds: num('KOUT_REVIEW_SECONDS', 8),
    handOverSeconds: num('KOUT_HANDOVER_SECONDS', 7),
    publicWaitSeconds: num('KOUT_PUBLIC_WAIT_SECONDS', 12),
    reconnectSeconds: num('KOUT_RECONNECT_SECONDS', 120),
    botMinMs: num('KOUT_BOT_MIN_MS', 700),
    botMaxMs: num('KOUT_BOT_MAX_MS', 1300),
    trickPauseMs: num('KOUT_TRICK_PAUSE_MS', 1100),
    drawRoundMs: num('KOUT_DRAW_ROUND_MS', 1300),
    dealPauseMs: num('KOUT_DEAL_PAUSE_MS', 2900),
    botSamples: num('KOUT_BOT_SAMPLES', 40),
    awayAfterTimeouts: num('KOUT_AWAY_AFTER_TIMEOUTS', 2),
    rateCapacity: num('KOUT_RATE_CAPACITY', 12),
    ratePerSecond: num('KOUT_RATE_PER_SECOND', 6),
    floodStrikes: num('KOUT_FLOOD_STRIKES', 40),
    allowedOrigins: (process.env.KOUT_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    gameOverSeconds: num('KOUT_GAMEOVER_SECONDS', 120),
    ...over,
  };
}
