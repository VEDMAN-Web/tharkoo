import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { originAllowed } from "@/server/auth/http";
import { consumeRateLimit } from "@/server/auth/rate-limit";

const STATIC_EXT = /\.(?:svg|png|jpg|jpeg|webp|avif|ico|woff2|css|js|map|txt|xml)$/i;

function skipLimiter(req: NextRequest) {
  if (req.nextUrl.searchParams.has("_rsc")) return true;
  if (req.headers.get("next-router-prefetch")) return true;
  if (STATIC_EXT.test(req.nextUrl.pathname)) return true;
  return false;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const cronPost = req.method === "POST" && path.startsWith("/api/cron/");
  if (!cronPost && !originAllowed(req)) {
    return NextResponse.json(
      { ok: false, data: null, error: { code: "FORBIDDEN", message: "Origin is not allowed" } },
      { status: 403 },
    );
  }
  if (skipLimiter(req)) return NextResponse.next();
  const ip = clientKey(req.headers);
  const search = path.startsWith("/search") || path.startsWith("/api/catalog");
  const key = `${ip}:${search ? "search" : "site"}`;
  const max = search ? 30 : 240;
  let ok = true;
  if (process.env.MONGODB_URI) {
    try {
      ok = (await consumeRateLimit(key, max, 60_000)).ok;
    } catch {
      ok = allowRequest(key, max, 60_000);
    }
  } else {
    ok = allowRequest(key, max, 60_000);
  }
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|placeholders|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|woff2|css|js|map|txt|xml)$).*)"],
};
