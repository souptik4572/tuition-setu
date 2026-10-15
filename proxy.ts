import { NextResponse, type NextRequest } from "next/server";

// Only checks that the session cookie exists (§9.2). The real check is requireMember() in every
// page, action and route handler, which reads the database.

const PUBLIC = [/^\/setup$/, /^\/login(\/forgot)?$/, /^\/pair$/, /^\/api\/ai\/health$/];

export function proxy(request: NextRequest) {
  // Hosted sessions are Supabase cookies; M13 adds their check here.
  if (process.env.APP_MODE === "hosted") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (request.cookies.has("ts_session") || PUBLIC.some((path) => path.test(pathname))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
