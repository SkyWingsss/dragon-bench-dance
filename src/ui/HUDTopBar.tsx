import { THEME_CONFIG } from "../game/Constants";
import type { DifficultyTier, LandmarkSample, MapThemeId, MinimapSample } from "../game/types";
import { MiniMap } from "./MiniMap";
import { theme } from "./theme";

interface HUDTopBarProps {
  level: number;
  score: number;
  speed: number;
  combo: number;
  progress: number;
  risk: number;
  frenzy: boolean;
  difficultyTier: DifficultyTier;
  cameraDepthNorm: number;
  playerSlot: number;
  mapTheme: MapThemeId;
  minimapSamples: MinimapSample[];
  landmarks: LandmarkSample[];
  playerDistance: number;
}

function formatSpeed(speed: number): string {
  return `${Math.round(speed)} px/s`;
}

function toRiskLabel(risk: number): string {
  if (risk >= 1) {
    return "离心过载";
  }
  if (risk >= 0.82) {
    return "极危";
  }
  if (risk >= 0.62) {
    return "高压";
  }
  if (risk >= 0.42) {
    return "紧张";
  }
  return "稳定";
}

export function HUDTopBar(props: HUDTopBarProps): JSX.Element {
  const progress = Math.max(0, Math.min(1, props.progress));
  const risk = Math.max(0, Math.min(1, props.risk));
  const depthNorm = Math.max(0, Math.min(1, props.cameraDepthNorm));
  const themeLabel = THEME_CONFIG[props.mapTheme].label;
  const riskLabel = toRiskLabel(props.risk);
  const levelLabel = props.level === 0 ? "教程关" : `关卡 ${props.level}`;

  return (
    <header
      className="hud-top-bar"
      style={{
        borderColor: `rgba(217, 46, 46, ${0.15 + risk * 0.55})`,
        boxShadow: risk > 0.6 ? theme.shadow.strong : theme.shadow.glow,
      }}
    >
      <section className="hud-block hud-left">
        <div className="hud-level-line">
          <div className="hud-label">{levelLabel}</div>
          <div className="hud-theme-tag">{themeLabel}</div>
          <div className="hud-difficulty-tag">{props.difficultyTier.toUpperCase()}</div>
        </div>
        <div
          className="hud-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="hud-progress-fill"
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
        <div className="hud-subline">
          <span>风险 {riskLabel}</span>
          <span>镜头深度 {(depthNorm * 100).toFixed(0)}%</span>
        </div>
        <MiniMap
          samples={props.minimapSamples}
          landmarks={props.landmarks}
          playerDistance={props.playerDistance}
          risk={props.risk}
        />
      </section>

      <section className="hud-block hud-mid">
        <div className="hud-label">分数</div>
        <div className="hud-score">{props.score.toLocaleString("zh-CN")}</div>
      </section>

      <section className="hud-block hud-right">
        <div className="hud-speed" style={{ fontFamily: theme.font.numeric }}>
          {formatSpeed(props.speed)}
        </div>
        <div className="hud-slot">负责 {props.playerSlot}号节位</div>
        <div className={`hud-risk-chip ${risk > 0.72 ? "hot" : ""}`}>{riskLabel}</div>
        <div className={`hud-combo ${props.frenzy ? "frenzy" : ""}`}>连击 x{props.combo}</div>
      </section>
    </header>
  );
}
