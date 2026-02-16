import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RotateLockMask } from "../RotateLockMask";

describe("RotateLockMask", () => {
  it("renders lock message when visible", () => {
    render(<RotateLockMask visible />);
    expect(screen.getByRole("dialog", { name: "方向提示" })).toBeInTheDocument();
    expect(screen.getByText("请竖屏体验")).toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    const { container } = render(<RotateLockMask visible={false} />);
    expect(container.firstChild).toBeNull();
  });
});
