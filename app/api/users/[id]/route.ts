import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApiUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";

const MIN_PASSWORD_LEN = 8;

type RouteContext = { params: Promise<{ id: string }> };

async function assertCanRemoveAdminRole(targetId: number) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { isAdmin: true },
  });
  if (!target?.isAdmin) {
    return null;
  }
  const adminCount = await prisma.user.count({ where: { isAdmin: true } });
  if (adminCount <= 1) {
    return NextResponse.json(
      { error: "Impossible de retirer le dernier administrateur." },
      { status: 400 }
    );
  }
  return null;
}

async function assertCanDeleteAdmin(targetId: number) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { isAdmin: true },
  });
  if (!target?.isAdmin) {
    return null;
  }
  const adminCount = await prisma.user.count({ where: { isAdmin: true } });
  if (adminCount <= 1) {
    return NextResponse.json(
      { error: "Impossible de supprimer le dernier administrateur." },
      { status: 400 }
    );
  }
  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAdminApiUser();
  if (!gate.ok) {
    return gate.response;
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
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
  const data: Prisma.UserUpdateInput = {};

  if ("email" in b) {
    const email = typeof b.email === "string" ? b.email.trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }
    data.email = email;
  }

  if ("username" in b) {
    const username = typeof b.username === "string" ? b.username.trim() : "";
    if (!username || username.length < 2) {
      return NextResponse.json(
        { error: "Le nom d'utilisateur doit contenir au moins 2 caracteres." },
        { status: 400 }
      );
    }
    data.username = username;
  }

  if ("name" in b) {
    const nameRaw = b.name;
    if (nameRaw === null || nameRaw === undefined) {
      data.name = null;
    } else if (typeof nameRaw === "string") {
      data.name = nameRaw.trim() || null;
    } else {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
  }

  if ("password" in b) {
    const password = typeof b.password === "string" ? b.password : "";
    if (password.length > 0) {
      if (password.length < MIN_PASSWORD_LEN) {
        return NextResponse.json(
          {
            error: `Mot de passe trop court (minimum ${MIN_PASSWORD_LEN} caracteres).`,
          },
          { status: 400 }
        );
      }
      data.passwordHash = await hash(password, 12);
    }
  }

  if ("isAdmin" in b) {
    const nextAdmin = Boolean(b.isAdmin);
    if (!nextAdmin && existing.isAdmin) {
      const block = await assertCanRemoveAdminRole(id);
      if (block) {
        return block;
      }
    }
    data.isAdmin = nextAdmin;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ a mettre a jour." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Cet e-mail ou ce nom d'utilisateur est deja utilise." },
        { status: 409 }
      );
    }
    console.error("[users PATCH]", err);
    return NextResponse.json(
      { error: "Impossible de mettre a jour l'utilisateur." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireAdminApiUser();
  if (!gate.ok) {
    return gate.response;
  }
  const admin = gate.user;

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  if (id === admin.id) {
    return NextResponse.json(
      { error: "Tu ne peux pas supprimer ton propre compte." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  const block = await assertCanDeleteAdmin(id);
  if (block) {
    return block;
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[users DELETE]", err);
    return NextResponse.json(
      { error: "Impossible de supprimer l'utilisateur." },
      { status: 500 }
    );
  }
}
