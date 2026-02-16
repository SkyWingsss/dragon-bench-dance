import { GAMEOVER_WAVE_MS } from "./Constants";
import type { PhysicsSnapshot } from "./types";

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mixColor(start: [number, number, number], end: [number, number, number], t: number): string {
  const v = clamp(t, 0, 1);
  const r = Math.round(start[0] + (end[0] - start[0]) * v);
  const g = Math.round(start[1] + (end[1] - start[1]) * v);
  const b = Math.round(start[2] + (end[2] - start[2]) * v);
  return `rgb(${r}, ${g}, ${b})`;
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

  const trail: TrailPoint[] = [];
  const sparks: SparkParticle[] = [];

  const renderBackground = (): void => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#f8eed8");
    gradient.addColorStop(0.5, "#f5e2bc");
    gradient.addColorStop(1, "#f2d9a6");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 18; i += 1) {
      const y = ((elapsedSec * 18 + i * 65) % (height + 200)) - 100;
      const x = ((i * 97 + elapsedSec * 27) % (width + 240)) - 120;
      ctx.beginPath();
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#ffe6be";
      ctx.ellipse(x, y, 84, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const updateTrailAndSparks = (
    snapshot: PhysicsSnapshot,
    playerScreenX: number,
    playerScreenY: number,
    dtSec: number,
  ): void => {
    if (snapshot.frenzy) {
      trail.push({ x: playerScreenX, y: playerScreenY, life: 0.35 });
      if (trail.length > 34) {
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
      const alpha = clamp(p1.life / 0.35, 0, 1) * 0.55;
      ctx.strokeStyle = `rgba(231, 178, 64, ${alpha.toFixed(3)})`;
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

  const drawSegment = (
    x: number,
    y: number,
    angle: number,
    risk: number,
    isHead: boolean,
    isPlayer: boolean,
    shakeX: number,
    shakeY: number,
  ): void => {
    const jitter = isPlayer ? clamp(risk, 0, 1) * 2.2 : 0;

    ctx.save();
    ctx.translate(x + shakeX + jitter, y + shakeY - jitter * 0.5);
    ctx.rotate(angle);

    const boardWidth = isHead ? 62 : 52;
    const boardHeight = isHead ? 22 : 16;

    const baseColor: [number, number, number] = isHead ? [199, 44, 44] : [138, 91, 52];
    const riskColor: [number, number, number] = [217, 46, 46];
    const color = mixColor(baseColor, riskColor, isHead ? clamp(risk * 0.6, 0, 1) : clamp(risk, 0, 1));

    drawRoundedRect(ctx, -boardWidth / 2, -boardHeight / 2, boardWidth, boardHeight, 6);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = isHead ? "#f0c772" : "#f2cf95";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = isHead ? "#f3d178" : "#d8b07a";
    ctx.beginPath();
    ctx.arc(-boardWidth * 0.3, 0, 3.8, 0, Math.PI * 2);
    ctx.arc(boardWidth * 0.3, 0, 3.8, 0, Math.PI * 2);
    ctx.fill();

    if (isHead) {
      ctx.strokeStyle = "#f7dfa1";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(boardWidth * 0.34, -4);
      ctx.lineTo(boardWidth * 0.48, -12);
      ctx.moveTo(boardWidth * 0.34, 4);
      ctx.lineTo(boardWidth * 0.48, 12);
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

      renderBackground();

      if (snapshot.segments.length === 0) {
        return;
      }

      const head = snapshot.segments[0];
      const player = snapshot.segments.find((segment) => segment.isPlayer) ?? snapshot.segments[0];

      const baseShake = snapshot.frenzy ? 4 : clamp(snapshot.risk, 0, 1) * 3.8;
      const shakeLimit = clamp(baseShake + (snapshot.status === "gameover" ? 2 : 0), 0, 6);
      const shakeX = Math.sin(elapsedSec * 24) * shakeLimit;
      const shakeY = Math.cos(elapsedSec * 19) * shakeLimit * 0.55;

      const worldToScreen = (x: number, y: number): { x: number; y: number } => ({
        x: (x - head.x) + width * 0.5,
        y: (y - head.y) + height * 0.65,
      });

      const playerScreen = worldToScreen(player.x, player.y);
      updateTrailAndSparks(snapshot, playerScreen.x + shakeX, playerScreen.y + shakeY, dtSec);
      drawTrail();

      for (let index = snapshot.segments.length - 1; index >= 0; index -= 1) {
        const segment = snapshot.segments[index];
        const pos = worldToScreen(segment.x, segment.y);
        drawSegment(
          pos.x,
          pos.y,
          segment.angle,
          segment.risk,
          segment.isHead,
          segment.isPlayer,
          shakeX,
          shakeY,
        );
      }

      drawSparks();

      if (gameOverWaveMs > 0) {
        gameOverWaveMs = Math.max(0, gameOverWaveMs - dtSec * 1000);
        const progress = 1 - gameOverWaveMs / GAMEOVER_WAVE_MS;
        const radius = progress * Math.max(width, height) * 0.9;

        ctx.save();
        ctx.strokeStyle = `rgba(210, 40, 40, ${(0.48 * (1 - progress)).toFixed(3)})`;
        ctx.lineWidth = 16 * (1 - progress * 0.4);
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.65, radius, 0, Math.PI * 2);
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
