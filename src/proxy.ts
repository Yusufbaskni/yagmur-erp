import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith("/giris")) {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL("/giris", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp)$).*)"],
};
