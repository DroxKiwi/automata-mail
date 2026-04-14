import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuration initiale",
  description: "Premier compte administrateur",
};

export default async function SetupPage() {
  const count = await prisma.user.count();
  if (count > 0) {
    redirect("/login");
  }

  return <SetupForm />;
}
