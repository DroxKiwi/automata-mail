import { CloudMailboxProvider } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getOrCreateAppMailboxSettings(userId: number) {
  return prisma.appMailboxSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, activeProvider: CloudMailboxProvider.NONE },
  });
}

export async function getOrCreateGoogleOAuthSettings(userId: number) {
  return prisma.googleOAuthSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getOrCreateOutlookOAuthSettings(userId: number) {
  return prisma.outlookOAuthSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getOrCreateSmtpOutboundSettings(userId: number) {
  return prisma.smtpOutboundSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getOrCreateOllamaSettings(userId: number) {
  return prisma.ollamaSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}
