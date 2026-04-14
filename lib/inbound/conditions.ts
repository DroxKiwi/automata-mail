import type { RuleCondition, RuleField, RuleOperator } from "@prisma/client";
import { buildHeaderLookup } from "./mime";

const MAX_REGEX_LENGTH = 512;

function normalizeForCompare(
  text: string,
  caseSensitive: boolean
): string {
  return caseSensitive ? text : text.toLowerCase();
}

function getBodyHaystack(
  textBody: string | null,
  htmlBody: string | null,
  rawFallback: string
): string {
  if (textBody?.trim()) {
    return textBody;
  }
  if (htmlBody?.trim()) {
    return htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return rawFallback.slice(0, 50_000);
}

function getFieldText(
  field: RuleField,
  headerName: string | null,
  ctx: {
    mailFrom: string;
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    rawMime: string;
    headersJson: Record<string, string>;
  }
): string {
  switch (field) {
    case "FROM":
      return ctx.mailFrom;
    case "SUBJECT":
      return ctx.subject ?? "";
    case "BODY":
      return getBodyHaystack(ctx.textBody, ctx.htmlBody, ctx.rawMime);
    case "HEADER": {
      const name = (headerName ?? "").trim();
      if (!name) {
        return "";
      }
      const lookup = buildHeaderLookup(ctx.headersJson);
      return lookup.get(name.toLowerCase()) ?? "";
    }
    default:
      return "";
  }
}

export function evaluateCondition(
  condition: Pick<
    RuleCondition,
    "field" | "headerName" | "operator" | "value" | "caseSensitive"
  >,
  ctx: {
    mailFrom: string;
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    rawMime: string;
    headersJson: Record<string, string>;
  }
): boolean {
  const hay = getFieldText(condition.field, condition.headerName, ctx);
  const needle = condition.value ?? "";
  const cs = Boolean(condition.caseSensitive);

  const op: RuleOperator = condition.operator;

  if (op === "REGEX") {
    if (needle.length > MAX_REGEX_LENGTH) {
      return false;
    }
    try {
      const flags = cs ? "u" : "iu";
      const re = new RegExp(needle, flags);
      return re.test(hay);
    } catch {
      return false;
    }
  }

  const h = normalizeForCompare(hay, cs);
  const n = normalizeForCompare(needle, cs);

  switch (op) {
    case "CONTAINS":
      return h.includes(n);
    case "EQUALS":
      return h === n;
    case "STARTS_WITH":
      return h.startsWith(n);
    default:
      return false;
  }
}
