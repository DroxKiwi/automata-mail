"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilterEditor } from "@/components/filters/filter-editor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type SavedFilterListItem = {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  inboundAddress: { localPart: string; domain: string } | null;
  _count: { conditions: number; automationLinks: number };
};

type AddressOption = { id: number; localPart: string; domain: string };

type SavedFiltersListProps = {
  addresses: AddressOption[];
  filters: SavedFilterListItem[];
};

export function SavedFiltersList({ addresses, filters }: SavedFiltersListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function deleteFilter(id: number, name: string) {
    if (
      !window.confirm(
        `Supprimer le filtre « ${name} » ? Les règles déjà créées à partir de lui ne sont pas supprimées.`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/filters/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "Suppression impossible.");
        return;
      }
      if (expandedId === id) {
        setExpandedId(null);
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  function toggleEdit(id: number) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtres enregistrés</CardTitle>
        <CardDescription>
          Réutilisables dans <strong>Automate</strong> pour définir transferts et autres actions.
          Priorité plus petite = évaluée avant lors de la création d’une règle. Clique sur{" "}
          <strong>Modifier</strong> pour éditer sur place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun filtre pour le moment. Crée-en un au-dessus.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {filters.map((f) => (
              <li
                key={f.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border"
              >
                <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium">
                      {f.name}{" "}
                      <span className="text-muted-foreground">
                        (priorité {f.priority}
                        {f.enabled ? "" : ", désactivé"})
                      </span>
                      {f._count.automationLinks > 0 ? (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-normal text-primary">
                          Filtre
                        </span>
                      ) : null}
                    </div>
                    {f.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{f.description}</p>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      Portée :{" "}
                      {f.inboundAddress
                        ? `${f.inboundAddress.localPart}@${f.inboundAddress.domain}`
                        : "toutes les adresses"}
                      {" · "}
                      {f._count.conditions} condition(s)
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-row flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={expandedId === f.id ? "secondary" : "outline"}
                      size="sm"
                      disabled={deletingId === f.id}
                      onClick={() => toggleEdit(f.id)}
                    >
                      {expandedId === f.id ? "Réduire" : "Modifier"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={deletingId === f.id}
                      onClick={() => deleteFilter(f.id, f.name)}
                    >
                      {deletingId === f.id ? "…" : "Supprimer"}
                    </Button>
                  </div>
                </div>
                {expandedId === f.id ? (
                  <FilterEditor
                    key={f.id}
                    variant="inline"
                    filterId={f.id}
                    addresses={addresses}
                    onCancelEdit={() => setExpandedId(null)}
                    onSaved={() => setExpandedId(null)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
