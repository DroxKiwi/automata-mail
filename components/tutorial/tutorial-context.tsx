"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TUTORIAL_STEP_COUNT } from "@/components/tutorial/tutorial-steps";

export type TutorialState =
  | { status: "idle" }
  | { status: "active"; stepIndex: number };

export type TutorialContextValue = {
  state: TutorialState;
  startTutorial: () => void;
  dismissTutorial: () => void;
  nextStep: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorialState>({ status: "idle" });

  const startTutorial = useCallback(() => {
    setState({ status: "active", stepIndex: 0 });
  }, []);

  const dismissTutorial = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const nextStep = useCallback(() => {
    setState((s) => {
      if (s.status !== "active") {
        return s;
      }
      if (s.stepIndex >= TUTORIAL_STEP_COUNT - 1) {
        return { status: "idle" };
      }
      return { status: "active", stepIndex: s.stepIndex + 1 };
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      startTutorial,
      dismissTutorial,
      nextStep,
    }),
    [state, startTutorial, dismissTutorial, nextStep],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial doit être utilisé sous TutorialProvider");
  }
  return ctx;
}
