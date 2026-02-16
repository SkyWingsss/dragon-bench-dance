interface OnboardingHintProps {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingHint(props: OnboardingHintProps): JSX.Element | null {
  if (!props.visible) {
    return null;
  }

  return (
    <section className="overlay-card onboarding-hint" role="dialog" aria-label="操作引导">
      <h3>操作提示</h3>
      <p>核心规则只有一条: 被甩向哪边，就向反方向拖拽。</p>
      <p>拖拽区域是全屏，不是底部按钮区。按住任意位置即可左右控制。</p>
      <p>例如向右甩出时，立刻向左拖；越晚修正，断裂风险越高。</p>
      <button type="button" className="primary-button" onClick={props.onClose}>
        我知道了
      </button>
    </section>
  );
}
