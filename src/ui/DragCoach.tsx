interface DragCoachProps {
  visible: boolean;
  hasDragged: boolean;
  idleMs: number;
  risk: number;
  playerOffsetPx: number;
  breakThresholdPx: number;
  playerSlot: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDirection(offset: number): "left" | "right" {
  return offset >= 0 ? "left" : "right";
}

export function DragCoach(props: DragCoachProps): JSX.Element | null {
  if (!props.visible) {
    return null;
  }

  const ratio = clamp(
    props.breakThresholdPx > 0 ? Math.abs(props.playerOffsetPx) / props.breakThresholdPx : 0,
    0,
    1.3,
  );
  const riskScore = clamp(props.risk, 0, 1.3);
  const strongWarning = ratio >= 0.7 || riskScore >= 0.75;
  const direction = resolveDirection(props.playerOffsetPx);
  const directionLabel = direction === "left" ? "向左拖" : "向右拖";

  let detail = "按住屏幕任意位置左右拖动，全屏都可拖。";
  if (props.hasDragged && !strongWarning && props.idleMs <= 2200) {
    detail = "保持手指不离屏，看到偏移就反向轻拉，连续小修正最稳。";
  }
  if (props.hasDragged && props.idleMs > 2200) {
    detail = "不要停手太久，持续小幅反向修正更稳。";
  }
  if (strongWarning) {
    detail = `你的${props.playerSlot}号节位偏移过大，立即${directionLabel}拉回中线。`;
  }

  return (
    <section
      className={`drag-coach ${strongWarning ? "warn" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="拖拽操作提示"
    >
      <div className="drag-coach-icon" aria-hidden>
        <span>◀</span>
        <span className="drag-coach-finger">●</span>
        <span>▶</span>
      </div>
      <div className="drag-coach-copy">
        <strong>{strongWarning ? `立即${directionLabel}` : "全屏拖拽控制"}</strong>
        <p>{detail}</p>
        <div className="drag-coach-meter" aria-hidden>
          <div className="drag-coach-meter-fill" style={{ width: `${Math.min(100, ratio * 100).toFixed(1)}%` }} />
        </div>
      </div>
    </section>
  );
}
