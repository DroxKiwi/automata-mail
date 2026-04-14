"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

let mermaidInitDone = false;

export function flattenMarkdownCodeChildren(node: ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenMarkdownCodeChildren).join("");
  }
  if (isValidElement(node)) {
    return flattenMarkdownCodeChildren(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
    );
  }
  return "";
}

async function getMermaid() {
  const mermaid = (await import("mermaid")).default;
  if (!mermaidInitDone) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      fontFamily: "var(--font-sans), system-ui, sans-serif",
    });
    mermaidInitDone = true;
  }
  return mermaid;
}

type MermaidBlockProps = {
  chart: string;
};

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const reactId = useId().replace(/:/g, "");
  const trimmed = chart.trim();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trimmed) {
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const mermaid = await getMermaid();
        const uid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `m-${Math.random().toString(16).slice(2)}`;
        const id = `mermaid-${reactId}-${uid}`;
        const { svg: outSvg } = await mermaid.render(id, trimmed);
        if (!cancelled) {
          setSvg(outSvg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSvg(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trimmed, reactId]);

  if (!trimmed) {
    return (
      <figure className="my-4 space-y-2">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Impossible d&apos;afficher le diagramme.</p>
          <p className="mt-1 text-xs opacity-90">Diagramme vide.</p>
        </div>
      </figure>
    );
  }

  if (error) {
    return (
      <figure className="my-4 space-y-2">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Impossible d&apos;afficher le diagramme.</p>
          <p className="mt-1 text-xs opacity-90">{error}</p>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
          {chart.trim()}
        </pre>
      </figure>
    );
  }

  if (!svg) {
    return (
      <div
        className="my-4 flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground"
        aria-busy="true"
      >
        Rendu du diagramme…
      </div>
    );
  }

  return (
    <figure className="documentation-mermaid my-4 overflow-x-auto rounded-lg border border-border bg-card p-4 shadow-xs">
      <div
        className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </figure>
  );
}

/**
 * Repère un bloc de code dans `<pre>` : react-markdown peut insérer des nœuds texte
 * (sauts de ligne) autour du seul `<code>`, ce qui cassait l’ancienne détection `length === 1`.
 */
export function parseFencedCodeBlock(children: ReactNode): {
  language: string;
  code: string;
} | null {
  const arr = Children.toArray(children);
  for (const child of arr) {
    if (!isValidElement(child)) {
      continue;
    }
    const el = child as ReactElement<{ className?: string; children?: ReactNode }>;
    const className = el.props.className;
    if (typeof className !== "string" || !/\blanguage-[\w-]+\b/.test(className)) {
      continue;
    }
    const m = /language-([\w-]+)/.exec(className);
    if (!m) {
      continue;
    }
    return { language: m[1], code: flattenMarkdownCodeChildren(el.props.children) };
  }
  return null;
}
