import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HUDTopBar } from "../HUDTopBar";

describe("HUDTopBar", () => {
  it("renders slot text, minimap and risk styling", () => {
    const { container } = render(
      <HUDTopBar
        level={2}
        score={4567}
        speed={612}
        combo={8}
        progress={0.42}
        risk={0.88}
        frenzy
        difficultyTier="hardcore"
        cameraDepthNorm={0.76}
        playerSlot={4}
        mapTheme="whitewall-alley"
        playerDistance={1200}
        minimapSamples={[
          { x: 0.1, y: 0.8 },
          { x: 0.28, y: 0.66 },
          { x: 0.5, y: 0.5 },
          { x: 0.74, y: 0.32 },
          { x: 0.9, y: 0.18 },
        ]}
        landmarks={[
          { s: 1240, x: 0, y: 0, angle: 0.1, kind: "lantern" },
          { s: 1320, x: 0, y: 0, angle: 0.2, kind: "arch" },
        ]}
      />,
    );

    expect(screen.getByText("负责 4号节位")).toBeInTheDocument();
    expect(screen.getByText("HARDCORE")).toBeInTheDocument();
    expect(screen.getByTestId("mini-map")).toBeInTheDocument();
    expect(screen.getAllByText("极危").length).toBeGreaterThan(0);

    const header = container.querySelector(".hud-top-bar");
    expect(header).toBeTruthy();
    expect(header?.getAttribute("style") ?? "").toContain("rgba(217, 46, 46");
  });
});
