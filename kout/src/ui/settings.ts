import type { JokerPresetId, ModeId } from '../engine';
import type { Difficulty } from '../bots';

export type Speed = 'slow' | 'normal' | 'fast';

export interface Settings {
  mode: ModeId;
  preset: JokerPresetId;
  difficulty: Difficulty;
  speed: Speed;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'bo6',
  preset: 'default',
  difficulty: 'medium',
  speed: 'normal',
  sound: true,
};

const KEY = 'kout.settings.v1';
const GAME_KEY = 'kout.game.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadSavedGame<T>(): T | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveGame(g: unknown | null) {
  try {
    if (g === null) localStorage.removeItem(GAME_KEY);
    else localStorage.setItem(GAME_KEY, JSON.stringify(g));
  } catch {
    /* ignore */
  }
}

/** ms per bot action, and trick display hold time */
export const SPEED_MS: Record<Speed, { bot: number; hold: number; deal: number }> = {
  slow: { bot: 1100, hold: 1300, deal: 90 },
  normal: { bot: 700, hold: 900, deal: 60 },
  fast: { bot: 320, hold: 500, deal: 35 },
};

/** Display names only; the descriptions are generated from rules.config.ts (see rulesText.ts). */
export const PRESET_NAMES: Record<JokerPresetId, string> = {
  default: 'افتراضي',
  strict: 'صارم',
  stricter: 'أصرم',
  relaxed: 'مرن',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'سهل', medium: 'متوسط' };
export const SPEED_LABELS: Record<Speed, string> = { slow: 'بطيء', normal: 'عادي', fast: 'سريع' };
export const MODE_LABELS: Record<ModeId, string> = { bo6: 'كوت بو ٦', bo4: 'كوت بو ٤' };
