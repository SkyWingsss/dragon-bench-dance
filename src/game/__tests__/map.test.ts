import { describe, expect, it } from "vitest";
import {
  MAP_LANDMARK_AHEAD,
  MAP_LANDMARK_BEHIND,
  MAP_MINIMAP_AHEAD,
  MAP_MINIMAP_BEHIND,
  MAP_MINIMAP_SAMPLE_COUNT,
} from "../Constants";
import { buildMinimapSamples, collectNearbyLandmarks, createVillageMap } from "../map";

describe("village map generation", () => {
  it("produces deterministic geometry for the same seed and theme", () => {
    const first = createVillageMap(424242, "whitewall-alley", 9000);
    const second = createVillageMap(424242, "whitewall-alley", 9000);

    expect(first.landmarks.slice(0, 8)).toEqual(second.landmarks.slice(0, 8));
    expect(first.pathTrack.sampleAtDistance(3600)).toEqual(second.pathTrack.sampleAtDistance(3600));
  });

  it("produces different landmarks for different seeds", () => {
    const first = createVillageMap(424242, "whitewall-alley", 9000);
    const second = createVillageMap(515151, "whitewall-alley", 9000);

    expect(first.landmarks[0]?.s).not.toBe(second.landmarks[0]?.s);
  });

  it("keeps minimap and nearby landmark sampling finite", () => {
    const map = createVillageMap(90210, "ancestral-street", 12000);
    const centerDistance = 5600;

    const minimap = buildMinimapSamples(
      map.pathTrack,
      centerDistance,
      MAP_MINIMAP_SAMPLE_COUNT,
      MAP_MINIMAP_BEHIND,
      MAP_MINIMAP_AHEAD,
    );
    const nearby = collectNearbyLandmarks(
      map.landmarks,
      centerDistance,
      MAP_LANDMARK_BEHIND,
      MAP_LANDMARK_AHEAD,
    );

    expect(minimap.length).toBe(MAP_MINIMAP_SAMPLE_COUNT);
    for (const sample of minimap) {
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.y)).toBe(true);
      expect(sample.x).toBeGreaterThanOrEqual(0);
      expect(sample.x).toBeLessThanOrEqual(1);
      expect(sample.y).toBeGreaterThanOrEqual(0);
      expect(sample.y).toBeLessThanOrEqual(1);
    }

    for (const landmark of nearby) {
      expect(Number.isFinite(landmark.x)).toBe(true);
      expect(Number.isFinite(landmark.y)).toBe(true);
      expect(Number.isFinite(landmark.s)).toBe(true);
      expect(Number.isFinite(landmark.angle)).toBe(true);
    }
  });
});
