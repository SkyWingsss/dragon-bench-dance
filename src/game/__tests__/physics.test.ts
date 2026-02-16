import { describe, expect, it } from "vitest";
import { MAP_MINIMAP_SAMPLE_COUNT } from "../Constants";
import {
  DragonPhysicsEngine,
  calcCentrifugalForce,
  dragDeltaToCorrectionForce,
} from "../useDragonPhysics";

function stepFrames(engine: DragonPhysicsEngine, frames: number, frameMs = 16.666): void {
  let now = 0;
  engine.tick(now);
  for (let index = 0; index < frames; index += 1) {
    now += frameMs;
    engine.tick(now);
  }
}

function runUntilStop(engine: DragonPhysicsEngine, maxFrames = 5000, frameMs = 16.666): void {
  let now = 0;
  engine.tick(now);
  for (let frame = 0; frame < maxFrames; frame += 1) {
    now += frameMs;
    engine.tick(now);
    const status = engine.getSnapshot().status;
    if (status !== "running") {
      return;
    }
  }
}

describe("dragon physics core", () => {
  it("centrifugal force should increase with speed/curvature/slot coefficient", () => {
    const base = calcCentrifugalForce(300, 0.001, 1);
    const higherSpeed = calcCentrifugalForce(600, 0.001, 1);
    const higherCurvature = calcCentrifugalForce(600, 0.002, 1);
    const higherCoeff = calcCentrifugalForce(600, 0.002, 2);

    expect(higherSpeed).toBeGreaterThan(base);
    expect(higherCurvature).toBeGreaterThan(higherSpeed);
    expect(higherCoeff).toBeGreaterThan(higherCurvature);
  });

  it("drag mapping should follow right-drag equals left correction", () => {
    expect(dragDeltaToCorrectionForce(80)).toBeLessThan(0);
    expect(dragDeltaToCorrectionForce(-80)).toBeGreaterThan(0);
    expect(dragDeltaToCorrectionForce(0)).toBe(0);
  });

  it("pause should freeze physics advance", () => {
    const engine = new DragonPhysicsEngine({ initialLevel: 1, defaultSlot: 3 });
    engine.startLevel(1, 3);

    stepFrames(engine, 24);
    let runningSnapshot = engine.getSnapshot();
    if (runningSnapshot.status !== "running") {
      engine.restartLevel();
      stepFrames(engine, 16);
      runningSnapshot = engine.getSnapshot();
    }

    expect(runningSnapshot.status).toBe("running");
    expect(runningSnapshot.distance).toBeGreaterThan(0);

    engine.setPaused(true);
    const beforePausedDistance = engine.getSnapshot().distance;
    stepFrames(engine, 60);
    const afterPausedDistance = engine.getSnapshot().distance;

    expect(afterPausedDistance).toBeCloseTo(beforePausedDistance, 5);

    engine.setPaused(false);
    stepFrames(engine, 36);
    const resumed = engine.getSnapshot();
    expect(resumed.distance).toBeGreaterThanOrEqual(afterPausedDistance);
    expect(resumed.playerSegmentIndex).toBe(10);
    expect(resumed.playerSlot).toBe(3);
    expect(Number.isFinite(resumed.cameraAnchor.x)).toBe(true);
    expect(Number.isFinite(resumed.cameraAnchor.y)).toBe(true);
    expect(Number.isFinite(resumed.cameraForwardAngle)).toBe(true);
    expect(resumed.roadSamples.length).toBeGreaterThan(20);
    expect(resumed.minimapSamples.length).toBe(MAP_MINIMAP_SAMPLE_COUNT);
    expect(Number.isFinite(resumed.mapSeed)).toBe(true);
    expect(resumed.mapTheme).toBeTruthy();

    const heads = resumed.segments.filter((segment) => segment.role === "head");
    const tails = resumed.segments.filter((segment) => segment.role === "tail");
    expect(heads).toHaveLength(1);
    expect(tails).toHaveLength(1);
    expect(resumed.segments[resumed.playerSegmentIndex].isPlayer).toBe(true);
  });

  it("restart should reset key runtime state immediately", () => {
    const engine = new DragonPhysicsEngine({ initialLevel: 2, defaultSlot: 5 });
    engine.startLevel(2, 5);

    stepFrames(engine, 150);
    const beforeRestart = engine.getSnapshot();
    expect(beforeRestart.distance).toBeGreaterThan(0);
    expect(beforeRestart.score).toBeGreaterThanOrEqual(0);

    engine.restartLevel();
    const restarted = engine.getSnapshot();

    expect(restarted.status).toBe("running");
    expect(restarted.level).toBe(2);
    expect(restarted.distance).toBeCloseTo(0, 4);
    expect(restarted.score).toBe(0);
    expect(restarted.combo).toBe(0);
    expect(Math.abs(restarted.playerOffsetPx)).toBeLessThan(0.01);
    expect(restarted.playerSegmentIndex).toBe(16);
    expect(restarted.playerSlot).toBe(5);
    expect(restarted.roadSamples.length).toBeGreaterThan(20);
    expect(restarted.minimapSamples.length).toBe(MAP_MINIMAP_SAMPLE_COUNT);
    expect(restarted.landmarks.length).toBeGreaterThan(0);
  });

  it("tutorial level should provide a short learnable window", () => {
    const engine = new DragonPhysicsEngine({ initialLevel: 0, defaultSlot: 1 });
    engine.startLevel(0, 1);
    stepFrames(engine, 240);
    const snapshot = engine.getSnapshot();

    expect(snapshot.level).toBe(0);
    expect(snapshot.status === "running" || snapshot.status === "level-clear").toBe(true);
    expect(snapshot.distance).toBeGreaterThan(0);
    expect(snapshot.status).not.toBe("gameover");
  });

  it("high difficulty slot should still fail without input", () => {
    const engine = new DragonPhysicsEngine({ initialLevel: 3, defaultSlot: 5 });
    engine.startLevel(3, 5);
    runUntilStop(engine, 5600);
    const snapshot = engine.getSnapshot();

    expect(snapshot.status).toBe("gameover");
    expect(snapshot.distance).toBeLessThan(snapshot.targetDistance);
  });
});
