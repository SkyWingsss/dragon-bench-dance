import { MAP_MINIMAP_AHEAD, MAP_MINIMAP_BEHIND } from "../game/Constants";
import type { LandmarkSample, MinimapSample } from "../game/types";

interface MiniMapProps {
  samples: MinimapSample[];
  landmarks: LandmarkSample[];
  playerDistance: number;
  risk: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function MiniMap(props: MiniMapProps): JSX.Element | null {
  if (props.samples.length < 2) {
    return null;
  }

  const size = 78;
  const pad = 6;
  const inner = size - pad * 2;
  const route = props.samples
    .map((sample) => `${(pad + sample.x * inner).toFixed(2)},${(pad + sample.y * inner).toFixed(2)}`)
    .join(" ");
  const playerT = clamp(MAP_MINIMAP_BEHIND / (MAP_MINIMAP_AHEAD + MAP_MINIMAP_BEHIND), 0, 1);
  const playerIndex = Math.round(playerT * (props.samples.length - 1));
  const playerAnchor = props.samples[playerIndex];

  const visibleAheadLandmarks = props.landmarks
    .filter((landmark) => landmark.s >= props.playerDistance)
    .slice(0, 6)
    .map((landmark) => {
      const t = clamp(
        (landmark.s - (props.playerDistance - MAP_MINIMAP_BEHIND)) /
          (MAP_MINIMAP_AHEAD + MAP_MINIMAP_BEHIND),
        0,
        1,
      );
      const index = Math.round(t * (props.samples.length - 1));
      const anchor = props.samples[index];
      return {
        x: pad + anchor.x * inner,
        y: pad + anchor.y * inner,
      };
    });

  const riskAlpha = (0.25 + clamp(props.risk, 0, 1) * 0.4).toFixed(3);

  return (
    <div className="mini-map-wrap" aria-label="路线小地图">
      <svg
        className="mini-map-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="村路小地图"
        data-testid="mini-map"
      >
        <rect x={1} y={1} width={size - 2} height={size - 2} rx={12} className="mini-map-bg" />
        <polyline points={route} className="mini-map-path-shadow" />
        <polyline points={route} className="mini-map-path" />

        {visibleAheadLandmarks.map((landmark, index) => (
          <circle
            key={`${landmark.x.toFixed(1)}-${landmark.y.toFixed(1)}-${index}`}
            cx={landmark.x}
            cy={landmark.y}
            r={2.2}
            className="mini-map-landmark"
          />
        ))}

        <circle
          cx={pad + playerAnchor.x * inner}
          cy={pad + playerAnchor.y * inner}
          r={4}
          className="mini-map-player"
          style={{ stroke: `rgba(217, 46, 46, ${riskAlpha})` }}
        />
      </svg>
    </div>
  );
}
