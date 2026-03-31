import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/auth/google/callback", "/menu"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("session_token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Pass token to server components via header
  const response = NextResponse.next();
  response.headers.set("x-session-token", sessionToken);
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icons).*)",
  ],
};
