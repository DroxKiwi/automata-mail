import type { gmail_v1 } from "googleapis";
import nodemailer from "nodemailer";
import type { ForwardMailParams } from "@/lib/inbound/forward-mail-params";
import { normalizeRfcMessageId } from "@/lib/gmail/rfc-message-id";

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

function extractMessageIdFromMimeString(mime: string): string | null {
  const m = mime.match(/(?:^|[\r\n])Message-ID:\s*(<[^>\r\n]+>|[^\s\r\n]+@[^\s\r\n]+)/i);
  if (!m?.[1]) return null;
  return normalizeRfcMessageId(m[1].trim());
}

export type GmailSendForwardMeta = {
  gmailSentMessageId: string;
  /** Sans chevrons ; sert à corréler les rebonds d’échec importés depuis Gmail. */
  outboundRfcMessageId: string;
};

/**
 * Envoie un message via Gmail API (`users.messages.send`) avec le compte OAuth déjà autorisé.
 * L’expéditeur est l’adresse du profil `me` (boîte connectée).
 */
export async function sendForwardViaGmail(
  gmail: gmail_v1.Gmail,
  params: ForwardMailParams
): Promise<GmailSendForwardMeta> {
  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromAddress = profile.data.emailAddress?.trim();
  if (!fromAddress) {
    throw new Error(
      "Impossible de recuperer l'adresse Gmail : profil vide (compte OAuth invalide ?)."
    );
  }

  const to =
    Array.isArray(params.to) && params.to.length > 0
      ? params.to.join(", ")
      : typeof params.to === "string"
        ? params.to
        : "";

  const text = params.text?.trim();
  const html = params.html?.trim();

  const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });

  const nodemailerAttachments = params.attachments?.map((a) => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
  }));

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    replyTo: params.replyTo,
    subject: params.subject.trim() || "(sans sujet)",
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(!text && !html ? { text: "" } : {}),
    ...(nodemailerAttachments?.length ? { attachments: nodemailerAttachments } : {}),
  });

  const messageBuffer = info.message as Buffer;
  const raw = toBase64Url(messageBuffer);

  const sendRes = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  const sentGmailId = sendRes.data.id;
  if (!sentGmailId) {
    throw new Error("Gmail API : aucun identifiant message apres envoi.");
  }

  let outboundRfcMessageId = "";
  try {
    const meta = await gmail.users.messages.get({
      userId: "me",
      id: sentGmailId,
      format: "metadata",
      metadataHeaders: ["Message-ID"],
    });
    const v = meta.data.payload?.headers
      ?.find((h) => h.name?.toLowerCase() === "message-id")
      ?.value?.trim();
    if (v) outboundRfcMessageId = normalizeRfcMessageId(v);
  } catch {
    /* fallback ci-dessous */
  }

  if (!outboundRfcMessageId && typeof info.messageId === "string" && info.messageId) {
    outboundRfcMessageId = normalizeRfcMessageId(info.messageId);
  }
  if (!outboundRfcMessageId) {
    const fromBuf = extractMessageIdFromMimeString(messageBuffer.toString("utf8"));
    if (fromBuf) outboundRfcMessageId = fromBuf;
  }

  if (!outboundRfcMessageId) {
    throw new Error(
      "Impossible d'obtenir le Message-ID du message envoye : les rebonds ne pourront pas etre associes au transfert."
    );
  }

  return {
    gmailSentMessageId: sentGmailId,
    outboundRfcMessageId,
  };
}
