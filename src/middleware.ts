import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientKey } from "@/lib/rate-limit";

export function middleware(req: NextRequest) {
  const ip = clientKey(req.headers);
  const search = req.nextUrl.pathname.startsWith("/search");
  const ok = allowRequest(ip, search ? 30 : 90, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|admin|u|placeholders|cursor).*)"],
};
