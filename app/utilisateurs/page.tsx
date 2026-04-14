import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { UsersAdminPanel } from "./users-admin-panel";

export const dynamic = "force-dynamic";

export default async function UtilisateursPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    redirect("/");
  }

  const rows = await prisma.user.findMany({
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  const initialUsers = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <DashboardShell
      currentTab="utilisateurs"
      title="Utilisateurs"
      userEmail={user.email}
      isAdmin
    >
      <UsersAdminPanel initialUsers={initialUsers} currentUserId={user.id} />
    </DashboardShell>
  );
}
