import type { Attachment } from "mailparser";
import { simpleParser } from "mailparser";

export type ParsedInboundAttachment = {
  filename: string | null;
  contentType: string | null;
  sizeBytes: number;
  contentId: string | null;
  disposition: string | null;
};

export type ParsedInboundMime = {
  messageIdHeader: string | null;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  headersJson: Record<string, string>;
  attachments: ParsedInboundAttachment[];
  /**
   * Expéditeur principal dérivé de l’objet `from` mailparser (les en-têtes bruts
   * peuvent être des structures non converties correctement en chaîne).
   */
  envelopeFrom: string | null;
};

function headerValueToString(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && "value" in value) {
    const v = (value as { value?: unknown }).value;
    if (typeof v === "string") {
      return v;
    }
    if (Array.isArray(v)) {
      return v.map(headerValueToString).join(", ");
    }
  }
  if (typeof value === "object" && "text" in value) {
    const t = (value as { text?: unknown }).text;
    if (typeof t === "string") {
      return t;
    }
  }
  return String(value);
}

function parseAttachmentsMeta(parsed: { attachments?: Attachment[] }): ParsedInboundAttachment[] {
  if (!Array.isArray(parsed.attachments) || parsed.attachments.length === 0) {
    return [];
  }
  const out: ParsedInboundAttachment[] = [];
  for (const a of parsed.attachments) {
    if (!a || typeof a !== "object") continue;
    const sizeFromField = typeof a.size === "number" ? a.size : 0;
    const bufLen = Buffer.isBuffer(a.content) ? a.content.length : 0;
    const sizeBytes = sizeFromField > 0 ? sizeFromField : bufLen;
    const cid =
      typeof a.contentId === "string" && a.contentId.trim()
        ? a.contentId.trim()
        : typeof a.cid === "string" && a.cid.trim()
          ? a.cid.trim()
          : null;
    out.push({
      filename: typeof a.filename === "string" && a.filename.trim() ? a.filename.trim() : null,
      contentType:
        typeof a.contentType === "string" && a.contentType.trim() ? a.contentType.trim() : null,
      sizeBytes,
      contentId: cid,
      disposition:
        typeof a.contentDisposition === "string" && a.contentDisposition.trim()
          ? a.contentDisposition.trim()
          : null,
    });
  }
  return out;
}

/**
 * Construit une carte en-tête insensible à la casse pour la lecture.
 */
export function buildHeaderLookup(headersJson: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(headersJson)) {
    map.set(k.toLowerCase(), v);
  }
  return map;
}

function formatFirstMailbox(
  obj?: { value?: Array<{ address?: string; name?: string }> },
): string | null {
  const vals = obj?.value;
  if (!Array.isArray(vals) || vals.length === 0) {
    return null;
  }
  const first = vals[0];
  const addr = typeof first?.address === "string" ? first.address.trim() : "";
  if (!addr || !addr.includes("@")) {
    return null;
  }
  const name = typeof first?.name === "string" ? first.name.trim() : "";
  if (name) {
    return `${name} <${addr}>`;
  }
  return addr;
}

/**
 * Adresse expéditeur fiable depuis mailparser (`from` / `sender`), pas depuis la sérialisation des en-têtes.
 */
function envelopeFromMailparser(parsed: {
  from?: { value?: Array<{ address?: string; name?: string }> };
  sender?: { value?: Array<{ address?: string; name?: string }> };
}): string | null {
  return formatFirstMailbox(parsed.from) ?? formatFirstMailbox(parsed.sender);
}

export async function parseInboundMime(rawMime: string): Promise<ParsedInboundMime> {
  const parsed = await simpleParser(rawMime);

  const headersJson: Record<string, string> = {};
  const h = parsed.headers;
  if (h && typeof (h as Map<string, unknown>).forEach === "function") {
    (h as Map<string, unknown>).forEach((value, key) => {
      headersJson[String(key)] = headerValueToString(value);
    });
  }

  const envelopeFrom = envelopeFromMailparser(parsed);
  if (envelopeFrom) {
    headersJson.From = envelopeFrom;
  }

  const messageIdHeader =
    typeof parsed.messageId === "string" && parsed.messageId.trim()
      ? parsed.messageId.trim()
      : null;

  const subject =
    typeof parsed.subject === "string" && parsed.subject.trim()
      ? parsed.subject.trim()
      : null;

  const textBody =
    typeof parsed.text === "string" && parsed.text.trim() ? parsed.text : null;

  const htmlBody =
    typeof parsed.html === "string" && parsed.html.trim() ? parsed.html : null;

  return {
    messageIdHeader,
    subject,
    textBody,
    htmlBody,
    headersJson,
    attachments: parseAttachmentsMeta(parsed),
    envelopeFrom,
  };
}
