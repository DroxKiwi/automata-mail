import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchOllamaModelNames } from "@/lib/ollama/ollama-remote";

/**
 * Liste les modèles disponibles sur le serveur Ollama (GET /api/tags), selon la config en base.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "Reserve aux administrateurs." },
      { status: 403 },
    );
  }

  try {
    const models = await fetchOllamaModelNames();
    return NextResponse.json({ models });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "OLLAMA_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Configure d'abord l'URL Ollama (Réglages) puis enregistre." },
        { status: 400 },
      );
    }
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json(
        { error: "Delai depasse : le serveur Ollama ne repond pas." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: `Impossible de lister les modeles : ${msg}` },
      { status: 502 },
    );
  }
}
