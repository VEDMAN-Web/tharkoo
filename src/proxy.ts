import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientKey } from "@/lib/rate-limit";

export function proxy(req: NextRequest) {
  const ip = clientKey(req.headers);
  const path = req.nextUrl.pathname;
  const search = path.startsWith("/search") || path.startsWith("/api/catalog");
  const ok = allowRequest(`${ip}:${search ? "search" : "site"}`, search ? 30 : 90, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|placeholders).*)"],
};
