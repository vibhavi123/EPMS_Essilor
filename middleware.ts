// for JWT auth and role-based access control on both pages and API routes
import { NextRequest, NextResponse } from "next/server";
import { getAuthCookieName, getRoleLandingPath, verifyAuthToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/pages/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"];
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/images", "/logo"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAuthCookieName())?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/pages/login", request.url));
  }

  const session = await verifyAuthToken(token);

  if (!session) {
    const response = NextResponse.redirect(new URL("/pages/login", request.url));
    response.cookies.set({
      name: getAuthCookieName(),
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (pathname === "/pages/login") {
    return NextResponse.redirect(new URL(getRoleLandingPath(session.role), request.url));
  }

  if (pathname.startsWith("/Admin") && !(session.role === "admin" || session.role === "superAdmin")) {
    return NextResponse.redirect(new URL(getRoleLandingPath(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};