interface GameOverPanelProps {
  visible: boolean;
  score: number;
  maxCombo: number;
  failSpeed: number;
  breakDelta: number;
  onRetry: () => void;
  onBack: () => void;
}

function formatDelta(breakDelta: number): string {
  const prefix = breakDelta >= 0 ? "+" : "";
  return `${prefix}${breakDelta.toFixed(1)} px`;
}

export function GameOverPanel(props: GameOverPanelProps): JSX.Element | null {
  if (!props.visible) {
    return null;
  }

  return (
    <section className="overlay-card gameover-panel" role="dialog" aria-label="失败结算">
      <h2>龙身断裂</h2>
      <div className="stats-grid">
        <div>
          <span className="stat-label">分数</span>
          <strong>{props.score.toLocaleString("zh-CN")}</strong>
        </div>
        <div>
          <span className="stat-label">最高连击</span>
          <strong>x{props.maxCombo}</strong>
        </div>
        <div>
          <span className="stat-label">失败速度</span>
          <strong>{Math.round(props.failSpeed)} px/s</strong>
        </div>
        <div>
          <span className="stat-label">阈值差值</span>
          <strong data-testid="break-delta">{formatDelta(props.breakDelta)}</strong>
        </div>
      </div>

      <div className="panel-actions">
        <button type="button" className="primary-button" onClick={props.onRetry}>
          重来
        </button>
        <button type="button" className="ghost-button" onClick={props.onBack}>
          返回关卡选择
        </button>
      </div>
    </section>
  );
}
