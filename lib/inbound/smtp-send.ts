import nodemailer from "nodemailer";
import { getGmailClientFromDb } from "@/lib/gmail/oauth";
import type { GmailSendForwardMeta } from "@/lib/gmail/send-mail";
import { sendForwardViaGmail } from "@/lib/gmail/send-mail";
import type { ForwardMailParams } from "@/lib/inbound/forward-mail-params";
import { getOutboundSmtpConfig } from "@/lib/smtp/smtp-config";
import { getOutlookAccessTokenFromDb } from "@/lib/outlook/oauth";
import type { OutlookSendForwardMeta } from "@/lib/outlook/send-mail";
import { sendForwardViaOutlook } from "@/lib/outlook/send-mail";

export type { ForwardMailParams };

export type SendForwardResult =
  | ({ channel: "gmail" } & GmailSendForwardMeta)
  | ({ channel: "outlook" } & OutlookSendForwardMeta)
  | { channel: "smtp" };

/**
 * Transfert / envoi sortant : compte cloud actif (Gmail ou Outlook) si connecté ;
 * sinon SMTP sortant configuré en Réglages.
 */
export async function sendForwardMail(params: ForwardMailParams): Promise<SendForwardResult> {
  const gmail = await getGmailClientFromDb();
  if (gmail) {
    const meta = await sendForwardViaGmail(gmail, params);
    return { channel: "gmail", ...meta };
  }

  const outlookToken = await getOutlookAccessTokenFromDb();
  if (outlookToken) {
    const meta = await sendForwardViaOutlook(outlookToken, params);
    return { channel: "outlook", ...meta };
  }

  const cfg = await getOutboundSmtpConfig();
  if (!cfg) {
    throw new Error(
      "Aucune methode d'envoi : connecte Gmail ou Outlook (Reglages) ou configure le SMTP sortant (hote + expediteur)."
    );
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });

  const to =
    Array.isArray(params.to) && params.to.length > 0
      ? params.to.join(", ")
      : typeof params.to === "string"
        ? params.to
        : "";

  const nodemailerAttachments = params.attachments?.map((a) => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
  }));

  await transporter.sendMail({
    from: cfg.from,
    to,
    replyTo: params.replyTo,
    subject: params.subject.trim() || "(sans sujet)",
    text: params.text?.trim() ? params.text : undefined,
    html: params.html?.trim() ? params.html : undefined,
    ...(nodemailerAttachments?.length ? { attachments: nodemailerAttachments } : {}),
  });
  return { channel: "smtp" };
}
