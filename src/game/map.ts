import { THEME_CONFIG } from "./Constants";
import { createPathTrack, type PathTrack } from "./path";
import type {
  LandmarkKind,
  LandmarkSample,
  MapThemeId,
  MinimapSample,
  PathGenerationProfile,
} from "./types";

export interface VillageMap {
  seed: number;
  theme: MapThemeId;
  pathTrack: PathTrack;
  landmarks: LandmarkSample[];
}

interface WorldPoint {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashTheme(theme: MapThemeId): number {
  let hash = 2166136261;
  for (let index = 0; index < theme.length; index += 1) {
    hash ^= theme.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickLandmarkKind(theme: MapThemeId, rng: () => number): LandmarkKind {
  const bias = THEME_CONFIG[theme].landmarkBias;
  const roll = rng();
  if (roll < 0.52) {
    return bias[0];
  }
  if (roll < 0.78) {
    return bias[1];
  }
  if (roll < 0.92) {
    return bias[2];
  }
  return bias[3];
}

export function createVillageMap(
  seed: number,
  theme: MapThemeId,
  totalDistance = 14000,
  pathProfile?: PathGenerationProfile,
): VillageMap {
  const pathTrack = createPathTrack(seed, totalDistance, 24, pathProfile);
  const rng = mulberry32((seed ^ hashTheme(theme)) >>> 0);
  const landmarks: LandmarkSample[] = [];

  let cursor = 180 + rng() * 220;
  while (cursor < pathTrack.totalDistance - 180) {
    const sample = pathTrack.sampleAtDistance(cursor);
    landmarks.push({
      s: sample.s,
      x: sample.x,
      y: sample.y,
      angle: sample.angle,
      kind: pickLandmarkKind(theme, rng),
    });
    cursor += 210 + rng() * 280;
  }

  return {
    seed,
    theme,
    pathTrack,
    landmarks,
  };
}

export function buildMinimapSamples(
  pathTrack: PathTrack,
  centerDistance: number,
  sampleCount: number,
  behindDistance: number,
  aheadDistance: number,
): MinimapSample[] {
  if (sampleCount < 2) {
    return [];
  }

  const start = centerDistance - behindDistance;
  const end = centerDistance + aheadDistance;
  const points: WorldPoint[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / (sampleCount - 1);
    const distance = lerp(start, end, t);
    const sample = pathTrack.sampleAtDistance(distance);
    points.push({ x: sample.x, y: sample.y });
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const pad = 24;
  const spanX = Math.max(1, maxX - minX + pad * 2);
  const spanY = Math.max(1, maxY - minY + pad * 2);

  return points.map((point) => ({
    x: clamp((point.x - minX + pad) / spanX, 0, 1),
    y: clamp((point.y - minY + pad) / spanY, 0, 1),
  }));
}

export function collectNearbyLandmarks(
  landmarks: LandmarkSample[],
  centerDistance: number,
  behindDistance: number,
  aheadDistance: number,
): LandmarkSample[] {
  const minDistance = centerDistance - behindDistance;
  const maxDistance = centerDistance + aheadDistance;
  return landmarks
    .filter((landmark) => landmark.s >= minDistance && landmark.s <= maxDistance)
    .map((landmark) => ({ ...landmark }));
}
