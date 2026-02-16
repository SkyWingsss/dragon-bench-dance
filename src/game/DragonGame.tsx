import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SEGMENT_SPACING } from "./Constants";
import { createDragonRenderer, type DragonRenderer } from "./renderer";
import { useDragonPhysics } from "./useDragonPhysics";
import type { LevelId, OverlayState, PlayerSlot, RunEndResult } from "./types";
import { HUDTopBar } from "../ui/HUDTopBar";
import { SlotPicker } from "../ui/SlotPicker";
import { OnboardingHint } from "../ui/OnboardingHint";
import { GameOverPanel } from "../ui/GameOverPanel";
import { RotateLockMask } from "../ui/RotateLockMask";
import { DragCoach } from "../ui/DragCoach";
import { useOnboardingFlag } from "../ui/useOnboardingFlag";

export interface DragonGameProps {
  initialLevel?: 1 | 2 | 3;
  defaultSlot?: 1 | 2 | 3 | 4 | 5;
  onRunEnd?: (result: { level: 1 | 2 | 3; score: number; cleared: boolean }) => void;
}

const levels: LevelId[] = [1, 2, 3];

function detectPortrait(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.innerHeight >= window.innerWidth;
}

function shouldIgnoreDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return (
    target.closest("button, a, input, textarea, select, [role='dialog'], .overlay-card") !== null
  );
}

export function DragonGame(props: DragonGameProps): JSX.Element {
  const initialLevel = props.initialLevel ?? 1;
  const initialSlot = props.defaultSlot ?? 1;

  const [selectedSlot, setSelectedSlot] = useState<PlayerSlot>(initialSlot);
  const [selectedLevel, setSelectedLevel] = useState<LevelId>(initialLevel);
  const [showSlotPicker, setShowSlotPicker] = useState<boolean>(true);
  const [isPortrait, setIsPortrait] = useState<boolean>(() => detectPortrait());

  const onRunEndRef = useRef<DragonGameProps["onRunEnd"]>(props.onRunEnd);
  onRunEndRef.current = props.onRunEnd;

  const { hasSeenOnboarding, markOnboardingSeen } = useOnboardingFlag();
  const showOnboarding = showSlotPicker && !hasSeenOnboarding;

  const { snapshot, onDrag, startLevel, restartLevel, tick, setPaused } = useDragonPhysics({
    initialLevel,
    defaultSlot: initialSlot,
    onRunEnd: (result: RunEndResult) => {
      onRunEndRef.current?.(result);
    },
  });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<DragonRenderer | null>(null);
  const snapshotRef = useRef(snapshot);
  const renderClockRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);
  const dragXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const lastDragAtMsRef = useRef<number>(0);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const listener = (): void => {
      setIsPortrait(detectPortrait());
    };

    listener();
    window.addEventListener("resize", listener);
    window.addEventListener("orientationchange", listener);

    return () => {
      window.removeEventListener("resize", listener);
      window.removeEventListener("orientationchange", listener);
    };
  }, []);

  useEffect(() => {
    setPaused(!isPortrait || showSlotPicker);
  }, [isPortrait, setPaused, showSlotPicker]);

  useEffect(() => {
    let raf = 0;

    const loop = (now: number): void => {
      tick(now);
      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [tick]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      return;
    }

    const renderer = createDragonRenderer(canvas);
    rendererRef.current = renderer;

    const resize = (): void => {
      const rect = stage.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      renderer.render(snapshotRef.current, 1 / 60);
    };

    resize();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(stage);
    }

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", resize);
      viewport.addEventListener("scroll", resize);
    }

    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    const now = performance.now();
    if (renderClockRef.current === null) {
      renderClockRef.current = now;
    }

    const dt = Math.min(0.05, (now - renderClockRef.current) / 1000);
    renderClockRef.current = now;

    renderer.render(snapshot, dt);
  }, [snapshot]);

  useEffect(() => {
    setSelectedLevel(snapshot.level);
  }, [snapshot.level]);

  const overlayState = useMemo<OverlayState>(() => {
    if (!isPortrait) {
      return "rotate-lock";
    }
    if (snapshot.status === "gameover") {
      return "gameover";
    }
    if (snapshot.status === "victory") {
      return "victory";
    }
    if (showOnboarding) {
      return "onboarding";
    }
    if (snapshot.status === "level-clear") {
      return "level-clear";
    }
    return "none";
  }, [isPortrait, showOnboarding, snapshot.status]);

  const handleStart = (): void => {
    setShowSlotPicker(false);
    hasDraggedRef.current = false;
    lastDragAtMsRef.current = 0;
    startLevel(selectedLevel, selectedSlot);
  };

  const handleRetry = (): void => {
    setShowSlotPicker(false);
    hasDraggedRef.current = false;
    lastDragAtMsRef.current = 0;
    restartLevel();
  };

  const handleBack = (): void => {
    setShowSlotPicker(true);
    hasDraggedRef.current = false;
    lastDragAtMsRef.current = 0;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (shouldIgnoreDragTarget(event.target)) {
      return;
    }

    if (snapshot.status !== "running" || !isPortrait) {
      return;
    }

    dragActiveRef.current = true;
    dragXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    if (!dragActiveRef.current) {
      return;
    }

    const deltaX = event.clientX - dragXRef.current;
    dragXRef.current = event.clientX;

    if (snapshot.status === "running" && isPortrait && Math.abs(deltaX) > 0.01) {
      onDrag(deltaX);
      hasDraggedRef.current = true;
      lastDragAtMsRef.current = performance.now();
    }
  };

  const releaseDrag = (): void => {
    dragActiveRef.current = false;
  };

  const progress = Math.min(1, snapshot.targetDistance > 0 ? snapshot.distance / snapshot.targetDistance : 0);
  const playerDistance = snapshot.distance - snapshot.playerSegmentIndex * SEGMENT_SPACING;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const idleMs =
    lastDragAtMsRef.current <= 0 ? Number.POSITIVE_INFINITY : nowMs - lastDragAtMsRef.current;
  const runElapsedSec = snapshot.speed > 0 ? snapshot.distance / snapshot.speed : 0;
  const showDragCoach =
    overlayState === "none" &&
    snapshot.status === "running" &&
    isPortrait &&
    !showSlotPicker &&
    (runElapsedSec < 12 || !hasDraggedRef.current || idleMs > 1800 || snapshot.risk >= 0.5);

  return (
    <main className="dragon-game-root">
      <div
        ref={stageRef}
        className="game-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releaseDrag}
        onPointerCancel={releaseDrag}
        onPointerLeave={releaseDrag}
      >
        <HUDTopBar
          level={snapshot.level}
          score={snapshot.score}
          speed={snapshot.speed}
          combo={snapshot.combo}
          progress={progress}
          risk={snapshot.risk}
          frenzy={snapshot.frenzy}
          difficultyTier={snapshot.difficultyTier}
          cameraDepthNorm={snapshot.cameraDepthNorm}
          playerSlot={snapshot.playerSlot}
          mapTheme={snapshot.mapTheme}
          minimapSamples={snapshot.minimapSamples}
          landmarks={snapshot.landmarks}
          playerDistance={playerDistance}
        />

        <canvas ref={canvasRef} className="dragon-canvas" aria-label="独龙狂舞游戏画布" />

        {overlayState === "level-clear" && (
          <div className="level-clear-toast" role="status">
            第{snapshot.level}关完成，继续狂舞
          </div>
        )}

        <section className="control-zone">
          <p>全屏任意位置可拖拽，长按并左右移动即可修正离心</p>
        </section>

        <DragCoach
          visible={showDragCoach}
          hasDragged={hasDraggedRef.current}
          idleMs={idleMs}
          risk={snapshot.risk}
          playerOffsetPx={snapshot.playerOffsetPx}
          breakThresholdPx={snapshot.breakThresholdPx}
          playerSlot={snapshot.playerSlot}
        />

        {showSlotPicker && isPortrait && (
          <div className="slot-picker-wrap">
            <section className="overlay-card level-picker">
              <h3>选择关卡</h3>
              <div className="level-grid">
                {levels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`slot-button ${selectedLevel === level ? "active" : ""}`}
                    onClick={() => setSelectedLevel(level)}
                  >
                    第{level}关
                  </button>
                ))}
              </div>
            </section>
            <SlotPicker selected={selectedSlot} onSelect={setSelectedSlot} onStart={handleStart} />
          </div>
        )}

        <OnboardingHint
          visible={showOnboarding && isPortrait}
          onClose={(): void => {
            markOnboardingSeen();
          }}
        />

        <GameOverPanel
          visible={overlayState === "gameover" && !showSlotPicker}
          score={snapshot.score}
          maxCombo={snapshot.maxCombo}
          failSpeed={snapshot.failureSpeed}
          breakDelta={Math.abs(snapshot.playerOffsetPx) - snapshot.breakThresholdPx}
          playerSlot={snapshot.playerSlot}
          onRetry={handleRetry}
          onBack={handleBack}
        />

        {overlayState === "victory" && !showSlotPicker && (
          <section className="overlay-card victory-panel" role="dialog" aria-label="通关">
            <h2>三关通关</h2>
            <p>总分 {snapshot.score.toLocaleString("zh-CN")}</p>
            <button type="button" className="primary-button" onClick={handleBack}>
              返回关卡选择
            </button>
          </section>
        )}

        <RotateLockMask visible={overlayState === "rotate-lock"} />
      </div>
    </main>
  );
}
