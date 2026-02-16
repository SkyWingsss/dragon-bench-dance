import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameOverPanel } from "../GameOverPanel";

describe("GameOverPanel", () => {
  it("shows formatted break delta with sign", () => {
    render(
      <GameOverPanel
        visible
        score={12345}
        maxCombo={9}
        failSpeed={666}
        breakDelta={12.34}
        onRetry={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: "失败结算" })).toBeInTheDocument();
    expect(screen.getByTestId("break-delta")).toHaveTextContent("+12.3 px");
  });
});
