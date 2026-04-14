import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("hiddenFromTransferList" in body)
  ) {
    return NextResponse.json(
      { error: "Champ boolean hiddenFromTransferList requis." },
      { status: 400 },
    );
  }

  const hiddenFromTransferList = Boolean(
    (body as { hiddenFromTransferList: unknown }).hiddenFromTransferList,
  );

  const result = await prisma.inboundMessage.updateMany({
    where: {
      id,
      inboundAddress: { isActive: true },
    },
    data: { hiddenFromTransferList },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, hiddenFromTransferList });
}
