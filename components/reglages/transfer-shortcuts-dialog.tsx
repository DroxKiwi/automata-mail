"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type TransferShortcutItem = { id: number; emails: string[] };

type TransferShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShortcutsChanged?: () => void;
};

function formatShortcutLabel(emails: string[]): string {
  if (emails.length === 0) {
    return "";
  }
  if (emails.length === 1) {
    return emails[0] ?? "";
  }
  const first = emails[0] ?? "";
  return `${first} +${emails.length - 1}`;
}

export function TransferShortcutsDialog({
  open,
  onOpenChange,
  onShortcutsChanged,
}: TransferShortcutsDialogProps) {
  const [items, setItems] = useState<TransferShortcutItem[]>([]);
  const [newRaw, setNewRaw] = useState("");
  const [formError, setFormError] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRaw, setEditRaw] = useState("");
  const [savingEditId, setSavingEditId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/transfer-shortcuts");
      const data: unknown = await res.json();
      const shortcuts =
        typeof data === "object" &&
        data !== null &&
        "shortcuts" in data &&
        Array.isArray((data as { shortcuts: unknown }).shortcuts)
          ? (data as { shortcuts: TransferShortcutItem[] }).shortcuts
          : [];
      setItems(shortcuts);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditRaw("");
      setNewRaw("");
      setFormError("");
    }
  }, [open]);

  async function addShortcut() {
    setFormError("");
    setAdding(true);
    try {
      const res = await fetch("/api/transfer-shortcuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: newRaw }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Impossible d'ajouter ce raccourci.";
        setFormError(msg);
        return;
      }
      setNewRaw("");
      await loadList();
      onShortcutsChanged?.();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: number) {
    setFormError("");
    setSavingEditId(id);
    try {
      const res = await fetch(`/api/transfer-shortcuts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: editRaw }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Impossible d'enregistrer.";
        setFormError(msg);
        return;
      }
      setEditingId(null);
      setEditRaw("");
      await loadList();
      onShortcutsChanged?.();
    } finally {
      setSavingEditId(null);
    }
  }

  async function removeShortcut(id: number) {
    const res = await fetch(`/api/transfer-shortcuts/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === id) {
        setEditingId(null);
        setEditRaw("");
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      onShortcutsChanged?.();
    }
  }

  function startEdit(s: TransferShortcutItem) {
    setFormError("");
    setEditingId(s.id);
    setEditRaw(s.emails.join("\n"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raccourcis de transfert</DialogTitle>
          <DialogDescription>
            Chaque raccourci peut contenir plusieurs destinataires : ils recevront le même transfert
            (champ À multiple). Saisissez une adresse par ligne ou séparez-les par des virgules.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shortcut-new">Nouveau raccourci — destinataires</Label>
            <Textarea
              id="shortcut-new"
              autoComplete="off"
              placeholder={"alice@exemple.com\nbob@exemple.com"}
              value={newRaw}
              onChange={(e) => setNewRaw(e.target.value)}
              rows={4}
              className="min-h-[5rem] font-mono text-sm"
            />
            <Button type="button" disabled={adding} onClick={() => void addShortcut()}>
              Ajouter le raccourci
            </Button>
            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Raccourcis enregistrés</p>
            {loadingList ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun raccourci pour le moment.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md border border-border/80 bg-muted/20 p-2"
                  >
                    {editingId === s.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          aria-label="Modifier les destinataires"
                          value={editRaw}
                          onChange={(e) => setEditRaw(e.target.value)}
                          rows={Math.min(8, Math.max(3, s.emails.length + 1))}
                          className="font-mono text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingEditId === s.id}
                            onClick={() => void saveEdit(s.id)}
                          >
                            {savingEditId === s.id ? "Enregistrement…" : "Enregistrer"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={savingEditId === s.id}
                            onClick={() => {
                              setEditingId(null);
                              setEditRaw("");
                              setFormError("");
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium text-foreground"
                            title={s.emails.join(", ")}
                          >
                            {formatShortcutLabel(s.emails)}
                          </p>
                          <p className="mt-0.5 break-all text-xs text-muted-foreground">
                            {s.emails.join(", ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Modifier ce raccourci"
                            onClick={() => startEdit(s)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Supprimer ce raccourci"
                            onClick={() => void removeShortcut(s.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
