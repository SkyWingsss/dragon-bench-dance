interface GameOverPanelProps {
  visible: boolean;
  score: number;
  maxCombo: number;
  failSpeed: number;
  breakDelta: number;
  playerSlot: number;
  onRetry: () => void;
  onBack: () => void;
}

function formatDelta(breakDelta: number): string {
  const prefix = breakDelta >= 0 ? "+" : "";
  return `${prefix}${breakDelta.toFixed(1)} px`;
}

function resolveFailureReason(breakDelta: number): string {
  if (breakDelta > 8) {
    return "离心过载：偏移瞬间过大，超过安全阈值。";
  }
  if (breakDelta > 0) {
    return "阈值超时：连续超限停留过久，龙身被拉断。";
  }
  return "链路失稳：回正速度不足，节位没能及时归中。";
}

export function GameOverPanel(props: GameOverPanelProps): JSX.Element | null {
  if (!props.visible) {
    return null;
  }

  return (
    <section className="overlay-card gameover-panel" role="dialog" aria-label="失败结算">
      <h2>龙身断裂</h2>
      <p>你负责的是 {props.playerSlot} 号节位，优先把这节拉回道路中心。</p>
      <p className="failure-reason">{resolveFailureReason(props.breakDelta)}</p>
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
