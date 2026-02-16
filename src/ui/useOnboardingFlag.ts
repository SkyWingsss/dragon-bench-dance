import { useCallback, useState } from "react";
import { ONBOARDING_STORAGE_KEY } from "../game/Constants";

function readFlag(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function useOnboardingFlag(): {
  hasSeenOnboarding: boolean;
  markOnboardingSeen: () => void;
} {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(() => readFlag());

  const markOnboardingSeen = useCallback(() => {
    setHasSeenOnboarding(true);
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures in private mode.
    }
  }, []);

  return {
    hasSeenOnboarding,
    markOnboardingSeen,
  };
}
