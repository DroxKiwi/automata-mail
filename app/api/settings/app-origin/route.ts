import { NextResponse } from "next/server";
import { resolvePublicAppOrigin } from "@/lib/config/resolve-public-app-origin";

/** Origine publique pour les écrans client (OAuth, placeholders). */
export async function GET() {
  const origin = await resolvePublicAppOrigin();
  return NextResponse.json({ origin });
}
