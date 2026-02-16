import { describe, expect, it } from "vitest";
import { DragonPhysicsEngine } from "../useDragonPhysics";

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
    expect(snapshot.segments).toHaveLength(18);

    for (const segment of snapshot.segments) {
      expect(Number.isFinite(segment.x)).toBe(true);
      expect(Number.isFinite(segment.y)).toBe(true);
      expect(Number.isFinite(segment.offset)).toBe(true);
      expect(Number.isFinite(segment.angle)).toBe(true);
    }
  });
});
