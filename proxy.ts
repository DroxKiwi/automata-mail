import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

function isAssetPath(pathname: string) {
  if (pathname === "/favicon.ico") {
    return true;
  }
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/)) {
    return true;
  }
  return false;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  const userCount = await prisma.user.count();
  const bootstrapped = userCount > 0;

  if (pathname.startsWith("/setup")) {
    if (bootstrapped) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (!bootstrapped) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = await prisma.user.findUnique({
    where: { sessionToken: token },
    select: { id: true },
  });

  if (!user) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
