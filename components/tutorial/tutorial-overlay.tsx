"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  getTutorialStep,
  getWrongPathHelp,
  isSidebarTutorialStep,
  stepPathAllowed,
  TUTORIAL_STEP_COUNT,
} from "@/components/tutorial/tutorial-steps";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

function rectNearlyEqual(a: Rect, b: Rect): boolean {
  const ε = 0.75;
  return (
    Math.abs(a.top - b.top) < ε &&
    Math.abs(a.left - b.left) < ε &&
    Math.abs(a.width - b.width) < ε &&
    Math.abs(a.height - b.height) < ε
  );
}

/** Bulle à droite / gauche de la cible — adapté à l’onglet sidebar (étape 1). */
function computeSidebarBubbleStyle(next: Rect, vw: number, vh: number): CSSProperties {
  const bubbleW = Math.min(352, vw - 32);
  const gap = 12;
  const preferRight = next.left + next.width + gap + bubbleW <= vw - 16;
  let left: number;
  if (preferRight) {
    left = next.left + next.width + gap;
  } else {
    left = Math.max(16, next.left - gap - bubbleW);
  }
  left = Math.min(left, vw - bubbleW - 16);
  const top = Math.min(
    Math.max(16, next.top + next.height / 2 - 72),
    vh - 280,
  );
  return { top, left, width: bubbleW, maxHeight: "min(55vh, 320px)", overflowY: "auto" };
}

const BUBBLE_ESTIMATE_HEIGHT = 220;

/** Bulle au-dessus ou en dessous de la cible, centrée horizontalement — évite de masquer la zone. */
function computeVerticalBubbleStyle(next: Rect, vw: number, vh: number): CSSProperties {
  const bubbleW = Math.min(352, vw - 32);
  const gap = 12;
  const pad = 16;
  const est = BUBBLE_ESTIMATE_HEIGHT;

  let left = next.left + next.width / 2 - bubbleW / 2;
  left = Math.min(Math.max(pad, left), vw - bubbleW - pad);

  const bottom = next.top + next.height;
  const belowTop = bottom + gap;
  const aboveTop = next.top - gap - est;

  const canPlaceBelow = belowTop + est <= vh - pad;
  const canPlaceAbove = aboveTop >= pad;

  let top: number;
  if (canPlaceBelow && (!canPlaceAbove || vh - bottom >= next.top)) {
    top = belowTop;
  } else if (canPlaceAbove) {
    top = aboveTop;
  } else if (canPlaceBelow) {
    top = belowTop;
  } else {
    top = Math.max(pad, Math.min(aboveTop, vh - est - pad));
  }

  top = Math.min(Math.max(pad, top), vh - est - pad);

  return {
    top,
    left,
    width: bubbleW,
    maxHeight: "min(55vh, 320px)",
    overflowY: "auto",
  };
}

function SpotlightCurtains({ rect }: { rect: Rect }) {
  const { top, left, width, height } = rect;
  const panel =
    "pointer-events-auto fixed z-[100000] bg-foreground/50 backdrop-blur-[1px]";
  return (
    <>
      <div className={panel} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      <div
        className={panel}
        style={{
          top: top + height,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <div
        className={panel}
        style={{
          top,
          left: 0,
          width: Math.max(0, left),
          height,
        }}
      />
      <div
        className={panel}
        style={{
          top,
          left: left + width,
          right: 0,
          height,
        }}
      />
    </>
  );
}

/** Assombrissement plein écran avec trou circulaire (aligné sur un bouton rond). */
function SpotlightCurtainsCircular({ rect, maskId }: { rect: Rect; maskId: string }) {
  const vw =
    typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh =
    typeof window !== "undefined" ? window.innerHeight : 1080;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const r = Math.max(rect.width, rect.height) / 2 + 10;

  return (
    <svg
      className="pointer-events-auto fixed inset-0 z-[100000] h-screen w-screen text-foreground"
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect x={0} y={0} width={vw} height={vh} fill="white" />
          <circle cx={cx} cy={cy} r={r} fill="black" />
        </mask>
      </defs>
      <rect
        x={0}
        y={0}
        width={vw}
        height={vh}
        fill="currentColor"
        className="opacity-50"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

function WrongPathPanel({
  dismissTutorial,
  href,
  linkLabel,
  panelTitle,
  hint,
}: {
  dismissTutorial: () => void;
  href: string;
  linkLabel: string;
  panelTitle: string;
  hint: string;
}) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-4 bg-foreground/50 p-6 backdrop-blur-sm">
      <div className="max-w-md rounded-lg border border-border bg-card px-5 py-4 text-center text-sm text-card-foreground shadow-md">
        <p className="font-medium text-foreground">{panelTitle}</p>
        <p className="mt-2 text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" asChild variant="default">
          <Link href={href}>{linkLabel}</Link>
        </Button>
        <Button type="button" variant="outline" onClick={dismissTutorial}>
          Fermer le tutoriel
        </Button>
      </div>
    </div>
  );
}

export function TutorialOverlay() {
  const { state, dismissTutorial, nextStep } = useTutorial();
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [rect, setRect] = useState<Rect | null>(null);
  const [bubbleStyle, setBubbleStyle] = useState<CSSProperties>({});
  const rafRef = useRef<number | null>(null);
  const circleMaskId = useId().replace(/:/g, "");
  /** Évite de fermer le tutoriel pendant la navigation déclenchée par « Suivant ». */
  const skipDismissUntilStepPathOk = useRef(false);

  const handleTutorialNext = useCallback(() => {
    if (state.status !== "active") {
      return;
    }
    const current = getTutorialStep(state.stepIndex);
    if (current?.navigateOnNext) {
      skipDismissUntilStepPathOk.current = true;
      router.push(current.navigateOnNext);
    }
    nextStep();
  }, [state, router, nextStep]);

  const active = state.status === "active";
  const stepIndex = active ? state.stepIndex : -1;
  const step = active ? getTutorialStep(stepIndex) : undefined;

  const updateLayout = useCallback(() => {
    if (!step) {
      setRect(null);
      setBubbleStyle({});
      return;
    }
    if (!stepPathAllowed(pathname, step)) {
      setRect(null);
      setBubbleStyle({});
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setRect(null);
      setBubbleStyle({});
      return;
    }
    const next = readRect(el);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nextBubble: CSSProperties = isSidebarTutorialStep(step)
      ? computeSidebarBubbleStyle(next, vw, vh)
      : computeVerticalBubbleStyle(next, vw, vh);

    setRect((prev) => (prev && rectNearlyEqual(prev, next) ? prev : next));
    setBubbleStyle((prev) =>
      prev?.top === nextBubble.top &&
      prev?.left === nextBubble.left &&
      prev?.width === nextBubble.width &&
      prev?.maxHeight === nextBubble.maxHeight
        ? prev
        : nextBubble,
    );
  }, [step, pathname]);

  useLayoutEffect(() => {
    if (!active || !step) {
      return;
    }

    const schedule = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateLayout();
      });
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    const el = stepPathAllowed(pathname, step)
      ? document.querySelector(step.targetSelector)
      : null;
    const ro =
      el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (el && ro) {
      ro.observe(el);
    }

    const id = window.setInterval(schedule, 400);

    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      window.clearInterval(id);
      ro?.disconnect();
    };
  }, [active, step, stepIndex, pathname, updateLayout]);

  useEffect(() => {
    if (!active || !step) {
      return;
    }
    if (stepPathAllowed(pathname, step)) {
      skipDismissUntilStepPathOk.current = false;
    }
  }, [active, step, pathname]);

  useEffect(() => {
    if (!active || stepIndex === 0 || !step) {
      return;
    }
    if (stepPathAllowed(pathname, step)) {
      return;
    }
    if (skipDismissUntilStepPathOk.current) {
      return;
    }
    dismissTutorial();
  }, [active, stepIndex, pathname, step, dismissTutorial]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissTutorial();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dismissTutorial]);

  if (!mounted || !active || !step) {
    return null;
  }

  const pathOk = stepPathAllowed(pathname, step);
  if (!pathOk) {
    const help = getWrongPathHelp(pathname, step);
    return createPortal(
      <WrongPathPanel
        dismissTutorial={dismissTutorial}
        href={help.href}
        linkLabel={help.linkLabel}
        panelTitle={help.panelTitle}
        hint={help.hint}
      />,
      document.body,
    );
  }

  if (!rect) {
    const fallback = (
      <div className="pointer-events-auto fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-4 bg-foreground/45 p-6 backdrop-blur-sm">
        <div className="max-w-md rounded-lg border border-border bg-card px-5 py-4 text-center text-sm text-card-foreground shadow-md">
          <p>
            Élément introuvable sur cette page. Rechargez ou passez à l&apos;étape suivante une fois
            le bloc affiché.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="default" onClick={handleTutorialNext}>
            Étape suivante
          </Button>
          <Button type="button" variant="outline" onClick={dismissTutorial}>
            Fermer le tutoriel
          </Button>
        </div>
      </div>
    );
    return createPortal(fallback, document.body);
  }

  const isLast = stepIndex >= TUTORIAL_STEP_COUNT - 1;

  const node = (
    <>
      {step.spotlightHoleShape === "circle" ? (
        <SpotlightCurtainsCircular rect={rect} maskId={circleMaskId} />
      ) : (
        <SpotlightCurtains rect={rect} />
      )}
      <div
        className={cn(
          "tutorial-spotlight-pulse pointer-events-none fixed z-[100001] ring-2 ring-primary ring-offset-2 ring-offset-background",
          step.spotlightRoundedClass ?? "rounded-md",
        )}
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
      <div
        role="dialog"
        aria-labelledby="tutorial-bubble-title"
        aria-describedby="tutorial-bubble-desc"
        className={cn(
          "pointer-events-auto fixed z-[100002] rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg",
        )}
        style={bubbleStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="tutorial-bubble-title" className="text-sm font-semibold text-foreground">
            {step.bubbleTitle}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={dismissTutorial}
            aria-label="Fermer le tutoriel"
          >
            <X className="size-4" />
          </Button>
        </div>
        <p id="tutorial-bubble-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.bubbleText}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
          {!isLast ? (
            <Button type="button" size="sm" variant="default" onClick={handleTutorialNext}>
              Suivant
            </Button>
          ) : (
            <Button type="button" size="sm" variant="default" onClick={dismissTutorial}>
              Terminer le tutoriel
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(node, document.body);
}
