"use client";

import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "@/components/tutorial/tutorial-context";

export function TutorialStartButton() {
  const { startTutorial } = useTutorial();

  return (
    <Button
      type="button"
      variant="default"
      size="default"
      className="w-full gap-2 font-semibold shadow-sm"
      onClick={startTutorial}
    >
      <BookOpen className="size-4 shrink-0 opacity-90" aria-hidden />
      Tutoriel
    </Button>
  );
}
