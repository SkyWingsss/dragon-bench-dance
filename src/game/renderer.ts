import {
  GAMEOVER_WAVE_MS,
  TAIL_SWAY_BASE_DEG,
  TAIL_SWAY_FREQ_HZ,
  TAIL_SWAY_RISK_BONUS_DEG,
  THEME_CONFIG,
  VISUAL_WAVE_AMPLITUDE_PX,
  VISUAL_WAVE_FREQ_HZ,
} from "./Constants";
import type { DragonSegmentFrame, LandmarkSample, PhysicsSnapshot, RoadFrameSample } from "./types";

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
}

interface Point {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mixColor(start: [number, number, number], end: [number, number, number], t: number): string {
  const ratio = clamp(t, 0, 1);
  const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
  const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
  const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function hashNoise(input: number, seed: number): number {
  const raw = Math.sin(input * 12.9898 + seed * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawClosedPolygon(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 3) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

function getNormal(angle: number): Point {
  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

function getTangent(angle: number): Point {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function buildRoadStrip(
  samples: RoadFrameSample[],
  offset: number,
  worldToScreen: (x: number, y: number) => Point,
): Point[] {
  const points: Point[] = [];
  for (const sample of samples) {
    const normal = getNormal(sample.angle);
    points.push(worldToScreen(sample.x + normal.x * offset, sample.y + normal.y * offset));
  }
  return points;
}

export interface DragonRenderer {
  resize(width: number, height: number, pixelRatio: number): void;
  render(snapshot: PhysicsSnapshot, dtSec: number): void;
  dispose(): void;
}

export function createDragonRenderer(canvas: HTMLCanvasElement): DragonRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }

  let width = 0;
  let height = 0;
  let dpr = 1;

  let elapsedSec = 0;
  let previousStatus: PhysicsSnapshot["status"] = "ready";
  let gameOverWaveMs = 0;

  let cameraX = 0;
  let cameraY = 0;
  let cameraInitialized = false;

  const trail: TrailPoint[] = [];
  const sparks: SparkParticle[] = [];

  const renderGround = (snapshot: PhysicsSnapshot): void => {
    const theme = THEME_CONFIG[snapshot.mapTheme];
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#f7ecd7");
    gradient.addColorStop(0.58, "#f0dfbe");
    gradient.addColorStop(1, "#e7ce9f");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let i = 0; i < 120; i += 1) {
      const x = ((i * 47.3 + elapsedSec * 15) % (width + 120)) - 60;
      const y = ((i * 73.1 + elapsedSec * 8) % (height + 120)) - 60;
      const alpha = 0.04 + hashNoise(i, 13) * 0.05;
      ctx.fillStyle = `rgba(127, 94, 61, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.9 + hashNoise(i, 4) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = theme.roofColor;
    for (let i = 0; i < 18; i += 1) {
      const y = (height / 18) * i;
      ctx.fillRect(0, y, width, 1);
    }
    ctx.restore();
  };

  const drawRoad = (
    samples: RoadFrameSample[],
    worldToScreen: (x: number, y: number) => Point,
    shakeX: number,
    shakeY: number,
    snapshot: PhysicsSnapshot,
  ): void => {
    if (samples.length < 2) {
      return;
    }

    const theme = THEME_CONFIG[snapshot.mapTheme];
    const shoulderHalf = 78;
    const roadHalf = 52;

    const leftShoulder = buildRoadStrip(samples, shoulderHalf, worldToScreen);
    const rightShoulder = buildRoadStrip(samples, -shoulderHalf, worldToScreen);
    const leftRoad = buildRoadStrip(samples, roadHalf, worldToScreen);
    const rightRoad = buildRoadStrip(samples, -roadHalf, worldToScreen);

    const shoulderPolygon = leftShoulder.concat([...rightShoulder].reverse());
    const roadPolygon = leftRoad.concat([...rightRoad].reverse());

    ctx.save();
    ctx.translate(shakeX * 0.24, shakeY * 0.2);

    drawClosedPolygon(ctx, shoulderPolygon);
    ctx.fillStyle = theme.shoulderColor;
    ctx.fill();

    drawClosedPolygon(ctx, roadPolygon);
    ctx.fillStyle = theme.roadColor;
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#d9b687";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 1) {
      const p = worldToScreen(samples[i].x, samples[i].y);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#efd5a9";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([11, 15]);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 1) {
        const normal = getNormal(samples[i].angle);
        const p = worldToScreen(samples[i].x + normal.x * side * 18, samples[i].y + normal.y * side * 18);
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    ctx.setLineDash([]);

    const warningAlpha = clamp(snapshot.risk, 0, 1) * 0.45;
    if (warningAlpha > 0.01) {
      ctx.globalAlpha = warningAlpha;
      ctx.strokeStyle = "#d93a2f";
      ctx.lineWidth = 2.3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i < samples.length; i += 1) {
          const normal = getNormal(samples[i].angle);
          const p = worldToScreen(samples[i].x + normal.x * side * 53, samples[i].y + normal.y * side * 53);
          if (i === 0) {
            ctx.moveTo(p.x, p.y);
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const drawWallCorridor = (
    samples: RoadFrameSample[],
    worldToScreen: (x: number, y: number) => Point,
    shakeX: number,
    shakeY: number,
    snapshot: PhysicsSnapshot,
  ): void => {
    if (samples.length < 2) {
      return;
    }

    const theme = THEME_CONFIG[snapshot.mapTheme];
    const wallOffset = 108;

    ctx.save();
    ctx.translate(shakeX * 0.18, shakeY * 0.14);

    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 1) {
        const normal = getNormal(samples[i].angle);
        const p = worldToScreen(
          samples[i].x + normal.x * side * wallOffset,
          samples[i].y + normal.y * side * wallOffset,
        );
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = theme.wallColor;
      ctx.lineWidth = 30;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 1) {
        const normal = getNormal(samples[i].angle);
        const p = worldToScreen(
          samples[i].x + normal.x * side * (wallOffset + 8),
          samples[i].y + normal.y * side * (wallOffset + 8),
        );
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = theme.roofColor;
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.strokeStyle = "rgba(43, 30, 24, 0.35)";
      ctx.lineWidth = 1.5;
      for (let i = 2; i < samples.length - 1; i += 4) {
        const sample = samples[i];
        const normal = getNormal(sample.angle);
        const tangent = getTangent(sample.angle);
        const center = worldToScreen(
          sample.x + normal.x * side * (wallOffset - 3),
          sample.y + normal.y * side * (wallOffset - 3),
        );
        ctx.beginPath();
        ctx.moveTo(center.x - tangent.x * 9, center.y - tangent.y * 9);
        ctx.lineTo(center.x + tangent.x * 9, center.y + tangent.y * 9);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  const drawVillageBackdrop = (
    samples: RoadFrameSample[],
    worldToScreen: (x: number, y: number) => Point,
    shakeX: number,
    shakeY: number,
  ): void => {
    if (samples.length < 2) {
      return;
    }

    ctx.save();
    ctx.translate(shakeX * 0.14, shakeY * 0.1);

    for (let i = 1; i < samples.length; i += 2) {
      const sample = samples[i];
      const normal = getNormal(sample.angle);
      const tangent = getTangent(sample.angle);
      const depth = clamp(i / samples.length, 0.15, 1);
      const scale = 0.56 + depth * 0.7;
      const alpha = 0.2 + depth * 0.5;

      for (const side of [-1, 1]) {
        const visibility = hashNoise(sample.s * 0.017 + side * 9, 21);
        if (visibility < 0.45) {
          continue;
        }

        const offset = 160 + hashNoise(sample.s * 0.021 + side * 13, 33) * 72;
        const drift = (hashNoise(sample.s * 0.014 + side * 7, 41) - 0.5) * 16;
        const base = worldToScreen(
          sample.x + normal.x * side * offset + tangent.x * drift,
          sample.y + normal.y * side * offset + tangent.y * drift,
        );

        if (base.x < -140 || base.x > width + 140 || base.y < -120 || base.y > height + 140) {
          continue;
        }

        const w = 34 * scale;
        const h = 22 * scale;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#6f513c";
        drawRoundedRect(ctx, base.x - w * 0.5, base.y - h, w, h, 3 * scale);
        ctx.fill();

        ctx.fillStyle = "#2b3034";
        ctx.beginPath();
        ctx.moveTo(base.x - w * 0.58, base.y - h + 2 * scale);
        ctx.lineTo(base.x + w * 0.58, base.y - h + 2 * scale);
        ctx.lineTo(base.x, base.y - h - 10 * scale);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const drawLandmark = (
    landmark: LandmarkSample,
    worldToScreen: (x: number, y: number) => Point,
    shakeX: number,
    shakeY: number,
  ): void => {
    const p = worldToScreen(landmark.x, landmark.y);
    if (p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) {
      return;
    }

    const angle = landmark.angle;
    const tangent = getTangent(angle);
    const normal = getNormal(angle);

    ctx.save();
    ctx.translate(p.x + shakeX * 0.16, p.y + shakeY * 0.12);

    if (landmark.kind === "arch") {
      ctx.strokeStyle = "#7b5034";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-normal.x * 20 - tangent.x * 12, -normal.y * 20 - tangent.y * 12);
      ctx.lineTo(-normal.x * 20 + tangent.x * 10, -normal.y * 20 + tangent.y * 10);
      ctx.moveTo(normal.x * 20 - tangent.x * 12, normal.y * 20 - tangent.y * 12);
      ctx.lineTo(normal.x * 20 + tangent.x * 10, normal.y * 20 + tangent.y * 10);
      ctx.stroke();

      ctx.strokeStyle = "#2c2f33";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-normal.x * 20 - tangent.x * 9, -normal.y * 20 - tangent.y * 9);
      ctx.lineTo(normal.x * 20 - tangent.x * 9, normal.y * 20 - tangent.y * 9);
      ctx.stroke();
    } else if (landmark.kind === "lantern") {
      ctx.strokeStyle = "#5f3d28";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-normal.x * 22, -normal.y * 22);
      ctx.stroke();

      const lx = -normal.x * 24;
      const ly = -normal.y * 24;
      ctx.fillStyle = "#e0a12e";
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a5482d";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (landmark.kind === "stone-bridge") {
      ctx.strokeStyle = "#857061";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-normal.x * 18, -normal.y * 18);
      ctx.quadraticCurveTo(0, -12, normal.x * 18, normal.y * 18);
      ctx.stroke();
    } else {
      const sx = normal.x * 20;
      const sy = normal.y * 20;
      ctx.strokeStyle = "#704a32";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-sx, -sy);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = "#f2d39a";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - tangent.x * 11 + normal.x * 5, sy - tangent.y * 11 + normal.y * 5);
      ctx.lineTo(sx - tangent.x * 11 - normal.x * 5, sy - tangent.y * 11 - normal.y * 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#533824";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawLandmarks = (
    landmarks: LandmarkSample[],
    worldToScreen: (x: number, y: number) => Point,
    shakeX: number,
    shakeY: number,
  ): void => {
    for (const landmark of landmarks) {
      drawLandmark(landmark, worldToScreen, shakeX, shakeY);
    }
  };

  const updateTrailAndSparks = (
    snapshot: PhysicsSnapshot,
    playerScreenX: number,
    playerScreenY: number,
    dtSec: number,
  ): void => {
    if (snapshot.frenzy) {
      trail.push({ x: playerScreenX, y: playerScreenY, life: 0.35 });
      if (trail.length > 36) {
        trail.shift();
      }

      const burst = snapshot.risk > 0.7 ? 2 : 1;
      for (let i = 0; i < burst; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 34 + Math.random() * 72;
        sparks.push({
          x: playerScreenX,
          y: playerScreenY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          life: 0.35,
          ttl: 0.35,
          size: 1.2 + Math.random() * 1.8,
        });
      }
    }

    for (let i = trail.length - 1; i >= 0; i -= 1) {
      trail[i].life -= dtSec;
      if (trail[i].life <= 0) {
        trail.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.life -= dtSec;
      spark.x += spark.vx * dtSec;
      spark.y += spark.vy * dtSec;
      spark.vy += 60 * dtSec;
      spark.vx *= 0.98;
      if (spark.life <= 0) {
        sparks.splice(i, 1);
      }
    }
  };

  const drawTrail = (): void => {
    if (trail.length < 2) {
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i += 1) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const alpha = clamp(p1.life / 0.35, 0, 1) * 0.6;
      ctx.strokeStyle = `rgba(232, 170, 54, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 2 + alpha * 6;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawSparks = (): void => {
    if (sparks.length === 0) {
      return;
    }

    ctx.save();
    for (const spark of sparks) {
      const alpha = clamp(spark.life / spark.ttl, 0, 1);
      ctx.fillStyle = `rgba(224, 161, 46, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const calcWaveOffset = (segment: DragonSegmentFrame): number => {
    if (segment.role !== "body") {
      return 0;
    }
    const phase = elapsedSec * VISUAL_WAVE_FREQ_HZ * Math.PI * 2 + segment.index * 0.72;
    const attenuation = 1 - clamp(segment.risk, 0, 1) * 0.25;
    return Math.sin(phase) * VISUAL_WAVE_AMPLITUDE_PX * attenuation;
  };

  const calcTailSwayRotation = (segmentIndex: number, globalRisk: number, segmentRisk: number): number => {
    const riskBlend = clamp(globalRisk * 0.75 + segmentRisk * 0.55, 0, 1.4);
    const amplitudeDeg = TAIL_SWAY_BASE_DEG + riskBlend * TAIL_SWAY_RISK_BONUS_DEG;
    const phase = elapsedSec * TAIL_SWAY_FREQ_HZ * Math.PI * 2 + segmentIndex * 0.86;
    return Math.sin(phase) * amplitudeDeg * (Math.PI / 180);
  };

  const drawPlayerHalo = (x: number, y: number, risk: number, shakeX: number, shakeY: number): void => {
    const pulse = 1 + Math.sin(elapsedSec * 7) * 0.12;
    const radius = 21 * pulse + clamp(risk, 0, 1) * 8;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.strokeStyle = `rgba(248, 211, 126, ${(0.55 + clamp(risk, 0, 1) * 0.35).toFixed(3)})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(204, 52, 52, ${(0.2 + clamp(risk, 0, 1) * 0.5).toFixed(3)})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  const drawPlayerFlag = (
    x: number,
    y: number,
    slot: number,
    risk: number,
    shakeX: number,
    shakeY: number,
  ): void => {
    ctx.save();
    ctx.translate(shakeX * 0.35, shakeY * 0.35);

    const poleTopY = y - 36;
    ctx.strokeStyle = "rgba(78, 49, 32, 0.95)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, poleTopY);
    ctx.stroke();

    ctx.fillStyle = `rgba(231, 168, 64, ${(0.75 + clamp(risk, 0, 1) * 0.2).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x, poleTopY);
    ctx.lineTo(x + 16, poleTopY + 5);
    ctx.lineTo(x, poleTopY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#2f1f13";
    ctx.font = '10px "Noto Sans SC", "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${slot}号`, x + 18, poleTopY + 5);

    ctx.restore();
  };

  const drawSegment = (
    x: number,
    y: number,
    angle: number,
    risk: number,
    role: DragonSegmentFrame["role"],
    segmentIndex: number,
    globalRisk: number,
    isPlayer: boolean,
    shakeX: number,
    shakeY: number,
  ): void => {
    const jitter = isPlayer ? clamp(risk, 0, 1) * 2.2 : 0;

    ctx.save();
    ctx.translate(x + shakeX + jitter, y + shakeY - jitter * 0.45);
    ctx.rotate(angle);

    const isHead = role === "head";
    const isTail = role === "tail";
    if (isTail) {
      ctx.rotate(calcTailSwayRotation(segmentIndex, globalRisk, risk));
    }

    const boardWidth = isHead ? 62 : isTail ? 44 : 52;
    const boardHeight = isHead ? 22 : isTail ? 14 : 16;

    const baseColor: [number, number, number] = isHead
      ? [199, 44, 44]
      : isTail
        ? [122, 78, 46]
        : [138, 91, 52];
    const riskColor: [number, number, number] = [217, 46, 46];
    const color = mixColor(baseColor, riskColor, isHead ? clamp(risk * 0.6, 0, 1) : clamp(risk, 0, 1));

    drawRoundedRect(ctx, -boardWidth / 2, -boardHeight / 2, boardWidth, boardHeight, 6);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.globalAlpha = isPlayer ? 0.95 : 0.74;
    ctx.strokeStyle = isHead ? "#f0c772" : isPlayer ? "#ffd889" : "#f2cf95";
    ctx.lineWidth = isPlayer ? 2 : 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = isHead ? "#f3d178" : "#d8b07a";
    ctx.beginPath();
    ctx.arc(-boardWidth * 0.3, 0, 3.5, 0, Math.PI * 2);
    ctx.arc(boardWidth * 0.3, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (isHead) {
      ctx.fillStyle = "#bd2d2d";
      ctx.beginPath();
      ctx.moveTo(boardWidth * 0.48, 0);
      ctx.lineTo(boardWidth * 0.76, -6);
      ctx.lineTo(boardWidth * 0.76, 6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#f7dfa1";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(boardWidth * 0.15, -boardHeight * 0.62);
      ctx.lineTo(boardWidth * 0.26, -boardHeight * 1.05);
      ctx.moveTo(boardWidth * 0.15, boardHeight * 0.62);
      ctx.lineTo(boardWidth * 0.26, boardHeight * 1.05);
      ctx.moveTo(boardWidth * 0.25, -3);
      ctx.lineTo(boardWidth * 0.5, -12);
      ctx.moveTo(boardWidth * 0.25, 3);
      ctx.lineTo(boardWidth * 0.5, 12);
      ctx.stroke();
    }

    if (isTail) {
      const swingBoost = 1 + clamp(globalRisk, 0, 1.25) * 0.9;

      ctx.fillStyle = "#8f623f";
      ctx.beginPath();
      ctx.moveTo(-boardWidth * 0.52, 0);
      ctx.lineTo(-boardWidth * (0.9 + swingBoost * 0.1), -5 * swingBoost);
      ctx.lineTo(-boardWidth * (0.9 + swingBoost * 0.1), 5 * swingBoost);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#e0b576";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-boardWidth * 0.78, -2);
      ctx.lineTo(-boardWidth * (1.05 + swingBoost * 0.12), -7 * swingBoost);
      ctx.moveTo(-boardWidth * 0.78, 2);
      ctx.lineTo(-boardWidth * (1.05 + swingBoost * 0.12), 7 * swingBoost);
      ctx.stroke();
    }

    ctx.restore();
  };

  return {
    resize(nextWidth: number, nextHeight: number, pixelRatio: number): void {
      width = Math.max(1, Math.floor(nextWidth));
      height = Math.max(1, Math.floor(nextHeight));
      dpr = Math.max(1, Math.min(2.5, pixelRatio));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    },

    render(snapshot: PhysicsSnapshot, dtSec: number): void {
      if (width <= 0 || height <= 0) {
        return;
      }

      elapsedSec += dtSec;

      if (snapshot.status === "gameover" && previousStatus !== "gameover") {
        gameOverWaveMs = GAMEOVER_WAVE_MS;
      }
      previousStatus = snapshot.status;

      if (!cameraInitialized) {
        cameraX = snapshot.cameraAnchor.x;
        cameraY = snapshot.cameraAnchor.y;
        cameraInitialized = true;
      }

      const followLerp = clamp(dtSec * 8.5, 0.08, 0.42);
      cameraX += (snapshot.cameraAnchor.x - cameraX) * followLerp;
      cameraY += (snapshot.cameraAnchor.y - cameraY) * followLerp;

      const baseShake = snapshot.frenzy ? 4 : clamp(snapshot.risk, 0, 1) * 3.8;
      const shakeLimit = clamp(baseShake + (snapshot.status === "gameover" ? 2 : 0), 0, 6);
      const shakeX = Math.sin(elapsedSec * 24) * shakeLimit;
      const shakeY = Math.cos(elapsedSec * 19) * shakeLimit * 0.55;

      const worldToScreen = (x: number, y: number): Point => ({
        x: x - cameraX + width * 0.5,
        y: y - cameraY + height * 0.62,
      });

      renderGround(snapshot);
      drawVillageBackdrop(snapshot.roadSamples, worldToScreen, shakeX, shakeY);
      drawWallCorridor(snapshot.roadSamples, worldToScreen, shakeX, shakeY, snapshot);
      drawRoad(snapshot.roadSamples, worldToScreen, shakeX, shakeY, snapshot);
      drawLandmarks(snapshot.landmarks, worldToScreen, shakeX, shakeY);

      if (snapshot.segments.length === 0) {
        return;
      }

      const player = snapshot.segments.find((segment) => segment.isPlayer) ?? snapshot.segments[0];
      const playerNormal = getNormal(player.angle);
      const playerWave = calcWaveOffset(player);
      const playerWorldX = player.x + playerNormal.x * playerWave;
      const playerWorldY = player.y + playerNormal.y * playerWave;
      const playerScreen = worldToScreen(playerWorldX, playerWorldY);

      updateTrailAndSparks(snapshot, playerScreen.x + shakeX, playerScreen.y + shakeY, dtSec);
      drawTrail();

      for (let index = snapshot.segments.length - 1; index >= 0; index -= 1) {
        const segment = snapshot.segments[index];
        const normal = getNormal(segment.angle);
        const wave = calcWaveOffset(segment);
        const pos = worldToScreen(segment.x + normal.x * wave, segment.y + normal.y * wave);
        drawSegment(
          pos.x,
          pos.y,
          segment.angle,
          segment.risk,
          segment.role,
          segment.index,
          snapshot.risk,
          segment.isPlayer,
          shakeX,
          shakeY,
        );
      }

      drawPlayerHalo(playerScreen.x, playerScreen.y, snapshot.risk, shakeX, shakeY);
      drawPlayerFlag(playerScreen.x, playerScreen.y, snapshot.playerSlot, snapshot.risk, shakeX, shakeY);
      drawSparks();

      if (gameOverWaveMs > 0) {
        gameOverWaveMs = Math.max(0, gameOverWaveMs - dtSec * 1000);
        const progress = 1 - gameOverWaveMs / GAMEOVER_WAVE_MS;
        const radius = progress * Math.max(width, height) * 0.9;

        ctx.save();
        ctx.strokeStyle = `rgba(210, 40, 40, ${(0.48 * (1 - progress)).toFixed(3)})`;
        ctx.lineWidth = 16 * (1 - progress * 0.4);
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.62, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },

    dispose(): void {
      trail.length = 0;
      sparks.length = 0;
    },
  };
}
