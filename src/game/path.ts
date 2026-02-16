const MAX_CURVATURE = 0.004;

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

export function createPathTrack(seed: number, totalDistance = 10000, step = 24): PathTrack {
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
      if (pick < 0.36) {
        targetCurvature = 0;
        modeCountdown = Math.floor(randRange(rng, 10, 24));
      } else if (pick < 0.79) {
        targetCurvature = nonZero(randRange(rng, -0.0012, 0.0012), 0.00045);
        modeCountdown = Math.floor(randRange(rng, 8, 18));
      } else {
        targetCurvature = nonZero(randRange(rng, -0.0034, 0.0034), 0.0016);
        modeCountdown = Math.floor(randRange(rng, 4, 11));
      }
    }

    curvature += (targetCurvature - curvature) * 0.13;
    curvature = clamp(curvature, -MAX_CURVATURE, MAX_CURVATURE);
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
      const curvatureValue = clamp(lerp(p0.curvature, p1.curvature, t), -MAX_CURVATURE, MAX_CURVATURE);
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
