import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.user.updateMany({
      where: { sessionToken: token },
      data: { sessionToken: null },
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
