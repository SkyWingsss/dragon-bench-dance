import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DragCoach } from "../DragCoach";

describe("DragCoach", () => {
  it("shows fullscreen drag entry hint before first drag", () => {
    render(
      <DragCoach
        visible
        hasDragged={false}
        idleMs={9999}
        risk={0.2}
        playerOffsetPx={4}
        breakThresholdPx={30}
        playerSlot={2}
      />,
    );

    expect(screen.getByText("全屏拖拽控制")).toBeInTheDocument();
    expect(screen.getByText(/全屏都可拖/)).toBeInTheDocument();
  });

  it("shows correction direction when offset is high", () => {
    render(
      <DragCoach
        visible
        hasDragged
        idleMs={120}
        risk={0.9}
        playerOffsetPx={26}
        breakThresholdPx={30}
        playerSlot={4}
      />,
    );

    expect(screen.getByText("立即向左拖")).toBeInTheDocument();
    expect(screen.getByText(/4号节位偏移过大/)).toBeInTheDocument();
  });
});
