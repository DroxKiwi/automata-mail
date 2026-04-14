import { toolDefinition } from "@/lib/assistant/tools/registry";

/** Clés de palette pour le style des pastilles (mappées côté client). */
export type ToolTagPalette =
  | "violet"
  | "sky"
  | "cyan"
  | "emerald"
  | "amber"
  | "orange"
  | "slate";

export function toolTagDisplayMeta(toolName: string): {
  label: string;
  palette: ToolTagPalette;
} {
  const name = toolName.trim();
  const known: Record<string, { label: string; palette: ToolTagPalette }> = {
    assistant_help: { label: "Aide des outils", palette: "violet" },
    sql_select: { label: "Recherche en base de donnée", palette: "sky" },
    navigate_app: { label: "Navigation", palette: "emerald" },
    request_archive_inbox_message: {
      label: "Demande d’archivage",
      palette: "orange",
    },
  };
  if (known[name]) {
    return known[name];
  }
  const def = toolDefinition(name);
  return {
    label: def?.name ?? name,
    palette: "slate",
  };
}
