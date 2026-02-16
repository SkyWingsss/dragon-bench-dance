export type PlayerSlot = 1 | 2 | 3 | 4 | 5;
export type LevelId = 1 | 2 | 3;

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
}

export interface PhysicsSnapshot {
  status: GameStatus;
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
