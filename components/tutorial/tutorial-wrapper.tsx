"use client";

import type { ReactNode } from "react";
import { TutorialProvider } from "@/components/tutorial/tutorial-context";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";

/**
 * Fournit le tutoriel guidé (overlay + contexte) au-dessus de toute l’app.
 * Monté dans le layout racine pour que l’état survive aux navigations entre pages.
 */
export function TutorialWrapper({ children }: { children: ReactNode }) {
  return (
    <TutorialProvider>
      {children}
      <TutorialOverlay />
    </TutorialProvider>
  );
}
