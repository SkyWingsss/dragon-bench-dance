import { describe, expect, it } from "vitest";
import { DragonPhysicsEngine, dragDeltaToCorrectionForce } from "../useDragonPhysics";

function runWithVariableFrameTime(engine: DragonPhysicsEngine, steps: number): void {
  let now = 0;
  engine.tick(now);

  for (let index = 0; index < steps; index += 1) {
    const frameMs = 8 + ((index * 7) % 31);
    now += frameMs;
    engine.tick(now);
  }
}

describe("offset stability", () => {
  it("break margin should equal threshold minus absolute player offset", () => {
    const engine = new DragonPhysicsEngine({ initialLevel: 1, defaultSlot: 4 });
    engine.startLevel(1, 4);
    runWithVariableFrameTime(engine, 220);

    const snapshot = engine.getSnapshot();
    const expected = snapshot.breakThresholdPx - Math.abs(snapshot.playerOffsetPx);
    expect(snapshot.breakMarginPx).toBeCloseTo(expected, 5);
  });

  it("should stay numerically stable at high speed and variable frame gaps", () => {
    const engine = new DragonPhysicsEngine({ initialLevel: 3, defaultSlot: 5 });
    engine.startLevel(3, 5);

    runWithVariableFrameTime(engine, 1600);
    const snapshot = engine.getSnapshot();

    expect(Number.isFinite(snapshot.speed)).toBe(true);
    expect(Number.isFinite(snapshot.playerOffsetPx)).toBe(true);
    expect(Number.isFinite(snapshot.risk)).toBe(true);
    expect(Number.isFinite(snapshot.cameraAnchor.x)).toBe(true);
    expect(Number.isFinite(snapshot.cameraAnchor.y)).toBe(true);
    expect(snapshot.segments).toHaveLength(18);
    expect(snapshot.roadSamples.length).toBeGreaterThan(20);
    expect(snapshot.minimapSamples.length).toBeGreaterThan(10);
    expect(snapshot.landmarks.length).toBeGreaterThan(0);

    for (const segment of snapshot.segments) {
      expect(Number.isFinite(segment.x)).toBe(true);
      expect(Number.isFinite(segment.y)).toBe(true);
      expect(Number.isFinite(segment.offset)).toBe(true);
      expect(Number.isFinite(segment.angle)).toBe(true);
    }

    for (const roadSample of snapshot.roadSamples) {
      expect(Number.isFinite(roadSample.x)).toBe(true);
      expect(Number.isFinite(roadSample.y)).toBe(true);
      expect(Number.isFinite(roadSample.angle)).toBe(true);
      expect(Number.isFinite(roadSample.curvature)).toBe(true);
    }

    for (const minimapSample of snapshot.minimapSamples) {
      expect(Number.isFinite(minimapSample.x)).toBe(true);
      expect(Number.isFinite(minimapSample.y)).toBe(true);
      expect(minimapSample.x).toBeGreaterThanOrEqual(0);
      expect(minimapSample.x).toBeLessThanOrEqual(1);
      expect(minimapSample.y).toBeGreaterThanOrEqual(0);
      expect(minimapSample.y).toBeLessThanOrEqual(1);
    }

    for (const landmark of snapshot.landmarks) {
      expect(Number.isFinite(landmark.x)).toBe(true);
      expect(Number.isFinite(landmark.y)).toBe(true);
      expect(Number.isFinite(landmark.s)).toBe(true);
      expect(Number.isFinite(landmark.angle)).toBe(true);
    }

    const first = snapshot.roadSamples[0];
    const last = snapshot.roadSamples[snapshot.roadSamples.length - 1];
    expect(last.s).toBeGreaterThan(first.s);

    expect(dragDeltaToCorrectionForce(80)).toBeLessThan(0);
    expect(dragDeltaToCorrectionForce(-80)).toBeGreaterThan(0);
  });
});
