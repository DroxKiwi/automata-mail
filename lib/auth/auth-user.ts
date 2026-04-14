import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return prisma.user.findUnique({
    where: { sessionToken: token },
    select: {
      id: true,
      username: true,
      email: true,
      isAdmin: true,
    },
  });
}
