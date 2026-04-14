import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AutomateWorkspace } from "@/components/automation/automate-workspace";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export default async function AutomatePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [filters, rules] = await Promise.all([
    prisma.filter.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.rule.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        enabled: true,
        priority: true,
        stopProcessing: true,
        automationId: true,
        inboundAddress: {
          select: { localPart: true, domain: true },
        },
        _count: { select: { conditions: true, actions: true } },
      },
    }),
  ]);

  return (
    <DashboardShell
      currentTab="automate"
      title="Automate"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Automate</CardTitle>
              <CardDescription>Chargement…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <AutomateWorkspace filters={filters} rulesForSummary={rules} />
      </Suspense>
    </DashboardShell>
  );
}
