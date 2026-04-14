import { prisma } from "@/lib/db/prisma";

export type ResolvedOutboundSmtp = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

/**
 * Configuration SMTP sortante : uniquement la ligne `SmtpOutboundSettings` (id = 1).
 * À renseigner dans Réglages (base de données).
 */
export async function getOutboundSmtpConfig(): Promise<ResolvedOutboundSmtp | null> {
  const row = await prisma.smtpOutboundSettings.findUnique({
    where: { id: 1 },
  });

  const host = row?.host?.trim() ?? "";
  if (!host) {
    return null;
  }

  const from = row?.fromAddress?.trim() ?? "";
  if (!from) {
    return null;
  }

  return {
    host,
    port: row!.port,
    secure: row!.secure,
    user: row!.authUser?.trim() || undefined,
    pass: row!.authPassword?.trim() || undefined,
    from,
  };
}
