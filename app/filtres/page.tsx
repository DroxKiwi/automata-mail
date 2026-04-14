import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FiltresWorkspace } from "@/components/filters/filtres-workspace";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export default async function FiltresPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [addresses, filters] = await Promise.all([
    prisma.inboundAddress.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, localPart: true, domain: true },
    }),
    prisma.filter.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
        priority: true,
        inboundAddress: {
          select: { localPart: true, domain: true },
        },
        _count: { select: { conditions: true, automationLinks: true } },
      },
    }),
  ]);

  return (
    <DashboardShell
      currentTab="filtres"
      title="Filtres"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="flex flex-col gap-8">
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Filtres</CardTitle>
                <CardDescription>Chargement…</CardDescription>
              </CardHeader>
            </Card>
          }
        >
          <FiltresWorkspace addresses={addresses} filters={filters} />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
