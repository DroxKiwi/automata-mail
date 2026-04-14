"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
          setupToken,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Configuration impossible. Reessayez.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur reseau. Verifiez votre connexion.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Configuration initiale
          </CardTitle>
          <CardDescription>
            Aucun compte n&apos;existe encore. Cree le premier administrateur avec le
            token defini dans <span className="font-mono text-xs">FIRST_SETUP_TOKEN</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-email">E-mail</Label>
              <Input
                id="setup-email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@entreprise.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-username">Nom d&apos;utilisateur</Label>
              <Input
                id="setup-username"
                type="text"
                autoComplete="username"
                required
                minLength={2}
                disabled={pending}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-password">Mot de passe</Label>
              <Input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={pending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 8 caracteres"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-token">Token de configuration</Label>
              <Input
                id="setup-token"
                type="password"
                autoComplete="off"
                required
                disabled={pending}
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Valeur de FIRST_SETUP_TOKEN"
              />
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creation…" : "Finaliser la configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
