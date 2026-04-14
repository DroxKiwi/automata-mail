"use client";

type MailHtmlPreviewProps = {
  html: string;
};

/**
 * Affiche le corps HTML dans une iframe sandbox (pas de scripts).
 */
export function MailHtmlPreview({ html }: MailHtmlPreviewProps) {
  const trimmed = html.trim();
  if (!trimmed) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        Aperçu HTML
      </div>
      <iframe
        title="Contenu HTML du message"
        sandbox=""
        srcDoc={trimmed}
        className="min-h-[min(70vh,520px)] w-full border-0 bg-background"
      />
    </div>
  );
}
