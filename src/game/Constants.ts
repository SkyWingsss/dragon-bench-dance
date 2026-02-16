import type {
  DifficultyTier,
  LandmarkKind,
  LevelId,
  MapThemeId,
  PathGenerationProfile,
  PlayerSlot,
} from "./types";

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
  1: 1.6,
  2: 1.95,
  3: 2.32,
  4: 2.72,
  5: 3.2,
};

export const GRAVITY_SCALE = 42;
export const OFFSET_DAMPING = 3.8;
export const CHAIN_PULL = 8.4;
export const BASE_BREAK_THRESHOLD = 24;
export const BREAK_HOLD_MS = 56;
export const CONTROL_FORCE_GAIN = 210;
export const MAX_ABS_OFFSET = 120;
export const DIFFICULTY_TIER: DifficultyTier = "hardcore";

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
    baseSpeed: 460,
    maxSpeed: 780,
    accel: 44,
    targetDistance: 3000,
    seed: 101,
  },
  2: {
    baseSpeed: 580,
    maxSpeed: 980,
    accel: 56,
    targetDistance: 3900,
    seed: 202,
  },
  3: {
    baseSpeed: 700,
    maxSpeed: 1180,
    accel: 70,
    targetDistance: 4800,
    seed: 303,
  },
};

export const LEVEL_PATH_PROFILE: Record<LevelId, PathGenerationProfile> = {
  1: {
    maxCurvature: 0.0054,
    straightProbability: 0.12,
    gentleProbability: 0.4,
    straightLengthRange: [4, 10],
    gentleLengthRange: [4, 9],
    sharpLengthRange: [3, 7],
    gentleCurvatureRange: [-0.003, 0.003],
    sharpCurvatureRange: [-0.0054, 0.0054],
    smoothingFactor: 0.28,
  },
  2: {
    maxCurvature: 0.0068,
    straightProbability: 0.1,
    gentleProbability: 0.36,
    straightLengthRange: [4, 9],
    gentleLengthRange: [4, 8],
    sharpLengthRange: [3, 7],
    gentleCurvatureRange: [-0.0036, 0.0036],
    sharpCurvatureRange: [-0.0068, 0.0068],
    smoothingFactor: 0.3,
  },
  3: {
    maxCurvature: 0.0082,
    straightProbability: 0.08,
    gentleProbability: 0.32,
    straightLengthRange: [3, 8],
    gentleLengthRange: [3, 7],
    sharpLengthRange: [2, 6],
    gentleCurvatureRange: [-0.0044, 0.0044],
    sharpCurvatureRange: [-0.0082, 0.0082],
    smoothingFactor: 0.34,
  },
};

export const FRENZY_COMBO = 12;
export const FRENZY_SAFE_RISK = 0.45;

export const COMBO_TICK_SEC = 0.5;
export const COMBO_SAFE_RISK = 0.35;
export const COMBO_BREAK_RISK = 0.75;

export const LEVEL_CLEAR_DELAY_MS = 900;
export const GAMEOVER_WAVE_MS = 280;

export const MAP_MINIMAP_SAMPLE_COUNT = 24;
export const MAP_MINIMAP_BEHIND = 340;
export const MAP_MINIMAP_AHEAD = 980;
export const MAP_LANDMARK_AHEAD = 980;
export const MAP_LANDMARK_BEHIND = 260;
export const VISUAL_WAVE_AMPLITUDE_PX = 7.5;
export const VISUAL_WAVE_FREQ_HZ = 2.2;
export const TAIL_SWAY_BASE_DEG = 3.2;
export const TAIL_SWAY_RISK_BONUS_DEG = 12.6;
export const TAIL_SWAY_FREQ_HZ = 3.4;

export const LEVEL_THEME: Record<LevelId, MapThemeId> = {
  1: "water-town-entry",
  2: "whitewall-alley",
  3: "ancestral-street",
};

export const THEME_CONFIG: Record<
  MapThemeId,
  {
    label: string;
    roadColor: string;
    shoulderColor: string;
    wallColor: string;
    roofColor: string;
    landmarkBias: LandmarkKind[];
  }
> = {
  "water-town-entry": {
    label: "水镇入口",
    roadColor: "#ac7f54",
    shoulderColor: "#c59d6c",
    wallColor: "#f7f2e8",
    roofColor: "#2e3135",
    landmarkBias: ["arch", "lantern", "turn-sign", "stone-bridge"],
  },
  "whitewall-alley": {
    label: "粉墙巷道",
    roadColor: "#a97749",
    shoulderColor: "#be945f",
    wallColor: "#fbf7ee",
    roofColor: "#23262a",
    landmarkBias: ["lantern", "turn-sign", "arch", "stone-bridge"],
  },
  "ancestral-street": {
    label: "祠堂街道",
    roadColor: "#9e7246",
    shoulderColor: "#b98b58",
    wallColor: "#f4efe3",
    roofColor: "#292b2f",
    landmarkBias: ["stone-bridge", "arch", "lantern", "turn-sign"],
  },
};

export const ONBOARDING_STORAGE_KEY = "dragon_onboarding_seen";

export const ORIENTATION_LOCK_MESSAGE = "请竖屏体验";
