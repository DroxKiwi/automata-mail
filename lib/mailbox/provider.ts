import { CloudMailboxProvider } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function ensureAppMailboxSettingsRow(userId: number): Promise<void> {
  await prisma.appMailboxSettings.upsert({
    where: { userId },
    create: { userId, activeProvider: CloudMailboxProvider.NONE },
    update: {},
  });
}

export async function getActiveCloudProvider(userId: number): Promise<CloudMailboxProvider> {
  await ensureAppMailboxSettingsRow(userId);
  const row = await prisma.appMailboxSettings.findUnique({
    where: { userId },
    select: { activeProvider: true },
  });
  return row?.activeProvider ?? CloudMailboxProvider.NONE;
}
