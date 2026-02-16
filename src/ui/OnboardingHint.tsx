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
      <p>被甩向哪边，就向反方向拖拽。</p>
      <p>例如：向右甩出时，向左拖动进行修正。</p>
      <button type="button" className="primary-button" onClick={props.onClose}>
        我知道了
      </button>
    </section>
  );
}
