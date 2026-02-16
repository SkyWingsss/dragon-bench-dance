import { ORIENTATION_LOCK_MESSAGE } from "../game/Constants";

interface RotateLockMaskProps {
  visible: boolean;
}

export function RotateLockMask(props: RotateLockMaskProps): JSX.Element | null {
  if (!props.visible) {
    return null;
  }

  return (
    <section className="rotate-lock-mask" role="dialog" aria-label="方向提示">
      <div className="overlay-card rotate-card">
        <h2>{ORIENTATION_LOCK_MESSAGE}</h2>
        <p>当前为横屏，已自动暂停。切换回竖屏后继续。</p>
      </div>
    </section>
  );
}
