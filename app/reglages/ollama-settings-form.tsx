"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const NO_MODEL_VALUE = "__none__";

type OllamaSettingsResponse = {
  baseUrl: string;
  hasApiKey: boolean;
  model: string;
  assistantThinkingEnabled?: boolean;
  assistantOptionsEnabled?: boolean;
  assistantTemperature?: number;
  assistantTopP?: number;
  assistantTopK?: number;
};

export function OllamaSettingsForm() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [assistantThinkingEnabled, setAssistantThinkingEnabled] =
    useState(false);
  const [assistantOptionsEnabled, setAssistantOptionsEnabled] =
    useState(true);
  const [assistantTemperature, setAssistantTemperature] = useState(1);
  const [assistantTopP, setAssistantTopP] = useState(0.95);
  const [assistantTopK, setAssistantTopK] = useState(64);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/ollama");
      const data = (await res.json()) as OllamaSettingsResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Chargement impossible.");
        return;
      }
      setBaseUrl(data.baseUrl ?? "");
      setHasApiKey(Boolean(data.hasApiKey));
      setModel((data.model ?? "").trim());
      setApiKey("");
      setAssistantThinkingEnabled(Boolean(data.assistantThinkingEnabled));
      setAssistantOptionsEnabled(data.assistantOptionsEnabled !== false);
      setAssistantTemperature(
        typeof data.assistantTemperature === "number"
          ? data.assistantTemperature
          : 1,
      );
      setAssistantTopP(
        typeof data.assistantTopP === "number" ? data.assistantTopP : 0.95,
      );
      setAssistantTopK(
        typeof data.assistantTopK === "number"
          ? Math.trunc(data.assistantTopK)
          : 64,
      );
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshModelList() {
    setListing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/ollama/models");
      const data = (await res.json()) as { models?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Liste des modeles impossible.");
        return;
      }
      const list = Array.isArray(data.models) ? data.models : [];
      setModels(list);
      setMessage(`${list.length} modele(s) trouve(s) sur le serveur.`);
    } catch {
      setError("Erreur reseau.");
    } finally {
      setListing(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        assistantThinkingEnabled,
        assistantOptionsEnabled,
        assistantTemperature,
        assistantTopP,
        assistantTopK,
      };
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim();
      }
      const res = await fetch("/api/settings/ollama", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage("Configuration Ollama enregistrée.");
      setApiKey("");
      await load();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  async function clearApiKey() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/ollama", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: null,
          model: model.trim(),
          assistantThinkingEnabled,
          assistantOptionsEnabled,
          assistantTemperature,
          assistantTopP,
          assistantTopK,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Suppression impossible.");
        return;
      }
      setMessage("Clé X-API-Key supprimée.");
      setApiKey("");
      await load();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  const showCustomModel = Boolean(model && models.length > 0 && !models.includes(model));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Serveur Ollama distant</CardTitle>
        <CardDescription>
          Réservé aux administrateurs. URL de base, en-tête{" "}
          <span className="font-mono">X-API-Key</span> si besoin, modèle via{" "}
          <span className="font-mono">GET /api/tags</span>, puis paramètres de génération de
          l&apos;assistant (corps <span className="font-mono">POST /api/chat</span>).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </div>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ollama-url">URL de base</Label>
                <Input
                  id="ollama-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://ollama.example.com"
                  autoComplete="off"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enregistre l&apos;URL puis utilise <strong>Actualiser les modèles</strong> pour
                  remplir la liste.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ollama-api-key">X-API-Key</Label>
                <Input
                  id="ollama-api-key"
                  type="password"
                  autoComplete="new-password"
                  placeholder={hasApiKey ? "•••••••• (saisir pour remplacer)" : "Optionnel"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2">
                  {models.length > 0 ? (
                    <div className="min-w-0 flex-1 flex flex-col gap-2">
                      <Label htmlFor="ollama-model-pick">Modèles sur le serveur</Label>
                      <Select
                        value={
                          models.includes(model) ? model : NO_MODEL_VALUE
                        }
                        onValueChange={(v) => {
                          if (v === NO_MODEL_VALUE) {
                            setModel("");
                          } else {
                            setModel(v);
                          }
                        }}
                      >
                        <SelectTrigger id="ollama-model-pick" className="w-full">
                          <SelectValue placeholder="Choisir dans la liste" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_MODEL_VALUE}>(aucun)</SelectItem>
                          {models.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={listing || !baseUrl.trim()}
                    onClick={() => void refreshModelList()}
                  >
                    {listing ? "Chargement…" : "Actualiser les modèles"}
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ollama-model">Nom du modèle</Label>
                  <Input
                    id="ollama-model"
                    placeholder="ex. llama3.2 — complété par la liste ou saisi à la main"
                    autoComplete="off"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                {showCustomModel ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Ce nom n&apos;est pas dans la dernière liste — vérifie qu&apos;il existe sur
                    Ollama ou actualise.
                  </p>
                ) : null}
              </div>

              <Separator className="my-2" />

              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Génération de l&apos;assistant
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stocké en base avec la connexion Ollama. Le mode thinking peut faire boucler
                    certains modèles.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <Label htmlFor="ollama-think" className="text-sm">
                      Mode thinking (Ollama <span className="font-mono">think</span>)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Affiche la réflexion dans le fil et active <span className="font-mono">think: true</span>.
                    </p>
                  </div>
                  <Switch
                    id="ollama-think"
                    checked={assistantThinkingEnabled}
                    onCheckedChange={(v) => setAssistantThinkingEnabled(Boolean(v))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <Label htmlFor="ollama-options" className="text-sm">
                      Envoyer temperature / top_p / top_k
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Si désactivé : pas de clé <span className="font-mono">options</span> — défauts Ollama du modèle.
                    </p>
                  </div>
                  <Switch
                    id="ollama-options"
                    checked={assistantOptionsEnabled}
                    onCheckedChange={(v) => setAssistantOptionsEnabled(Boolean(v))}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ollama-temp">Température</Label>
                    <Input
                      id="ollama-temp"
                      type="number"
                      step="0.05"
                      min={0}
                      max={2}
                      disabled={!assistantOptionsEnabled}
                      value={assistantTemperature}
                      onChange={(e) =>
                        setAssistantTemperature(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ollama-topp">Top P</Label>
                    <Input
                      id="ollama-topp"
                      type="number"
                      step="0.05"
                      min={0}
                      max={1}
                      disabled={!assistantOptionsEnabled}
                      value={assistantTopP}
                      onChange={(e) => setAssistantTopP(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ollama-topk">Top K</Label>
                    <Input
                      id="ollama-topk"
                      type="number"
                      step={1}
                      min={1}
                      max={100000}
                      disabled={!assistantOptionsEnabled}
                      value={assistantTopK}
                      onChange={(e) =>
                        setAssistantTopK(Math.trunc(Number(e.target.value)) || 1)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
                {hasApiKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void clearApiKey()}
                  >
                    Supprimer la clé enregistrée
                  </Button>
                ) : null}
              </div>
            </form>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          La clé est stockée en base en clair ; réserve cette instance à un environnement de
          confiance.
        </p>
      </CardFooter>
    </Card>
  );
}
