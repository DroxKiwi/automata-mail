"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AdminUserRow = {
  id: number;
  email: string;
  username: string;
  name: string | null;
  isAdmin: boolean;
  createdAt: string;
};

type UsersAdminPanelProps = {
  initialUsers: AdminUserRow[];
  currentUserId: number;
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function UsersAdminPanel({
  initialUsers,
  currentUserId,
}: UsersAdminPanelProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [cEmail, setCEmail] = useState("");
  const [cUsername, setCUsername] = useState("");
  const [cName, setCName] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cAdmin, setCAdmin] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [eEmail, setEEmail] = useState("");
  const [eUsername, setEUsername] = useState("");
  const [eName, setEName] = useState("");
  const [ePassword, setEPassword] = useState("");
  const [eAdmin, setEAdmin] = useState(false);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  function closeCreate() {
    setCreateOpen(false);
    setCEmail("");
    setCUsername("");
    setCName("");
    setCPassword("");
    setCAdmin(false);
    setError(null);
  }

  function openEdit(u: AdminUserRow) {
    setEditId(u.id);
    setEEmail(u.email);
    setEUsername(u.username);
    setEName(u.name ?? "");
    setEPassword("");
    setEAdmin(u.isAdmin);
    setError(null);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditId(null);
    setError(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cEmail.trim(),
        username: cUsername.trim(),
        name: cName.trim() || null,
        password: cPassword,
        isAdmin: cAdmin,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      user?: AdminUserRow & { createdAt: string };
    };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la creation.");
      return;
    }
    if (json.user) {
      const row: AdminUserRow = {
        ...json.user,
        createdAt:
          typeof json.user.createdAt === "string"
            ? json.user.createdAt
            : new Date(json.user.createdAt as unknown as Date).toISOString(),
      };
      setUsers((prev) => [...prev, row].sort((a, b) => a.id - b.id));
    }
    closeCreate();
    router.refresh();
  }

  async function onEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (editId === null) {
      return;
    }
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      email: eEmail.trim(),
      username: eUsername.trim(),
      name: eName.trim() || null,
      isAdmin: eAdmin,
    };
    if (ePassword.trim().length > 0) {
      payload.password = ePassword;
    }
    const res = await fetch(`/api/users/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      user?: AdminUserRow & { createdAt: Date | string };
    };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la mise a jour.");
      return;
    }
    if (json.user) {
      const row: AdminUserRow = {
        id: json.user.id,
        email: json.user.email,
        username: json.user.username,
        name: json.user.name,
        isAdmin: json.user.isAdmin,
        createdAt:
          typeof json.user.createdAt === "string"
            ? json.user.createdAt
            : new Date(json.user.createdAt).toISOString(),
      };
      setUsers((prev) => prev.map((x) => (x.id === row.id ? row : x)));
    }
    closeEdit();
    router.refresh();
  }

  async function onDelete(u: AdminUserRow) {
    if (
      !window.confirm(
        `Supprimer definitivement l'utilisateur « ${u.username} » ? Cette action est irreversible.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la suppression.");
      return;
    }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Creer, modifier ou supprimer des comptes. Les mots de passe sont hashes cote serveur ; le dernier
          administrateur ne peut ni etre supprime ni perdre son role.
        </p>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Nouvel utilisateur
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">E-mail</th>
              <th className="px-3 py-2 font-medium">Identifiant</th>
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Cree le</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 break-all">{u.email}</td>
                <td className="px-3 py-2">
                  {u.username}
                  {u.id === currentUserId ? (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      (toi)
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{u.name ?? "—"}</td>
                <td className="px-3 py-2">{u.isAdmin ? "Oui" : "Non"}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => openEdit(u)}
                    >
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy || u.id === currentUserId}
                      title={
                        u.id === currentUserId
                          ? "Tu ne peux pas supprimer ton propre compte"
                          : undefined
                      }
                      onClick={() => onDelete(u)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => (o ? setCreateOpen(true) : closeCreate())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Definis l&apos;e-mail, l&apos;identifiant de connexion et un mot de passe d&apos;au moins 8
              caracteres.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="c-email">E-mail</Label>
              <Input
                id="c-email"
                type="email"
                autoComplete="email"
                required
                value={cEmail}
                onChange={(ev) => setCEmail(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-user">Nom d&apos;utilisateur</Label>
              <Input
                id="c-user"
                autoComplete="username"
                required
                minLength={2}
                value={cUsername}
                onChange={(ev) => setCUsername(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-name">Nom affiche (optionnel)</Label>
              <Input
                id="c-name"
                value={cName}
                onChange={(ev) => setCName(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-pass">Mot de passe</Label>
              <Input
                id="c-pass"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={cPassword}
                onChange={(ev) => setCPassword(ev.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={cAdmin} onCheckedChange={(v) => setCAdmin(v === true)} />
              Administrateur
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreate} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy}>
                Creer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => (o ? setEditOpen(true) : closeEdit())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
            <DialogDescription>
              Laisse le mot de passe vide pour ne pas le changer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onEditSave} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="e-email">E-mail</Label>
              <Input
                id="e-email"
                type="email"
                autoComplete="email"
                required
                value={eEmail}
                onChange={(ev) => setEEmail(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-user">Nom d&apos;utilisateur</Label>
              <Input
                id="e-user"
                autoComplete="username"
                required
                minLength={2}
                value={eUsername}
                onChange={(ev) => setEUsername(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-name">Nom affiche (optionnel)</Label>
              <Input id="e-name" value={eName} onChange={(ev) => setEName(ev.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-pass">Nouveau mot de passe (optionnel)</Label>
              <Input
                id="e-pass"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={ePassword}
                onChange={(ev) => setEPassword(ev.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={eAdmin} onCheckedChange={(v) => setEAdmin(v === true)} />
              Administrateur
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEdit} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
