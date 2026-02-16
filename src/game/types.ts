export type PlayerSlot = 1 | 2 | 3 | 4 | 5;
export type LevelId = 1 | 2 | 3;
export type MapThemeId = "water-town-entry" | "whitewall-alley" | "ancestral-street";
export type DifficultyTier = "hardcore";

export type GameStatus =
  | "ready"
  | "running"
  | "level-clear"
  | "gameover"
  | "victory";

export type OverlayState =
  | "none"
  | "onboarding"
  | "gameover"
  | "level-clear"
  | "victory"
  | "rotate-lock";

export interface DragonSegmentFrame {
  index: number;
  x: number;
  y: number;
  angle: number;
  offset: number;
  risk: number;
  isHead: boolean;
  isPlayer: boolean;
  isTail: boolean;
  role: "head" | "body" | "tail";
}

export interface RoadFrameSample {
  s: number;
  x: number;
  y: number;
  angle: number;
  curvature: number;
}

export interface CameraAnchor {
  x: number;
  y: number;
}

export interface MinimapSample {
  x: number;
  y: number;
}

export type LandmarkKind = "arch" | "lantern" | "stone-bridge" | "turn-sign";

export interface LandmarkSample {
  s: number;
  x: number;
  y: number;
  angle: number;
  kind: LandmarkKind;
}

export interface PathGenerationProfile {
  maxCurvature: number;
  straightProbability: number;
  gentleProbability: number;
  straightLengthRange: readonly [number, number];
  gentleLengthRange: readonly [number, number];
  sharpLengthRange: readonly [number, number];
  gentleCurvatureRange: readonly [number, number];
  sharpCurvatureRange: readonly [number, number];
  smoothingFactor: number;
}

export interface PhysicsSnapshot {
  status: GameStatus;
  difficultyTier: DifficultyTier;
  level: LevelId;
  score: number;
  combo: number;
  speed: number;
  distance: number;
  targetDistance: number;
  frenzy: boolean;
  risk: number;
  playerOffsetPx: number;
  breakThresholdPx: number;
  breakMarginPx: number;
  maxCombo: number;
  failureSpeed: number;
  playerSlot: PlayerSlot;
  playerSegmentIndex: number;
  cameraForwardAngle: number;
  cameraDepthNorm: number;
  mapTheme: MapThemeId;
  mapSeed: number;
  cameraAnchor: CameraAnchor;
  roadSamples: RoadFrameSample[];
  minimapSamples: MinimapSample[];
  landmarks: LandmarkSample[];
  segments: DragonSegmentFrame[];
}

export interface UseDragonPhysicsApi {
  snapshot: PhysicsSnapshot;
  onDrag(deltaX: number): void;
  startLevel(level: LevelId, slot: PlayerSlot): void;
  restartLevel(): void;
  tick(nowMs: number): void;
  setPaused(paused: boolean): void;
}

export interface RunEndResult {
  level: LevelId;
  score: number;
  cleared: boolean;
}
