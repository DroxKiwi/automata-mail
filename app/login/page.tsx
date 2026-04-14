import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte",
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/boite");
  }
  return <LoginForm />;
}
