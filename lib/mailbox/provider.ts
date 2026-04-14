import { CloudMailboxProvider } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function ensureAppMailboxSettingsRow(): Promise<void> {
  await prisma.appMailboxSettings.upsert({
    where: { id: 1 },
    create: { id: 1, activeProvider: CloudMailboxProvider.NONE },
    update: {},
  });
}

export async function getActiveCloudProvider(): Promise<CloudMailboxProvider> {
  await ensureAppMailboxSettingsRow();
  const row = await prisma.appMailboxSettings.findUnique({
    where: { id: 1 },
    select: { activeProvider: true },
  });
  return row?.activeProvider ?? CloudMailboxProvider.NONE;
}
