import type { LevelId, PlayerSlot } from "./types";

export const SEGMENT_COUNT = 18;
export const SEGMENT_SPACING = 36;

export const PLAYER_SLOT_TO_SEGMENT_INDEX: Record<PlayerSlot, number> = {
  1: 4,
  2: 7,
  3: 10,
  4: 13,
  5: 16,
};

export const PLAYER_SLOT_COEFFICIENT: Record<PlayerSlot, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.45,
  4: 1.75,
  5: 2.1,
};

export const GRAVITY_SCALE = 28;
export const OFFSET_DAMPING = 9.5;
export const CHAIN_PULL = 18;
export const BASE_BREAK_THRESHOLD = 72;
export const BREAK_HOLD_MS = 120;
export const CONTROL_FORCE_GAIN = 260;
export const MAX_ABS_OFFSET = 120;

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 1 / 30;

export const LEVEL_ORDER: LevelId[] = [1, 2, 3];

export const LEVEL_CONFIG: Record<
  LevelId,
  {
    baseSpeed: number;
    maxSpeed: number;
    accel: number;
    targetDistance: number;
    seed: number;
  }
> = {
  1: {
    baseSpeed: 340,
    maxSpeed: 560,
    accel: 24,
    targetDistance: 2200,
    seed: 101,
  },
  2: {
    baseSpeed: 420,
    maxSpeed: 700,
    accel: 30,
    targetDistance: 3000,
    seed: 202,
  },
  3: {
    baseSpeed: 500,
    maxSpeed: 820,
    accel: 38,
    targetDistance: 3800,
    seed: 303,
  },
};

export const FRENZY_COMBO = 12;
export const FRENZY_SAFE_RISK = 0.45;

export const COMBO_TICK_SEC = 0.5;
export const COMBO_SAFE_RISK = 0.35;
export const COMBO_BREAK_RISK = 0.75;

export const LEVEL_CLEAR_DELAY_MS = 900;
export const GAMEOVER_WAVE_MS = 280;

export const ONBOARDING_STORAGE_KEY = "dragon_onboarding_seen";

export const ORIENTATION_LOCK_MESSAGE = "请竖屏体验";
