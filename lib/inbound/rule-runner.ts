import type { Prisma } from "@prisma/client";
import {
  ActionLogStatus,
  type Rule,
  type RuleAction,
  type RuleCondition,
} from "@prisma/client";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";
import { evaluateCondition } from "./conditions";
import type { ParsedInboundMime } from "./mime";
import { sendForwardMail } from "./smtp-send";

type RuleLoaded = Rule & {
  conditions: RuleCondition[];
  actions: RuleAction[];
};

function automationDetail(rule: RuleLoaded): Record<string, unknown> {
  const d: Record<string, unknown> = {
    ruleId: rule.id,
    ruleName: rule.name,
  };
  if (rule.automationId != null) {
    d.automationId = rule.automationId;
  }
  return d;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function logAction(
  inboundMessageId: number,
  ruleId: number,
  actionId: number | null,
  status: ActionLogStatus,
  detail?: Prisma.InputJsonValue
) {
  await prisma.messageActionLog.create({
    data: {
      inboundMessageId,
      ruleId,
      actionId,
      status,
      detail: detail ?? undefined,
    },
  });
}

function applyRewriteSubject(
  current: string,
  cfg: Record<string, unknown>
): string {
  const mode = cfg.mode;
  if (mode === "prefix") {
    const prefix = typeof cfg.prefix === "string" ? cfg.prefix : "";
    return prefix + current;
  }
  if (mode === "replace") {
    const subject = typeof cfg.subject === "string" ? cfg.subject : "";
    return subject;
  }
  return current;
}

/**
 * Évalue les règles actives sur un message déjà enregistré (création MTA ou worker après sync cloud).
 */
export async function runRulesEngineForInboundMessage(input: {
  inboundMessageId: number;
  inboundAddressId: number;
  mailFrom: string;
  rawMime: string;
  parsed: ParsedInboundMime;
  correlationId: string | null;
}): Promise<void> {
  const {
    inboundMessageId,
    inboundAddressId,
    mailFrom,
    rawMime,
    parsed,
    correlationId,
  } = input;
  const traceId = correlationId ?? `inbound-msg:${inboundMessageId}`;

  const rules = (await prisma.rule.findMany({
    where: {
      enabled: true,
      OR: [{ inboundAddressId: null }, { inboundAddressId }],
    },
    orderBy: { priority: "asc" },
    include: {
      conditions: true,
      actions: { orderBy: { order: "asc" } },
    },
  })) as RuleLoaded[];

  const condCtx = {
    mailFrom,
    subject: parsed.subject,
    textBody: parsed.textBody,
    htmlBody: parsed.htmlBody,
    rawMime,
    headersJson: parsed.headersJson,
  };

  for (const rule of rules) {
    const allMatch = rule.conditions.every((c: RuleCondition) =>
      evaluateCondition(c, condCtx)
    );

    if (!allMatch) {
      await logAction(inboundMessageId, rule.id, null, ActionLogStatus.SKIPPED, {
        reason: "conditions_not_met",
      });
      continue;
    }

    let workingSubject = parsed.subject ?? "";
    let workingText = parsed.textBody ?? "";
    let workingHtml: string | null = parsed.htmlBody;
    let dropped = false;

    for (const action of rule.actions) {
      if (dropped) {
        break;
      }

      const cfg =
        action.config && typeof action.config === "object"
          ? (action.config as Record<string, unknown>)
          : {};

      try {
        switch (action.type) {
          case "REWRITE_SUBJECT": {
            workingSubject = applyRewriteSubject(workingSubject, cfg);
            await logAction(
              inboundMessageId,
              rule.id,
              action.id,
              ActionLogStatus.SENT,
              { type: "REWRITE_SUBJECT" }
            );
            break;
          }
          case "PREPEND_TEXT": {
            const text = typeof cfg.text === "string" ? cfg.text : "";
            workingText = text + (workingText ? `\n\n${workingText}` : "");
            if (workingHtml) {
              workingHtml = `<div>${escapeHtml(text)}</div>${workingHtml}`;
            } else if (text) {
              workingHtml = `<div>${escapeHtml(text)}</div>`;
            }
            await logAction(
              inboundMessageId,
              rule.id,
              action.id,
              ActionLogStatus.SENT,
              { type: "PREPEND_TEXT" }
            );
            break;
          }
          case "DROP": {
            dropped = true;
            await logAction(inboundMessageId, rule.id, action.id, ActionLogStatus.SENT, {
              type: "DROP",
            });
            await mailFlowLogSafe({
              correlationId: traceId,
              actor: "next",
              step: "rule_message_dropped",
              direction: "in",
              summary: `Message #${inboundMessageId} écarté par la règle « ${rule.name} » (action supprimer)`,
              detail: {
                inboundMessageId,
                ...automationDetail(rule),
              },
            });
            await prisma.inboundMessage.update({
              where: { id: inboundMessageId },
              data: { archived: true },
            });
            break;
          }
          case "FORWARD": {
            const to = typeof cfg.to === "string" ? cfg.to.trim() : "";
            if (!to) {
              await logAction(
                inboundMessageId,
                rule.id,
                action.id,
                ActionLogStatus.FAILED,
                { error: "Adresse de transfert vide" }
              );
              break;
            }
            try {
              await mailFlowLogSafe({
                correlationId: traceId,
                actor: "next",
                step: "smtp_outbound_attempt",
                direction: "out",
                summary: `Transfert sortant vers ${to} (regle #${rule.id})`,
                detail: {
                  to,
                  inboundMessageId,
                  actionId: action.id,
                  ...automationDetail(rule),
                },
              });
              const sendResult = await sendForwardMail({
                to,
                subject: workingSubject,
                text: workingText || undefined,
                html: workingHtml || undefined,
                replyTo: mailFrom,
              });
              const forwardDetail: Record<string, unknown> = { type: "FORWARD", to };
              if (sendResult.channel === "gmail") {
                forwardDetail.outboundRfcMessageId = sendResult.outboundRfcMessageId;
                forwardDetail.gmailSentMessageId = sendResult.gmailSentMessageId;
              }
              if (sendResult.channel === "outlook") {
                forwardDetail.outboundRfcMessageId = sendResult.outboundRfcMessageId;
                forwardDetail.outlookSentMessageId = sendResult.outlookSentMessageId;
              }
              await logAction(
                inboundMessageId,
                rule.id,
                action.id,
                ActionLogStatus.SENT,
                forwardDetail as Prisma.InputJsonValue
              );
              await mailFlowLogSafe({
                correlationId: traceId,
                actor: "next",
                step: "smtp_outbound_sent",
                direction: "out",
                summary: `Transfert sortant reussi vers ${to}`,
                detail: {
                  to,
                  inboundMessageId,
                  ...automationDetail(rule),
                },
              });
              await prisma.inboundMessage.update({
                where: { id: inboundMessageId },
                data: { archived: true },
              });
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "Erreur envoi sortant";
              await logAction(
                inboundMessageId,
                rule.id,
                action.id,
                ActionLogStatus.FAILED,
                { type: "FORWARD", to, error: msg }
              );
              await mailFlowLogSafe({
                correlationId: traceId,
                actor: "next",
                step: "smtp_outbound_failed",
                direction: "out",
                summary: `Echec transfert sortant vers ${to}: ${msg.slice(0, 200)}`,
                detail: {
                  to,
                  inboundMessageId,
                  error: msg,
                  ...automationDetail(rule),
                },
              });
            }
            break;
          }
          case "ARCHIVE": {
            await prisma.inboundMessage.update({
              where: { id: inboundMessageId },
              data: { archived: true },
            });
            await logAction(
              inboundMessageId,
              rule.id,
              action.id,
              ActionLogStatus.SENT,
              { type: "ARCHIVE" }
            );
            await mailFlowLogSafe({
              correlationId: traceId,
              actor: "next",
              step: "rule_message_archived",
              direction: "in",
              summary: `Message #${inboundMessageId} archivé par la règle « ${rule.name} »`,
              detail: {
                inboundMessageId,
                ...automationDetail(rule),
              },
            });
            break;
          }
          case "AUTO_REPLY": {
            const subjectCfg =
              typeof cfg.subject === "string" ? cfg.subject.trim() : "";
            const replyText = typeof cfg.text === "string" ? cfg.text : "";
            const replyHtml = typeof cfg.html === "string" ? cfg.html : "";
            if (!replyText.trim() && !replyHtml.trim()) {
              await logAction(
                inboundMessageId,
                rule.id,
                action.id,
                ActionLogStatus.FAILED,
                { type: "AUTO_REPLY", error: "Corps vide" }
              );
              break;
            }
            const subj =
              subjectCfg ||
              (workingSubject.trim()
                ? `Re: ${workingSubject.trim()}`
                : "Re: (sans sujet)");
            try {
              await mailFlowLogSafe({
                correlationId: traceId,
                actor: "next",
                step: "auto_reply_attempt",
                direction: "out",
                summary: `Reponse automatique vers ${mailFrom}`,
                detail: {
                  inboundMessageId,
                  actionId: action.id,
                  ...automationDetail(rule),
                },
              });
              const sendResult = await sendForwardMail({
                to: mailFrom,
                subject: subj,
                text: replyText.trim() ? replyText : undefined,
                html: replyHtml.trim() ? replyHtml : undefined,
              });
              const detail: Record<string, unknown> = {
                type: "AUTO_REPLY",
                to: mailFrom,
              };
              if (sendResult.channel === "gmail") {
                detail.gmailSentMessageId = sendResult.gmailSentMessageId;
              }
              if (sendResult.channel === "outlook") {
                detail.outlookSentMessageId = sendResult.outlookSentMessageId;
              }
              await logAction(
                inboundMessageId,
                rule.id,
                action.id,
                ActionLogStatus.SENT,
                detail as Prisma.InputJsonValue
              );
              await mailFlowLogSafe({
                correlationId: traceId,
                actor: "next",
                step: "rule_auto_reply_sent",
                direction: "out",
                summary: `Réponse automatique envoyée à ${mailFrom} (règle « ${rule.name} »)`,
                detail: {
                  inboundMessageId,
                  to: mailFrom,
                  ...automationDetail(rule),
                },
              });
              await prisma.inboundMessage.update({
                where: { id: inboundMessageId },
                data: { archived: true },
              });
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "Erreur envoi reponse auto";
              await logAction(
                inboundMessageId,
                rule.id,
                action.id,
                ActionLogStatus.FAILED,
                { type: "AUTO_REPLY", to: mailFrom, error: msg }
              );
            }
            break;
          }
          default:
            await logAction(
              inboundMessageId,
              rule.id,
              action.id,
              ActionLogStatus.FAILED,
              { error: `Type d action non gere: ${String(action.type)}` }
            );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logAction(inboundMessageId, rule.id, action.id, ActionLogStatus.FAILED, {
          error: msg,
        });
      }
    }

    if (rule.stopProcessing) {
      break;
    }
  }
}

export async function processInboundForAddress(input: {
  inboundAddressId: number;
  mailFrom: string;
  rcptTo: string[];
  rawMime: string;
  parsed: ParsedInboundMime;
  correlationId: string;
}): Promise<{ inboundMessageId: number }> {
  const {
    inboundAddressId,
    mailFrom,
    rcptTo,
    rawMime,
    parsed,
    correlationId,
  } = input;

  const message = await prisma.inboundMessage.create({
    data: {
      inboundAddressId,
      correlationId,
      messageIdHeader: parsed.messageIdHeader,
      mailFrom,
      rcptTo: rcptTo as unknown as Prisma.InputJsonValue,
      subject: parsed.subject,
      rawMime,
      textBody: parsed.textBody,
      htmlBody: parsed.htmlBody,
      headers: parsed.headersJson as Prisma.InputJsonValue,
    },
  });

  if (parsed.attachments.length > 0) {
    await prisma.inboundAttachment.createMany({
      data: parsed.attachments.map((a) => ({
        inboundMessageId: message.id,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        contentId: a.contentId,
        disposition: a.disposition,
      })),
    });
  }

  await mailFlowLogSafe({
    correlationId,
    actor: "next",
    step: "inbound_message_stored",
    direction: "in",
    summary: `Message enregistre #${message.id} (adresse entree #${inboundAddressId})`,
    detail: {
      inboundMessageId: message.id,
      inboundAddressId,
      subject: parsed.subject,
    },
  });

  await runRulesEngineForInboundMessage({
    inboundMessageId: message.id,
    inboundAddressId,
    mailFrom,
    rawMime,
    parsed,
    correlationId,
  });

  await prisma.inboundMessage.update({
    where: { id: message.id },
    data: { rulesEvaluatedAt: new Date() },
  });

  return { inboundMessageId: message.id };
}
