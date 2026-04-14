import { hash } from "bcryptjs";
import { randomUUID, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const MIN_PASSWORD_LEN = 8;

function compareSetupTokens(provided: string, expected: string): boolean {
  const a = Buffer.from(provided.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expectedToken = process.env.FIRST_SETUP_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json(
      { error: "FIRST_SETUP_TOKEN n'est pas configure sur le serveur." },
      { status: 503 }
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
  const setupToken =
    typeof b.setupToken === "string" ? b.setupToken.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!compareSetupTokens(setupToken, expectedToken)) {
    return NextResponse.json(
      { error: "Token de configuration incorrect." },
      { status: 401 }
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  if (!username || username.length < 2) {
    return NextResponse.json(
      { error: "Le nom d'utilisateur doit contenir au moins 2 caracteres." },
      { status: 400 }
    );
  }

  if (password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      {
        error: `Mot de passe trop court (minimum ${MIN_PASSWORD_LEN} caracteres).`,
      },
      { status: 400 }
    );
  }

  const sessionToken = randomUUID();
  const passwordHash = await hash(password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const n = await tx.user.count();
      if (n > 0) {
        throw new Error("SETUP_ALREADY_DONE");
      }
      await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          sessionToken,
          isAdmin: true,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SETUP_ALREADY_DONE") {
      return NextResponse.json(
        { error: "La configuration initiale a deja ete effectuee." },
        { status: 403 }
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Cet e-mail ou ce nom d'utilisateur est deja utilise." },
        { status: 409 }
      );
    }
    console.error("[setup]", err);
    return NextResponse.json(
      { error: "Impossible de creer le compte administrateur." },
      { status: 500 }
    );
  }

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
