import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { MailAttachmentInput } from "@/lib/inbound/forward-mail-params";
import { sendForwardMail } from "@/lib/inbound/smtp-send";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";

const MAX_BYTES_PER_FILE = 15 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS = 22 * 1024 * 1024;

function parseToList(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeHtmlText(html: string, text: string): {
  text?: string;
  html?: string;
} {
  const textTrim = text.trim();
  const htmlStripped = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const useHtml = htmlStripped.length > 0;
  return {
    text: textTrim || undefined,
    html: useHtml ? html : undefined,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Utilisez multipart/form-data (formulaire avec pieces jointes)." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const toRaw = form.get("to");
  const subjectRaw = form.get("subject");
  const htmlRaw = form.get("html");
  const textRaw = form.get("text");

  const toList = parseToList(typeof toRaw === "string" ? toRaw : "");
  if (toList.length === 0) {
    return NextResponse.json(
      { error: "Au moins un destinataire est requis." },
      { status: 400 },
    );
  }

  const subject =
    typeof subjectRaw === "string" ? subjectRaw.trim() : "";
  const html = typeof htmlRaw === "string" ? htmlRaw : "";
  const text = typeof textRaw === "string" ? textRaw : "";

  const attachments: MailAttachmentInput[] = [];
  let totalAttach = 0;

  const files = form
    .getAll("attachment")
    .filter((v): v is File => v instanceof File && v.size > 0);

  for (const file of files) {
    if (file.size > MAX_BYTES_PER_FILE) {
      return NextResponse.json(
        {
          error: `Fichier trop volumineux : ${file.name} (max. ${MAX_BYTES_PER_FILE / 1024 / 1024} Mo).`,
        },
        { status: 400 },
      );
    }
    totalAttach += file.size;
    if (totalAttach > MAX_TOTAL_ATTACHMENTS) {
      return NextResponse.json(
        { error: "Taille totale des pieces jointes trop importante (max. ~22 Mo)." },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name || "piece-jointe",
      content: buf,
      contentType: file.type || undefined,
    });
  }

  const { text: outText, html: outHtml } = normalizeHtmlText(html, text);

  if (!outText && !outHtml && attachments.length === 0) {
    return NextResponse.json(
      { error: "Saisissez un message ou ajoutez une piece jointe." },
      { status: 400 },
    );
  }

  const correlationId = `compose:${randomUUID()}`;

  try {
    await sendForwardMail({
      to: toList.length === 1 ? toList[0]! : toList,
      subject: subject || "(sans sujet)",
      text: outText,
      html: outHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "ui_compose_sent",
      direction: "out",
      summary: `Message rédigé dans la boîte, envoyé vers ${toList.join(", ")} — « ${(subject || "(sans sujet)").slice(0, 120)} »`,
      detail: {
        to: toList,
        subject: subject || "(sans sujet)",
        userEmail: user.email,
        attachmentCount: attachments.length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Echec envoi.";
    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "ui_compose_failed",
      direction: "out",
      summary: `Échec d\u2019envoi depuis la rédaction : ${msg.slice(0, 200)}`,
      detail: {
        to: toList,
        subject: subject || "(sans sujet)",
        userEmail: user.email,
        error: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
