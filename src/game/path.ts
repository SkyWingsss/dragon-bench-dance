import type { PathGenerationProfile } from "./types";

const DEFAULT_PROFILE: PathGenerationProfile = {
  maxCurvature: 0.004,
  straightProbability: 0.36,
  gentleProbability: 0.79,
  straightLengthRange: [10, 24],
  gentleLengthRange: [8, 18],
  sharpLengthRange: [4, 11],
  gentleCurvatureRange: [-0.0012, 0.0012],
  sharpCurvatureRange: [-0.0034, 0.0034],
  smoothingFactor: 0.13,
};

export interface PathSample {
  s: number;
  x: number;
  y: number;
  angle: number;
  curvature: number;
  tangent: { x: number; y: number };
  normal: { x: number; y: number };
}

interface PathPoint {
  s: number;
  x: number;
  y: number;
  angle: number;
  curvature: number;
}

export interface PathTrack {
  readonly step: number;
  readonly totalDistance: number;
  sampleAtDistance(distance: number): PathSample;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function nonZero(value: number, epsilon: number): number {
  if (Math.abs(value) >= epsilon) {
    return value;
  }
  return value >= 0 ? epsilon : -epsilon;
}

function clampRange(range: readonly [number, number], fallback: readonly [number, number]): readonly [number, number] {
  const min = Number.isFinite(range[0]) ? range[0] : fallback[0];
  const max = Number.isFinite(range[1]) ? range[1] : fallback[1];
  if (max <= min) {
    return fallback;
  }
  return [min, max];
}

function normalizeProfile(profile?: PathGenerationProfile): PathGenerationProfile {
  if (!profile) {
    return DEFAULT_PROFILE;
  }

  const straightProbability = clamp(
    Number.isFinite(profile.straightProbability)
      ? profile.straightProbability
      : DEFAULT_PROFILE.straightProbability,
    0.02,
    0.9,
  );
  const gentleProbability = clamp(
    Number.isFinite(profile.gentleProbability)
      ? profile.gentleProbability
      : DEFAULT_PROFILE.gentleProbability,
    Math.max(0.04, straightProbability + 0.02),
    0.96,
  );

  return {
    maxCurvature: Math.max(0.001, profile.maxCurvature || DEFAULT_PROFILE.maxCurvature),
    straightProbability,
    gentleProbability,
    straightLengthRange: clampRange(profile.straightLengthRange, DEFAULT_PROFILE.straightLengthRange),
    gentleLengthRange: clampRange(profile.gentleLengthRange, DEFAULT_PROFILE.gentleLengthRange),
    sharpLengthRange: clampRange(profile.sharpLengthRange, DEFAULT_PROFILE.sharpLengthRange),
    gentleCurvatureRange: clampRange(profile.gentleCurvatureRange, DEFAULT_PROFILE.gentleCurvatureRange),
    sharpCurvatureRange: clampRange(profile.sharpCurvatureRange, DEFAULT_PROFILE.sharpCurvatureRange),
    smoothingFactor: clamp(profile.smoothingFactor, 0.02, 0.5),
  };
}

export function createPathTrack(
  seed: number,
  totalDistance = 10000,
  step = 24,
  profile?: PathGenerationProfile,
): PathTrack {
  const generationProfile = normalizeProfile(profile);
  const rng = mulberry32(seed);
  const count = Math.ceil(totalDistance / step) + 2;
  const points: PathPoint[] = [];

  let x = 0;
  let y = 0;
  let angle = -Math.PI / 2;
  let curvature = 0;
  let targetCurvature = 0;
  let modeCountdown = 0;

  points.push({ s: 0, x, y, angle, curvature });

  for (let i = 1; i <= count; i += 1) {
    if (modeCountdown <= 0) {
      const pick = rng();
      if (pick < generationProfile.straightProbability) {
        targetCurvature = 0;
        modeCountdown = Math.floor(
          randRange(rng, generationProfile.straightLengthRange[0], generationProfile.straightLengthRange[1]),
        );
      } else if (pick < generationProfile.gentleProbability) {
        const gentleEpsilon = Math.max(
          0.00035,
          Math.min(
            Math.abs(generationProfile.gentleCurvatureRange[0]),
            Math.abs(generationProfile.gentleCurvatureRange[1]),
          ) * 0.35,
        );
        targetCurvature = nonZero(
          randRange(
            rng,
            generationProfile.gentleCurvatureRange[0],
            generationProfile.gentleCurvatureRange[1],
          ),
          gentleEpsilon,
        );
        modeCountdown = Math.floor(
          randRange(rng, generationProfile.gentleLengthRange[0], generationProfile.gentleLengthRange[1]),
        );
      } else {
        const sharpEpsilon = Math.max(
          0.0008,
          Math.min(
            Math.abs(generationProfile.sharpCurvatureRange[0]),
            Math.abs(generationProfile.sharpCurvatureRange[1]),
          ) * 0.45,
        );
        targetCurvature = nonZero(
          randRange(rng, generationProfile.sharpCurvatureRange[0], generationProfile.sharpCurvatureRange[1]),
          sharpEpsilon,
        );
        modeCountdown = Math.floor(
          randRange(rng, generationProfile.sharpLengthRange[0], generationProfile.sharpLengthRange[1]),
        );
      }
    }

    curvature += (targetCurvature - curvature) * generationProfile.smoothingFactor;
    curvature = clamp(curvature, -generationProfile.maxCurvature, generationProfile.maxCurvature);
    angle += curvature * step;

    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;

    const s = i * step;
    points.push({
      s,
      x,
      y,
      angle,
      curvature,
    });

    modeCountdown -= 1;
  }

  const maxDistance = points[points.length - 1]?.s ?? totalDistance;

  return {
    step,
    totalDistance: maxDistance,
    sampleAtDistance(distance: number): PathSample {
      const d = clamp(distance, 0, maxDistance);
      const index = clamp(Math.floor(d / step), 0, points.length - 2);
      const p0 = points[index];
      const p1 = points[index + 1];
      const t = clamp((d - p0.s) / step, 0, 1);

      const angleValue = lerp(p0.angle, p1.angle, t);
      const curvatureValue = clamp(
        lerp(p0.curvature, p1.curvature, t),
        -generationProfile.maxCurvature,
        generationProfile.maxCurvature,
      );
      const xValue = lerp(p0.x, p1.x, t);
      const yValue = lerp(p0.y, p1.y, t);

      const tangent = {
        x: Math.cos(angleValue),
        y: Math.sin(angleValue),
      };

      const normal = {
        x: -tangent.y,
        y: tangent.x,
      };

      return {
        s: d,
        x: xValue,
        y: yValue,
        angle: angleValue,
        curvature: curvatureValue,
        tangent,
        normal,
      };
    },
  };
}
