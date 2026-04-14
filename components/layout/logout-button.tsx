"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 w-full border-sidebar-border text-xs"
      disabled={pending}
      onClick={() => void logout()}
    >
      {pending ? "Déconnexion…" : "Déconnexion"}
    </Button>
  );
}
