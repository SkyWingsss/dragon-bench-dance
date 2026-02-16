import { describe, expect, it } from "vitest";
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

    stepFrames(engine, 80);
    const runningSnapshot = engine.getSnapshot();
    expect(runningSnapshot.distance).toBeGreaterThan(0);

    engine.setPaused(true);
    const beforePausedDistance = engine.getSnapshot().distance;
    stepFrames(engine, 80);
    const afterPausedDistance = engine.getSnapshot().distance;

    expect(afterPausedDistance).toBeCloseTo(beforePausedDistance, 5);

    engine.setPaused(false);
    stepFrames(engine, 60);
    expect(engine.getSnapshot().distance).toBeGreaterThan(afterPausedDistance);
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
  });
});
