import { THEME_CONFIG } from "../game/Constants";
import type { LandmarkSample, MapThemeId, MinimapSample } from "../game/types";
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
  playerSlot: number;
  mapTheme: MapThemeId;
  minimapSamples: MinimapSample[];
  landmarks: LandmarkSample[];
  playerDistance: number;
}

function formatSpeed(speed: number): string {
  return `${Math.round(speed)} px/s`;
}

export function HUDTopBar(props: HUDTopBarProps): JSX.Element {
  const progress = Math.max(0, Math.min(1, props.progress));
  const risk = Math.max(0, Math.min(1, props.risk));
  const themeLabel = THEME_CONFIG[props.mapTheme].label;

  return (
    <header
      className="hud-top-bar"
      style={{
        borderColor: `rgba(217, 46, 46, ${0.15 + risk * 0.55})`,
        boxShadow: risk > 0.6 ? theme.shadow.strong : theme.shadow.soft,
      }}
    >
      <section className="hud-block hud-left">
        <div className="hud-level-line">
          <div className="hud-label">关卡 {props.level}</div>
          <div className="hud-theme-tag">{themeLabel}</div>
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
        <div className={`hud-combo ${props.frenzy ? "frenzy" : ""}`}>连击 x{props.combo}</div>
      </section>
    </header>
  );
}
