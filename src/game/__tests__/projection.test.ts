import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECTION_CONFIG,
  projectWorldAngleToScreenAngle,
  projectWorldPoint25D,
  type CameraFrame,
} from "../projection";

function makeCamera(): CameraFrame {
  return {
    x: 0,
    y: 0,
    forwardAngle: -Math.PI / 2,
    width: 390,
    height: 844,
  };
}

describe("2.5D projection", () => {
  it("is finite and monotonic across forward distance", () => {
    const camera = makeCamera();
    const nearPoint = projectWorldPoint25D(0, 220, camera, DEFAULT_PROJECTION_CONFIG);
    const midPoint = projectWorldPoint25D(0, -180, camera, DEFAULT_PROJECTION_CONFIG);
    const farPoint = projectWorldPoint25D(0, -760, camera, DEFAULT_PROJECTION_CONFIG);

    expect(Number.isFinite(nearPoint.x)).toBe(true);
    expect(Number.isFinite(nearPoint.y)).toBe(true);
    expect(Number.isFinite(midPoint.x)).toBe(true);
    expect(Number.isFinite(midPoint.y)).toBe(true);
    expect(Number.isFinite(farPoint.x)).toBe(true);
    expect(Number.isFinite(farPoint.y)).toBe(true);

    expect(midPoint.depth).toBeGreaterThan(nearPoint.depth);
    expect(farPoint.depth).toBeGreaterThan(midPoint.depth);
    expect(midPoint.y).toBeLessThan(nearPoint.y);
    expect(farPoint.y).toBeLessThan(midPoint.y);
  });

  it("maps lateral offsets symmetrically around screen center", () => {
    const camera = makeCamera();
    const left = projectWorldPoint25D(-120, -260, camera, DEFAULT_PROJECTION_CONFIG);
    const right = projectWorldPoint25D(120, -260, camera, DEFAULT_PROJECTION_CONFIG);

    expect(left.x).toBeLessThan(camera.width * 0.5);
    expect(right.x).toBeGreaterThan(camera.width * 0.5);
    expect(Math.abs((camera.width - right.x) - left.x)).toBeLessThan(3.5);
  });

  it("keeps draw ordering consistent with depth", () => {
    const camera = makeCamera();
    const points = [-180, -360, -520, -760].map((worldY) =>
      projectWorldPoint25D(0, worldY, camera, DEFAULT_PROJECTION_CONFIG),
    );

    const sorted = [...points].sort((a, b) => b.depth - a.depth);
    expect(sorted[0].depth).toBeGreaterThan(sorted[sorted.length - 1].depth);
    expect(sorted[0].y).toBeLessThan(sorted[sorted.length - 1].y);
  });

  it("returns finite projected heading angles", () => {
    const camera = makeCamera();
    const angle = projectWorldAngleToScreenAngle(0, -280, -Math.PI / 2, camera, DEFAULT_PROJECTION_CONFIG);
    expect(Number.isFinite(angle)).toBe(true);
  });
});
