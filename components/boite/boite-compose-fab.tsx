"use client";

import { Paperclip, PenLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MailComposeEditor,
  type MailComposeEditorRef,
} from "@/components/mail/mail-compose-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_BYTES_PER_FILE = 15 * 1024 * 1024;
const MAX_FILES = 20;

type AttachedFile = { id: string; file: File };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BoiteComposeFab() {
  const editorRef = useRef<MailComposeEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const closeSheet = useCallback(() => {
    setOpen(false);
    setTo("");
    setSubject("");
    setAttachments([]);
    setError(null);
    setDragActive(false);
    editorRef.current?.clear();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, closeSheet]);

  useEffect(() => {
    if (!open) return;
    const endDrag = () => setDragActive(false);
    window.addEventListener("dragend", endDrag);
    return () => window.removeEventListener("dragend", endDrag);
  }, [open]);

  const addFiles = useCallback((list: File[]) => {
    setError(null);
    let errMsg: string | null = null;
    setAttachments((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (file.size > MAX_BYTES_PER_FILE) {
          errMsg = `Fichier trop volumineux : ${file.name} (max. ${MAX_BYTES_PER_FILE / 1024 / 1024} Mo).`;
          continue;
        }
        if (next.length >= MAX_FILES) {
          errMsg = `Maximum ${MAX_FILES} fichiers.`;
          break;
        }
        next.push({ id: crypto.randomUUID(), file });
      }
      return next;
    });
    if (errMsg) setError(errMsg);
  }, []);

  function removeAttachment(id: string) {
    setAttachments((a) => a.filter((x) => x.id !== id));
  }

  function hasFilePayload(e: React.DragEvent): boolean {
    return [...e.dataTransfer.types].some(
      (t) => t === "Files" || t === "application/x-moz-file",
    );
  }

  function handleSheetDragEnter(e: React.DragEvent) {
    if (!hasFilePayload(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleSheetDragLeave(e: React.DragEvent) {
    if (!hasFilePayload(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    setDragActive(false);
  }

  function handleSheetDrop(e: React.DragEvent) {
    if (!hasFilePayload(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const html = editorRef.current?.getHtml() ?? "";
    const text = editorRef.current?.getText() ?? "";

    setPending(true);
    try {
      const fd = new FormData();
      fd.set("to", to);
      fd.set("subject", subject);
      fd.set("html", html);
      fd.set("text", text);
      for (const { file } of attachments) {
        fd.append("attachment", file);
      }

      const res = await fetch("/api/mail/compose", {
        method: "POST",
        body: fd,
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (res.ok) {
        closeSheet();
        return;
      }
      const msg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "Envoi impossible.";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {!open ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
          )}
        >
          <Button
            type="button"
            data-tutorial-target="tutoriel-boite-compose"
            className="pointer-events-auto h-14 w-14 rounded-full shadow-lg [&_svg]:size-6"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            aria-label="Rédiger un nouveau message"
          >
            <PenLine className="size-6" aria-hidden />
          </Button>
        </div>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/35 dark:bg-black/50"
            aria-label="Fermer la rédaction"
            onClick={() => {
              if (!pending) closeSheet();
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-sheet-title"
            onDragEnterCapture={handleSheetDragEnter}
            onDragLeave={handleSheetDragLeave}
            onDragOverCapture={(e) => {
              if (hasFilePayload(e)) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDropCapture={handleSheetDrop}
            className={cn(
              "compose-mail-sheet fixed z-[100] flex max-h-[min(90vh,42rem)] flex-col overflow-hidden border bg-card shadow-2xl transition-[box-shadow,ring] duration-150",
              "inset-x-0 bottom-0 rounded-t-2xl",
              "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-3xl sm:w-[min(100%-1.5rem,40rem)] sm:rounded-xl",
              dragActive
                ? "border-primary ring-2 ring-primary/35"
                : "border-border",
            )}
          >
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex min-h-0 max-h-[min(90vh,42rem)] flex-1 flex-col"
            >
              <div className="flex h-11 shrink-0 cursor-default items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 sm:rounded-t-xl">
                <h2
                  id="compose-sheet-title"
                  className="truncate text-sm font-semibold text-foreground"
                >
                  Nouveau message
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => {
                    if (!pending) closeSheet();
                  }}
                  aria-label="Fermer"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <p className="shrink-0 border-b border-border/80 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
                Envoi via Gmail (Réglages) ou SMTP. Vous pouvez glisser-déposer des fichiers n&apos;importe où
                sur cette fenêtre.
              </p>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="compose-to">Destinataires</Label>
                  <Input
                    id="compose-to"
                    name="to"
                    type="text"
                    autoComplete="email"
                    placeholder="adresse@exemple.com, autre@…"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Séparer plusieurs adresses par une virgule ou un point-virgule.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compose-subject">Objet</Label>
                  <Input
                    id="compose-subject"
                    name="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="(sans objet)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <MailComposeEditor ref={editorRef} disabled={pending} />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="mb-0">Pièces jointes</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files?.length) addFiles(Array.from(files));
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={pending}
                    >
                      <Paperclip className="size-4" aria-hidden />
                      Ajouter une pièce jointe
                    </Button>
                  </div>

                  {attachments.length > 0 ? (
                    <ul className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2 text-sm">
                      {attachments.map(({ id, file }) => (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
                        >
                          <span className="min-w-0 truncate font-medium" title={file.name}>
                            {file.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatBytes(file.size)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            onClick={() => removeAttachment(id)}
                            aria-label={`Retirer ${file.name}`}
                          >
                            <X className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-4 py-3 sm:px-6 sm:rounded-b-xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!pending) closeSheet();
                  }}
                  disabled={pending}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Envoi…" : "Envoyer"}
                </Button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}
