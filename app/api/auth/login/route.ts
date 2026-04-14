import { compare } from "bcryptjs";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    !("password" in body)
  ) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const username =
    typeof (body as { username: unknown }).username === "string"
      ? (body as { username: string }).username.trim()
      : "";
  const password =
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Identifiant et mot de passe requis." },
      { status: 400 }
    );
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers === 0) {
    return NextResponse.json(
      { error: "L'application n'est pas encore configuree. Utilisez /setup." },
      { status: 403 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, passwordHash: true },
  });

  const passwordOk =
    user !== null && (await compare(password, user.passwordHash));

  if (!passwordOk) {
    return NextResponse.json(
      { error: "Identifiant ou mot de passe incorrect." },
      { status: 401 }
    );
  }

  const sessionToken = randomUUID();
  await prisma.user.update({
    where: { id: user.id },
    data: { sessionToken },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
