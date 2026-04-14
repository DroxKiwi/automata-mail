import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const row = await prisma.ollamaSettings.findUnique({
    where: { id: 1 },
  });

  if (!row) {
    const empty = {
      baseUrl: "",
      hasApiKey: false,
      model: "",
    };
    return user.isAdmin
      ? NextResponse.json({
          ...empty,
          assistantThinkingEnabled: false,
          assistantOptionsEnabled: true,
          assistantTemperature: 1,
          assistantTopP: 0.95,
          assistantTopK: 64,
        })
      : NextResponse.json(empty);
  }

  const base = {
    baseUrl: row.baseUrl,
    hasApiKey: Boolean(row.apiKey?.trim()),
    model: row.model ?? "",
  };

  if (!user.isAdmin) {
    return NextResponse.json(base);
  }

  return NextResponse.json({
    ...base,
    assistantThinkingEnabled: row.assistantThinkingEnabled,
    assistantOptionsEnabled: row.assistantOptionsEnabled,
    assistantTemperature: row.assistantTemperature,
    assistantTopP: row.assistantTopP,
    assistantTopK: row.assistantTopK,
  });
}

export async function PUT(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (!("baseUrl" in b) || typeof b.baseUrl !== "string") {
    return NextResponse.json({ error: "Champ baseUrl requis." }, { status: 400 });
  }

  const baseUrl = b.baseUrl.trim();
  if (baseUrl && !isValidHttpUrl(baseUrl)) {
    return NextResponse.json(
      { error: "URL invalide (http ou https attendu)." },
      { status: 400 },
    );
  }

  let nextApiKey: string | null | undefined;
  if ("apiKey" in b) {
    if (b.apiKey === null || b.apiKey === "") {
      nextApiKey = null;
    } else if (typeof b.apiKey === "string") {
      const k = b.apiKey.trim();
      nextApiKey = k.length > 0 ? k : null;
    } else {
      return NextResponse.json({ error: "apiKey invalide." }, { status: 400 });
    }
  }

  let nextModel: string | undefined;
  if ("model" in b) {
    if (typeof b.model !== "string") {
      return NextResponse.json({ error: "model invalide." }, { status: 400 });
    }
    nextModel = b.model.trim();
  }

  let assistantThinkingEnabled: boolean | undefined;
  if ("assistantThinkingEnabled" in b) {
    if (typeof b.assistantThinkingEnabled !== "boolean") {
      return NextResponse.json(
        { error: "assistantThinkingEnabled invalide." },
        { status: 400 },
      );
    }
    assistantThinkingEnabled = b.assistantThinkingEnabled;
  }

  let assistantOptionsEnabled: boolean | undefined;
  if ("assistantOptionsEnabled" in b) {
    if (typeof b.assistantOptionsEnabled !== "boolean") {
      return NextResponse.json(
        { error: "assistantOptionsEnabled invalide." },
        { status: 400 },
      );
    }
    assistantOptionsEnabled = b.assistantOptionsEnabled;
  }

  let assistantTemperature: number | undefined;
  if ("assistantTemperature" in b) {
    const v = b.assistantTemperature;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return NextResponse.json(
        { error: "assistantTemperature invalide." },
        { status: 400 },
      );
    }
    assistantTemperature = clampNumber(v, 0, 2);
  }

  let assistantTopP: number | undefined;
  if ("assistantTopP" in b) {
    const v = b.assistantTopP;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return NextResponse.json(
        { error: "assistantTopP invalide." },
        { status: 400 },
      );
    }
    assistantTopP = clampNumber(v, 0, 1);
  }

  let assistantTopK: number | undefined;
  if ("assistantTopK" in b) {
    const v = b.assistantTopK;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return NextResponse.json(
        { error: "assistantTopK invalide." },
        { status: 400 },
      );
    }
    const k = Math.trunc(v);
    if (k < 1 || k > 100_000) {
      return NextResponse.json(
        { error: "assistantTopK doit etre entre 1 et 100000." },
        { status: 400 },
      );
    }
    assistantTopK = k;
  }

  const updateData: Prisma.OllamaSettingsUpdateInput = { baseUrl };
  if (nextApiKey !== undefined) {
    updateData.apiKey = nextApiKey;
  }
  if (nextModel !== undefined) {
    updateData.model = nextModel;
  }
  if (assistantThinkingEnabled !== undefined) {
    updateData.assistantThinkingEnabled = assistantThinkingEnabled;
  }
  if (assistantOptionsEnabled !== undefined) {
    updateData.assistantOptionsEnabled = assistantOptionsEnabled;
  }
  if (assistantTemperature !== undefined) {
    updateData.assistantTemperature = assistantTemperature;
  }
  if (assistantTopP !== undefined) {
    updateData.assistantTopP = assistantTopP;
  }
  if (assistantTopK !== undefined) {
    updateData.assistantTopK = assistantTopK;
  }

  await prisma.ollamaSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      baseUrl,
      apiKey: nextApiKey === undefined ? null : nextApiKey,
      model: nextModel ?? "",
      assistantThinkingEnabled: assistantThinkingEnabled ?? false,
      assistantOptionsEnabled: assistantOptionsEnabled ?? true,
      assistantTemperature: assistantTemperature ?? 1,
      assistantTopP: assistantTopP ?? 0.95,
      assistantTopK: assistantTopK ?? 64,
    },
    update: updateData,
  });

  return NextResponse.json({ ok: true });
}
