import type { ForwardMailParams } from "@/lib/inbound/forward-mail-params";
import { normalizeRfcMessageId } from "@/lib/gmail/rfc-message-id";

export type OutlookSendForwardMeta = {
  outlookSentMessageId: string;
  outboundRfcMessageId: string;
};

type GraphRecipient = { emailAddress: { address: string } };

function toRecipients(
  to: ForwardMailParams["to"]
): GraphRecipient[] {
  const list =
    Array.isArray(to) && to.length > 0
      ? to
      : typeof to === "string" && to.trim()
        ? [to.trim()]
        : [];
  return list.map((address) => ({ emailAddress: { address: address.trim() } }));
}

/**
 * Envoie un message via Microsoft Graph (`sendMail`).
 * Récupère le Message-ID dans Éléments envoyés juste après l’envoi (corrélation rebonds).
 */
export async function sendForwardViaOutlook(
  accessToken: string,
  params: ForwardMailParams
): Promise<OutlookSendForwardMeta> {
  const toList = toRecipients(params.to);
  if (toList.length === 0) {
    throw new Error("Destinataire(s) vide(s).");
  }

  const text = params.text?.trim();
  const html = params.html?.trim();
  const contentType = html ? "HTML" : "Text";
  const content =
    html || text || "";

  const attachments =
    params.attachments?.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename || "piece-jointe",
      contentType: a.contentType || "application/octet-stream",
      contentBytes: Buffer.from(a.content).toString("base64"),
    })) ?? [];

  const message: Record<string, unknown> = {
    subject: params.subject.trim() || "(sans sujet)",
    body: { contentType, content },
    toRecipients: toList,
    ...(params.replyTo?.trim()
      ? { replyTo: [{ emailAddress: { address: params.replyTo.trim() } }] }
      : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
  };

  const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!sendRes.ok) {
    const errText = (await sendRes.text()).slice(0, 400);
    throw new Error(`Graph sendMail : ${sendRes.status} ${errText}`);
  }

  const wantSubject = params.subject.trim() || "(sans sujet)";
  await new Promise((r) => setTimeout(r, 600));

  const sentRes = await fetch(
    "https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?" +
      new URLSearchParams({
        $top: "8",
        $orderby: "sentDateTime desc",
        $select: "id,subject,sentDateTime,internetMessageId",
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!sentRes.ok) {
    throw new Error(
      `Graph sent items : ${sentRes.status} — impossible de lire le Message-ID.`
    );
  }
  const sentJson = (await sentRes.json()) as {
    value?: Array<{
      id?: string;
      subject?: string;
      internetMessageId?: string;
      sentDateTime?: string;
    }>;
  };
  const rows = sentJson.value ?? [];
  const match =
    rows.find((m) => (m.subject ?? "").trim() === wantSubject) ?? rows[0];
  const internetMessageId = match?.internetMessageId?.trim();
  if (!internetMessageId) {
    throw new Error(
      "Impossible d'obtenir le Message-ID du message envoye (Elements envoyes)."
    );
  }

  return {
    outlookSentMessageId: match?.id ?? "",
    outboundRfcMessageId: normalizeRfcMessageId(internetMessageId),
  };
}
