function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function formatSqlSelectFriendly(args: unknown): string {
  const o = asRecord(args) ?? {};
  const q = typeof o.query === "string" ? o.query : "";
  const ilike = q.match(/ILIKE\s+'%([^']*)%'/i);
  if (ilike?.[1]) {
    return `Je consulte la base de données en cherchant les messages correspondant à « ${ilike[1]} »…`;
  }
  const like = q.match(/LIKE\s+'%([^']*)%'/i);
  if (like?.[1]) {
    return `Je consulte la base de données (filtre « ${like[1]} »)…`;
  }
  const flat = q.replace(/\s+/g, " ").trim();
  const short =
    flat.length > 140 ? `${flat.slice(0, 137).trim()}…` : flat;
  return short.length > 0
    ? `Je lance une recherche en base de données (${short})…`
    : `Je lance une recherche en base de données…`;
}

function formatNavigateAppFriendly(args: unknown): string {
  const o = asRecord(args) ?? {};
  const p = typeof o.path === "string" ? o.path.trim() : "";
  if (p === "/boite" || p === "") {
    return `J’ouvre la liste des messages…`;
  }
  const m = /^\/boite\/([1-9]\d*)$/.exec(p);
  if (m) {
    return `J’ouvre le message dans la boîte (réf. ${m[1]})…`;
  }
  return `J’ouvre la page demandée dans l’application…`;
}

function formatArchiveRequestFriendly(args: unknown): string {
  const o = asRecord(args) ?? {};
  const id = o.id;
  const idPart =
    id !== undefined && id !== null && String(id).trim() !== ""
      ? ` ${String(id).trim()}`
      : "";
  return `Je prépare une demande d’archivage pour le message${idPart}…`;
}

/**
 * Texte utilisateur (français) affiché à la place du JSON `tool_calls` dans le fil de discussion.
 */
export function formatFriendlyToolCallsMessage(
  calls: { name: string; arguments: unknown }[],
): string {
  if (calls.length === 0) return "Préparation de l’action…";
  const lines = calls.map((c) => {
    const name = c.name.trim();
    const args = c.arguments ?? {};
    switch (name) {
      case "sql_select":
        return formatSqlSelectFriendly(args);
      case "navigate_app":
        return formatNavigateAppFriendly(args);
      case "assistant_help":
        return `Je consulte l’aide sur les outils disponibles…`;
      case "request_archive_inbox_message":
        return formatArchiveRequestFriendly(args);
      default:
        return `J’utilise l’outil « ${name} »…`;
    }
  });
  return lines.join("\n\n");
}
