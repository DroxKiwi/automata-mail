import { prisma } from "@/lib/db/prisma";

/** Longueur max du SQL soumis (caractères). */
export const ASSISTANT_SQL_MAX_LENGTH = 12_000;

/** Plafond de lignes renvoyées (l’enveloppe ajoute LIMIT + 1 pour détecter la troncature). */
export const ASSISTANT_SQL_MAX_ROWS = 500;

/**
 * Tables réservées aux admins (secrets ou comptes). Les comptes standards ne peuvent pas les citer dans la requête.
 * Noms Prisma / PostgreSQL avec casse (identifiants entre guillemets dans le SQL).
 */
const TABLES_ADMIN_ONLY = [
  "User",
  "TransferShortcut",
  "OutlookOAuthSettings",
  "SmtpOutboundSettings",
  "OllamaSettings",
  "GoogleOAuthSettings",
] as const;

const DANGEROUS_PATTERNS: RegExp[] = [
  /\binsert\s+into\b/i,
  /\bdelete\s+from\b/i,
  /\btruncate\b/i,
  /\bdrop\s+/i,
  /\balter\s+/i,
  /\bcreate\s+/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bcopy\s+/i,
  /\bexecute\s+/i,
  /\bcall\s+/i,
  /\bpg_sleep\b/i,
  /\binto\s+outfile\b/i,
  /\blisten\b/i,
  /\bnotify\b/i,
];

function stripSqlComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/** Retire les littéraux '…' (approximatif) pour analyser les identifiants. */
function stripSqlSingleQuotedStrings(s: string): string {
  return s.replace(/'(?:[^']|'')*'/g, " ");
}

function referencesAdminOnlyTable(sql: string, isAdmin: boolean): boolean {
  if (isAdmin) return false;
  const probe = stripSqlSingleQuotedStrings(stripSqlComments(sql));
  for (const name of TABLES_ADMIN_ONLY) {
    if (new RegExp(`"${name}"`, "i").test(probe)) return true;
    if (new RegExp(`\\b${name}\\b`, "i").test(probe)) return true;
  }
  return false;
}

function isSelectShape(sql: string): boolean {
  const s = stripSqlComments(sql).trim();
  return /^\s*(with\s+[\s(]|select\s+)/i.test(s);
}

export type SqlSelectResult =
  | {
      ok: true;
      rows: unknown[];
      rowCount: number;
      truncated: boolean;
    }
  | { ok: false; error: string };

/**
 * Exécute un SELECT (ou WITH … SELECT) en lecture seule, avec enveloppe LIMIT.
 */
export async function executeAssistantSqlSelect(
  sqlInput: string,
  isAdmin: boolean,
): Promise<SqlSelectResult> {
  const sql = sqlInput.trim();
  if (!sql) {
    return { ok: false, error: "Empty query." };
  }
  if (sql.length > ASSISTANT_SQL_MAX_LENGTH) {
    return { ok: false, error: `Query exceeds ${ASSISTANT_SQL_MAX_LENGTH} characters.` };
  }

  const withoutTrailingSemicolons = sql.replace(/;+\s*$/g, "").trim();
  if (withoutTrailingSemicolons.includes(";")) {
    return { ok: false, error: "Only a single statement is allowed (no ; in the middle)." };
  }

  if (!isSelectShape(withoutTrailingSemicolons)) {
    return {
      ok: false,
      error: 'Query must start with SELECT or WITH … (read-only).',
    };
  }

  const head = stripSqlComments(withoutTrailingSemicolons).trimStart();
  if (/^(insert|update|delete|merge|truncate|drop|create|alter|grant|revoke)\b/i.test(head)) {
    return { ok: false, error: "Mutation statements are not allowed." };
  }

  const checked = stripSqlComments(withoutTrailingSemicolons);
  for (const re of DANGEROUS_PATTERNS) {
    if (re.test(checked)) {
      return { ok: false, error: "Query contains forbidden keywords (mutations / side effects)." };
    }
  }

  if (referencesAdminOnlyTable(withoutTrailingSemicolons, isAdmin)) {
    return {
      ok: false,
      error:
        "This query references admin-only tables (User, OAuth/SMTP/Ollama settings, TransferShortcut).",
    };
  }

  const wrapped = `SELECT * FROM (${withoutTrailingSemicolons}) AS "_assistant_sub" LIMIT ${
    ASSISTANT_SQL_MAX_ROWS + 1
  }`;

  try {
    const rows = (await prisma.$queryRawUnsafe(wrapped)) as Record<string, unknown>[];
    const truncated = rows.length > ASSISTANT_SQL_MAX_ROWS;
    const out = truncated ? rows.slice(0, ASSISTANT_SQL_MAX_ROWS) : rows;
    return {
      ok: true,
      rows: out,
      rowCount: out.length,
      truncated,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 500) };
  }
}

/**
 * Résumé des tables pour le prompt système (noms entre guillemets doubles en SQL PostgreSQL).
 */
export const ASSISTANT_SQL_SCHEMA_HINT = `PostgreSQL + Prisma: use double-quoted identifiers matching model names.

**Core mail**
- \`"InboundMessage"\`: emails (\`id\`, \`mailFrom\`, \`subject\`, \`textBody\`, \`htmlBody\`, \`receivedAt\`, \`archived\`, \`readAt\`, \`inboundAddressId\`, …).
- \`"InboundAttachment"\`: \`inboundMessageId\`, \`filename\`, \`sizeBytes\`, …
- \`"InboundAddress"\`: reception addresses (\`localPart\`, \`domain\`, \`isActive\`).

**Rules / automation**
- \`"Rule"\`, \`"RuleCondition"\`, \`"RuleAction"\`, \`"MessageActionLog"\`, \`"Filter"\`, \`"FilterCondition"\`, \`"Automation"\`, \`"AutomationOnFilter"\`.

**Other**
- \`"MailFlowEvent"\` (pipeline log), \`"AppMailboxSettings"\` (singleton cloud provider).

**Admin-only** (forbidden in SQL for non-admin users): \`"User"\`, \`"TransferShortcut"\`, \`"OutlookOAuthSettings"\`, \`"SmtpOutboundSettings"\`, \`"OllamaSettings"\`, \`"GoogleOAuthSettings"\`. Admins: avoid selecting secret columns (\`"passwordHash"\`, \`"sessionToken"\`, OAuth secrets, SMTP password, API keys).

**Tips**
- Count messages: \`SELECT COUNT(*)::int AS c FROM "InboundMessage" WHERE archived = false\`.
- Latest in inbox (simplified): filter \`archived = false\` and join \`"InboundAddress"\` with \`"isActive" = true\` when needed; UI boîte uses extra rule-engine filters — approximate with \`archived\` + active address.
- Always expect at most ${ASSISTANT_SQL_MAX_ROWS} rows; if \`truncated: true\`, narrow the query or add filters.
`;
