"use client";

import { Children, isValidElement, type AnchorHTMLAttributes } from "react";
import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MermaidBlock,
  flattenMarkdownCodeChildren,
  parseFencedCodeBlock,
} from "@/components/docs/mermaid-block";

type DocumentationMarkdownProps = {
  markdown: string;
};

const baseHeading = "scroll-mt-24 font-heading font-semibold tracking-tight text-foreground";
const linkClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm";

function MarkdownLink({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href?.startsWith("/")) {
    return (
      <Link href={href} className={linkClass} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={linkClass}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}

const components: Partial<Components> = {
  h1: ({ children, ...props }) => (
    <h1 className={`${baseHeading} mt-2 text-2xl`} {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className={`${baseHeading} mt-10 border-b border-border pb-2 text-xl`} {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className={`${baseHeading} mt-8 text-lg`} {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className={`${baseHeading} mt-6 text-base`} {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed marker:text-foreground/70" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  code: ({ className, children, ...props }) => {
    if (typeof className === "string" && className.includes("language-mermaid")) {
      return <MermaidBlock chart={flattenMarkdownCodeChildren(children)} />;
    }
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => {
    const fenced = parseFencedCodeBlock(children);
    if (fenced?.language === "mermaid") {
      return <MermaidBlock chart={fenced.code} />;
    }
    const nonEmpty = Children.toArray(children).filter(
      (c) => !(typeof c === "string" && c.trim() === ""),
    );
    if (
      nonEmpty.length === 1 &&
      isValidElement(nonEmpty[0]) &&
      nonEmpty[0].type === MermaidBlock
    ) {
      return nonEmpty[0];
    }
    return (
      <pre
        className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed text-foreground"
        {...props}
      >
        {children}
      </pre>
    );
  },
  hr: (props) => <hr className="my-10 border-border" {...props} />,
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mt-4 border-l-4 border-primary/40 pl-4 text-sm italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ href, children, ...props }) => (
    <MarkdownLink href={href} {...props}>
      {children}
    </MarkdownLink>
  ),
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/80 text-foreground" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border-b border-border px-3 py-2 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-border px-3 py-2 text-muted-foreground" {...props}>
      {children}
    </td>
  ),
  tr: (props) => <tr className="last:[&>td]:border-b-0" {...props} />,
};

export function DocumentationMarkdown({ markdown }: DocumentationMarkdownProps) {
  return (
    <article className="documentation-markdown w-full min-w-0 max-w-none pb-12">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
