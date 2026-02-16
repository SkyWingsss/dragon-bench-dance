import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ONBOARDING_STORAGE_KEY } from "../../game/Constants";
import { useOnboardingFlag } from "../useOnboardingFlag";

describe("useOnboardingFlag", () => {
  it("shows onboarding once and persists flag in localStorage", () => {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);

    const { result, unmount } = renderHook(() => useOnboardingFlag());
    expect(result.current.hasSeenOnboarding).toBe(false);

    act(() => {
      result.current.markOnboardingSeen();
    });

    expect(result.current.hasSeenOnboarding).toBe(true);
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("1");

    unmount();
    const { result: secondResult } = renderHook(() => useOnboardingFlag());
    expect(secondResult.current.hasSeenOnboarding).toBe(true);
  });
});
