import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_BREAK_THRESHOLD,
  BREAK_HOLD_MS,
  CHAIN_PULL,
  COMBO_BREAK_RISK,
  COMBO_SAFE_RISK,
  COMBO_TICK_SEC,
  CONTROL_FORCE_GAIN,
  FIXED_DT,
  FRENZY_COMBO,
  FRENZY_SAFE_RISK,
  GRAVITY_SCALE,
  LEVEL_CLEAR_DELAY_MS,
  LEVEL_CONFIG,
  LEVEL_THEME,
  LEVEL_ORDER,
  MAP_LANDMARK_AHEAD,
  MAP_LANDMARK_BEHIND,
  MAP_MINIMAP_AHEAD,
  MAP_MINIMAP_BEHIND,
  MAP_MINIMAP_SAMPLE_COUNT,
  MAX_ABS_OFFSET,
  MAX_FRAME_DT,
  OFFSET_DAMPING,
  PLAYER_SLOT_COEFFICIENT,
  PLAYER_SLOT_TO_SEGMENT_INDEX,
  SEGMENT_COUNT,
  SEGMENT_SPACING,
} from "./Constants";
import {
  buildMinimapSamples,
  collectNearbyLandmarks,
  createVillageMap,
  type VillageMap,
} from "./map";
import type { PathTrack } from "./path";
import type {
  CameraAnchor,
  DragonSegmentFrame,
  GameStatus,
  LandmarkSample,
  LevelId,
  MapThemeId,
  MinimapSample,
  PhysicsSnapshot,
  PlayerSlot,
  RoadFrameSample,
  RunEndResult,
  UseDragonPhysicsApi,
} from "./types";

interface EngineOptions {
  initialLevel?: LevelId;
  defaultSlot?: PlayerSlot;
  onRunEnd?: (result: RunEndResult) => void;
}

interface StartOptions {
  resetScore: boolean;
  keepCombo: boolean;
}

const PATH_PRELOAD_DISTANCE = 14000;
const ROAD_SAMPLE_STEP = 40;
const ROAD_SAMPLES_BEHIND = 10;
const ROAD_SAMPLES_AHEAD = 26;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeEmptySegments(): DragonSegmentFrame[] {
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => ({
    index,
    x: 0,
    y: -index * SEGMENT_SPACING,
    angle: -Math.PI / 2,
    offset: 0,
    risk: 0,
    isHead: index === 0,
    isPlayer: false,
    isTail: index === SEGMENT_COUNT - 1,
    role: index === 0 ? "head" : index === SEGMENT_COUNT - 1 ? "tail" : "body",
  }));
}

function cloneSegments(segments: DragonSegmentFrame[]): DragonSegmentFrame[] {
  return segments.map((segment) => ({ ...segment }));
}

function cloneRoadSamples(samples: RoadFrameSample[]): RoadFrameSample[] {
  return samples.map((sample) => ({ ...sample }));
}

function cloneMinimapSamples(samples: MinimapSample[]): MinimapSample[] {
  return samples.map((sample) => ({ ...sample }));
}

function cloneLandmarks(landmarks: LandmarkSample[]): LandmarkSample[] {
  return landmarks.map((landmark) => ({ ...landmark }));
}

function createInitialSnapshot(level: LevelId): PhysicsSnapshot {
  const mapTheme = LEVEL_THEME[level];
  return {
    status: "ready",
    level,
    score: 0,
    combo: 0,
    speed: LEVEL_CONFIG[level].baseSpeed,
    distance: 0,
    targetDistance: LEVEL_CONFIG[level].targetDistance,
    frenzy: false,
    risk: 0,
    playerOffsetPx: 0,
    breakThresholdPx: BASE_BREAK_THRESHOLD,
    breakMarginPx: BASE_BREAK_THRESHOLD,
    maxCombo: 0,
    failureSpeed: 0,
    playerSlot: 1,
    playerSegmentIndex: PLAYER_SLOT_TO_SEGMENT_INDEX[1],
    mapTheme,
    mapSeed: LEVEL_CONFIG[level].seed,
    cameraAnchor: { x: 0, y: 0 },
    roadSamples: [],
    minimapSamples: [],
    landmarks: [],
    segments: makeEmptySegments(),
  };
}

export function calcCentrifugalForce(
  speed: number,
  curvature: number,
  segmentCoefficient: number,
  gravityScale = GRAVITY_SCALE,
): number {
  return speed * Math.abs(curvature) * segmentCoefficient * gravityScale;
}

export function dragDeltaToCorrectionForce(deltaX: number): number {
  const normalized = clamp(deltaX / 80, -1, 1);
  const force = -normalized * CONTROL_FORCE_GAIN;
  return force === 0 ? 0 : force;
}

export class DragonPhysicsEngine {
  private readonly onRunEnd?: (result: RunEndResult) => void;

  private level: LevelId;

  private slot: PlayerSlot;

  private pathTrack: PathTrack;

  private villageMap: VillageMap;

  private mapTheme: MapThemeId;

  private mapSeed: number;

  private snapshot: PhysicsSnapshot;

  private offsets: number[];

  private offsetVels: number[];

  private speed: number;

  private distance: number;

  private score: number;

  private combo: number;

  private comboTimerSec: number;

  private breakHoldMs: number;

  private inputForce: number;

  private paused: boolean;

  private accumulatorSec: number;

  private lastTickMs: number | null;

  private statusTimerMs: number;

  private maxCombo: number;

  private failureSpeed: number;

  private emittedResultKey: string | null;

  private mapSeedNonce: number;

  constructor(options: EngineOptions = {}) {
    this.level = options.initialLevel ?? 1;
    this.slot = options.defaultSlot ?? 1;
    this.onRunEnd = options.onRunEnd;
    this.mapSeedNonce = 0;
    this.mapTheme = LEVEL_THEME[this.level];
    this.mapSeed = this.generateMapSeed(this.level);
    this.villageMap = createVillageMap(this.mapSeed, this.mapTheme, PATH_PRELOAD_DISTANCE);
    this.pathTrack = this.villageMap.pathTrack;
    this.snapshot = createInitialSnapshot(this.level);
    this.offsets = Array.from({ length: SEGMENT_COUNT }, () => 0);
    this.offsetVels = Array.from({ length: SEGMENT_COUNT }, () => 0);
    this.speed = LEVEL_CONFIG[this.level].baseSpeed;
    this.distance = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimerSec = 0;
    this.breakHoldMs = 0;
    this.inputForce = 0;
    this.paused = false;
    this.accumulatorSec = 0;
    this.lastTickMs = null;
    this.statusTimerMs = 0;
    this.maxCombo = 0;
    this.failureSpeed = 0;
    this.emittedResultKey = null;
    this.snapshot.mapTheme = this.mapTheme;
    this.snapshot.mapSeed = this.mapSeed;
    this.updateSegmentsAndSnapshot("ready");
  }

  getSnapshot(): PhysicsSnapshot {
    return {
      ...this.snapshot,
      cameraAnchor: { ...this.snapshot.cameraAnchor },
      roadSamples: cloneRoadSamples(this.snapshot.roadSamples),
      minimapSamples: cloneMinimapSamples(this.snapshot.minimapSamples),
      landmarks: cloneLandmarks(this.snapshot.landmarks),
      segments: cloneSegments(this.snapshot.segments),
    };
  }

  startLevel(level: LevelId, slot: PlayerSlot): void {
    this.level = level;
    this.slot = slot;
    this.setupLevel(level, {
      resetScore: true,
      keepCombo: false,
    });
  }

  restartLevel(): void {
    this.setupLevel(this.level, {
      resetScore: true,
      keepCombo: false,
    });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  onDrag(deltaX: number): void {
    if (this.snapshot.status !== "running") {
      return;
    }

    this.inputForce += dragDeltaToCorrectionForce(deltaX);
    this.inputForce = clamp(this.inputForce, -620, 620);
  }

  tick(nowMs: number): void {
    if (this.lastTickMs === null) {
      this.lastTickMs = nowMs;
      return;
    }

    const rawDeltaSec = (nowMs - this.lastTickMs) / 1000;
    this.lastTickMs = nowMs;

    if (!Number.isFinite(rawDeltaSec) || rawDeltaSec <= 0) {
      return;
    }

    const frameSec = clamp(rawDeltaSec, 0, MAX_FRAME_DT);

    if (this.paused) {
      return;
    }

    if (this.snapshot.status === "running") {
      this.accumulatorSec += frameSec;
      while (this.accumulatorSec >= FIXED_DT) {
        this.stepRunning(FIXED_DT);
        this.accumulatorSec -= FIXED_DT;
      }
      return;
    }

    if (this.snapshot.status === "level-clear") {
      this.statusTimerMs += frameSec * 1000;
      if (this.statusTimerMs >= LEVEL_CLEAR_DELAY_MS) {
        this.advanceToNextLevel();
      }
    }
  }

  private generateMapSeed(level: LevelId): number {
    this.mapSeedNonce += 1;
    const base = LEVEL_CONFIG[level].seed * 131071;
    const randomPart = Math.floor(Math.random() * 1_000_000);
    return (base + randomPart + this.mapSeedNonce * 977) >>> 0;
  }

  private rebuildVillageMap(level: LevelId): void {
    this.mapTheme = LEVEL_THEME[level];
    this.mapSeed = this.generateMapSeed(level);
    this.villageMap = createVillageMap(this.mapSeed, this.mapTheme, PATH_PRELOAD_DISTANCE);
    this.pathTrack = this.villageMap.pathTrack;
  }

  private setupLevel(level: LevelId, options: StartOptions): void {
    const config = LEVEL_CONFIG[level];

    this.level = level;
    this.rebuildVillageMap(level);
    this.offsets = Array.from({ length: SEGMENT_COUNT }, () => 0);
    this.offsetVels = Array.from({ length: SEGMENT_COUNT }, () => 0);
    this.speed = config.baseSpeed;
    this.distance = 0;
    this.breakHoldMs = 0;
    this.inputForce = 0;
    this.accumulatorSec = 0;
    this.statusTimerMs = 0;
    this.failureSpeed = 0;
    this.emittedResultKey = null;

    if (options.resetScore) {
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.comboTimerSec = 0;
    } else {
      if (!options.keepCombo) {
        this.combo = 0;
        this.comboTimerSec = 0;
      }
    }

    this.updateSegmentsAndSnapshot("running");
  }

  private advanceToNextLevel(): void {
    const index = LEVEL_ORDER.indexOf(this.level);
    const next = LEVEL_ORDER[index + 1];

    if (next === undefined) {
      this.updateSegmentsAndSnapshot("victory");
      this.emitRunEnd({ level: this.level, score: Math.floor(this.score), cleared: true }, "victory");
      return;
    }

    this.level = next;
    const config = LEVEL_CONFIG[next];
    this.rebuildVillageMap(next);
    this.offsets = Array.from({ length: SEGMENT_COUNT }, () => 0);
    this.offsetVels = Array.from({ length: SEGMENT_COUNT }, () => 0);
    this.speed = config.baseSpeed;
    this.distance = 0;
    this.breakHoldMs = 0;
    this.inputForce = 0;
    this.accumulatorSec = 0;
    this.statusTimerMs = 0;

    this.updateSegmentsAndSnapshot("running");
  }

  private emitRunEnd(result: RunEndResult, key: string): void {
    if (!this.onRunEnd) {
      return;
    }

    if (this.emittedResultKey === key) {
      return;
    }

    this.emittedResultKey = key;
    this.onRunEnd(result);
  }

  private stepRunning(dt: number): void {
    const config = LEVEL_CONFIG[this.level];
    const playerIndex = PLAYER_SLOT_TO_SEGMENT_INDEX[this.slot];
    const slotCoefficient = PLAYER_SLOT_COEFFICIENT[this.slot];

    this.speed = Math.min(config.maxSpeed, this.speed + config.accel * dt);
    this.distance += this.speed * dt;

    this.offsets[0] = 0;
    this.offsetVels[0] = 0;

    for (let index = 1; index < SEGMENT_COUNT; index += 1) {
      const segmentDistance = this.distance - index * SEGMENT_SPACING;
      const sample = this.pathTrack.sampleAtDistance(segmentDistance);
      const coefficient =
        index === playerIndex ? slotCoefficient : 1 + index / Math.max(1, SEGMENT_COUNT - 1);

      const centrifugalMagnitude = calcCentrifugalForce(
        this.speed,
        sample.curvature,
        coefficient,
        GRAVITY_SCALE,
      );
      const outwardDirection = Math.sign(sample.curvature);

      let acceleration = outwardDirection * centrifugalMagnitude;

      if (index === playerIndex) {
        acceleration += this.inputForce;
      }

      const desiredOffset = index === 1 ? 0 : this.offsets[index - 1] * 0.9;
      acceleration += -CHAIN_PULL * (this.offsets[index] - desiredOffset);
      acceleration += -OFFSET_DAMPING * this.offsetVels[index];

      this.offsetVels[index] += acceleration * dt;
      this.offsets[index] += this.offsetVels[index] * dt;

      if (this.offsets[index] > MAX_ABS_OFFSET) {
        this.offsets[index] = MAX_ABS_OFFSET;
        this.offsetVels[index] *= 0.25;
      } else if (this.offsets[index] < -MAX_ABS_OFFSET) {
        this.offsets[index] = -MAX_ABS_OFFSET;
        this.offsetVels[index] *= 0.25;
      }
    }

    this.inputForce *= Math.exp(-dt * 11);

    const playerOffset = this.offsets[playerIndex];
    const breakThreshold = BASE_BREAK_THRESHOLD / slotCoefficient;
    const risk = Math.abs(playerOffset) / breakThreshold;

    if (risk < COMBO_SAFE_RISK) {
      this.comboTimerSec += dt;
      while (this.comboTimerSec >= COMBO_TICK_SEC) {
        this.comboTimerSec -= COMBO_TICK_SEC;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += this.combo * 2;
      }
    }

    if (risk >= COMBO_BREAK_RISK) {
      this.combo = 0;
      this.comboTimerSec = 0;
    }

    this.score += this.speed * dt * 0.1;

    if (Math.abs(playerOffset) > breakThreshold) {
      this.breakHoldMs += dt * 1000;
    } else {
      this.breakHoldMs = 0;
    }

    if (this.breakHoldMs >= BREAK_HOLD_MS) {
      this.failureSpeed = this.speed;
      this.updateSegmentsAndSnapshot("gameover");
      this.emitRunEnd({ level: this.level, score: Math.floor(this.score), cleared: false }, "gameover");
      return;
    }

    if (this.distance >= config.targetDistance) {
      this.statusTimerMs = 0;
      this.updateSegmentsAndSnapshot("level-clear");
      return;
    }

    this.updateSegmentsAndSnapshot("running");
  }

  private updateSegmentsAndSnapshot(nextStatus: GameStatus): void {
    const playerIndex = PLAYER_SLOT_TO_SEGMENT_INDEX[this.slot];
    const slotCoefficient = PLAYER_SLOT_COEFFICIENT[this.slot];
    const breakThreshold = BASE_BREAK_THRESHOLD / slotCoefficient;

    const segments: DragonSegmentFrame[] = [];

    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const s = this.distance - index * SEGMENT_SPACING;
      const sample = this.pathTrack.sampleAtDistance(s);
      const offset = this.offsets[index] ?? 0;

      segments.push({
        index,
        x: sample.x + sample.normal.x * offset,
        y: sample.y + sample.normal.y * offset,
        angle: sample.angle,
        offset,
        risk:
          index === playerIndex
            ? Math.abs(offset) / breakThreshold
            : Math.abs(offset) / (BASE_BREAK_THRESHOLD / (1 + index / SEGMENT_COUNT)),
        isHead: index === 0,
        isPlayer: index === playerIndex,
        isTail: index === SEGMENT_COUNT - 1,
        role: index === 0 ? "head" : index === SEGMENT_COUNT - 1 ? "tail" : "body",
      });
    }

    const playerOffset = this.offsets[playerIndex] ?? 0;
    const risk = Math.abs(playerOffset) / breakThreshold;
    const playerSegment = segments[playerIndex];
    const playerDistance = this.distance - playerIndex * SEGMENT_SPACING;
    const roadSamples: RoadFrameSample[] = [];

    for (let sampleIndex = -ROAD_SAMPLES_BEHIND; sampleIndex <= ROAD_SAMPLES_AHEAD; sampleIndex += 1) {
      const sampleDistance = playerDistance + sampleIndex * ROAD_SAMPLE_STEP;
      const sample = this.pathTrack.sampleAtDistance(sampleDistance);

      roadSamples.push({
        s: sample.s,
        x: sample.x,
        y: sample.y,
        angle: sample.angle,
        curvature: sample.curvature,
      });
    }

    const minimapSamples = buildMinimapSamples(
      this.pathTrack,
      playerDistance,
      MAP_MINIMAP_SAMPLE_COUNT,
      MAP_MINIMAP_BEHIND,
      MAP_MINIMAP_AHEAD,
    );
    const landmarks = collectNearbyLandmarks(
      this.villageMap.landmarks,
      playerDistance,
      MAP_LANDMARK_BEHIND,
      MAP_LANDMARK_AHEAD,
    );

    const cameraAnchor: CameraAnchor = playerSegment
      ? { x: playerSegment.x, y: playerSegment.y }
      : { x: 0, y: 0 };

    this.snapshot = {
      status: nextStatus,
      level: this.level,
      score: Math.floor(this.score),
      combo: this.combo,
      speed: this.speed,
      distance: this.distance,
      targetDistance: LEVEL_CONFIG[this.level].targetDistance,
      frenzy: this.combo >= FRENZY_COMBO && risk < FRENZY_SAFE_RISK,
      risk,
      playerOffsetPx: playerOffset,
      breakThresholdPx: breakThreshold,
      breakMarginPx: breakThreshold - Math.abs(playerOffset),
      maxCombo: this.maxCombo,
      failureSpeed: this.failureSpeed,
      playerSlot: this.slot,
      playerSegmentIndex: playerIndex,
      mapTheme: this.mapTheme,
      mapSeed: this.mapSeed,
      cameraAnchor,
      roadSamples,
      minimapSamples,
      landmarks,
      segments,
    };
  }
}

interface HookOptions extends EngineOptions {}

export function useDragonPhysics(options: HookOptions = {}): UseDragonPhysicsApi {
  const engineRef = useRef<DragonPhysicsEngine | null>(null);

  if (engineRef.current === null) {
    engineRef.current = new DragonPhysicsEngine(options);
  }

  const [snapshot, setSnapshot] = useState<PhysicsSnapshot>(() => engineRef.current!.getSnapshot());

  const syncSnapshot = useCallback(() => {
    setSnapshot(engineRef.current!.getSnapshot());
  }, []);

  const onDrag = useCallback(
    (deltaX: number) => {
      engineRef.current!.onDrag(deltaX);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const startLevel = useCallback(
    (level: LevelId, slot: PlayerSlot) => {
      engineRef.current!.startLevel(level, slot);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const restartLevel = useCallback(() => {
    engineRef.current!.restartLevel();
    syncSnapshot();
  }, [syncSnapshot]);

  const tick = useCallback(
    (nowMs: number) => {
      engineRef.current!.tick(nowMs);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const setPaused = useCallback(
    (paused: boolean) => {
      engineRef.current!.setPaused(paused);
    },
    [],
  );

  useEffect(() => {
    syncSnapshot();
  }, [syncSnapshot]);

  return {
    snapshot,
    onDrag,
    startLevel,
    restartLevel,
    tick,
    setPaused,
  };
}
