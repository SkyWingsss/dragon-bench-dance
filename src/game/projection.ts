export interface ProjectionConfig {
  frontView: number;
  backView: number;
  nearYRatio: number;
  horizonYRatio: number;
  nearScale: number;
  farScale: number;
}

export interface CameraFrame {
  x: number;
  y: number;
  forwardAngle: number;
  width: number;
  height: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  side: number;
  forward: number;
  scale: number;
}

export const DEFAULT_PROJECTION_CONFIG: ProjectionConfig = {
  frontView: 980,
  backView: 260,
  nearYRatio: 0.9,
  horizonYRatio: 0.24,
  nearScale: 1.42,
  farScale: 0.46,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function projectWorldPoint25D(
  worldX: number,
  worldY: number,
  camera: CameraFrame,
  config: ProjectionConfig = DEFAULT_PROJECTION_CONFIG,
): ProjectedPoint {
  const tangentX = Math.cos(camera.forwardAngle);
  const tangentY = Math.sin(camera.forwardAngle);
  const normalX = -tangentY;
  const normalY = tangentX;

  const deltaX = worldX - camera.x;
  const deltaY = worldY - camera.y;

  const side = deltaX * normalX + deltaY * normalY;
  const forward = deltaX * tangentX + deltaY * tangentY;
  const depth = clamp((forward + config.backView) / (config.frontView + config.backView), 0, 1);

  const nearY = camera.height * config.nearYRatio;
  const horizonY = camera.height * config.horizonYRatio;
  const scale = lerp(config.nearScale, config.farScale, depth);

  return {
    x: camera.width * 0.5 + side * scale,
    y: lerp(nearY, horizonY, depth),
    depth,
    side,
    forward,
    scale,
  };
}

export function projectWorldAngleToScreenAngle(
  worldX: number,
  worldY: number,
  worldAngle: number,
  camera: CameraFrame,
  config: ProjectionConfig = DEFAULT_PROJECTION_CONFIG,
): number {
  const p0 = projectWorldPoint25D(worldX, worldY, camera, config);
  const step = 18;
  const p1 = projectWorldPoint25D(
    worldX + Math.cos(worldAngle) * step,
    worldY + Math.sin(worldAngle) * step,
    camera,
    config,
  );

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  if (Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5) {
    return -Math.PI / 2;
  }
  return Math.atan2(dy, dx);
}
