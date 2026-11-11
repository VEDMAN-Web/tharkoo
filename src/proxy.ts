import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientKey, limitBucket, type LimitBucket } from "@/lib/rate-limit";
import { originAllowed } from "@/server/auth/http";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { countRedirectHit, decideRequest } from "@/server/urls/service";

const STATIC_EXT = /\.(?:svg|png|jpg|jpeg|webp|avif|ico|woff2|css|js|map|txt|xml)$/i;

function requestLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= fallback ? value : fallback;
}

function tooManyRequests(bucket: LimitBucket) {
  const retry = { "Retry-After": "60" };
  if (bucket === "page" || bucket === "bot") {
    return new NextResponse("Too many requests", { status: 429, headers: { ...retry, "content-type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: retry });
}

function skipLimiter(req: NextRequest) {
  if (req.nextUrl.searchParams.has("_rsc")) return true;
  if (req.headers.get("next-router-prefetch")) return true;
  if (STATIC_EXT.test(req.nextUrl.pathname)) return true;
  return false;
}

function nextWithPath(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

async function adIsGone(pathname: string) {
  const { getPaths } = await import("@/server/urls/service");
  const { Listing } = await import("@/server/models");
  const { listingVisibility } = await import("@/server/listings/visibility");
  const paths = await getPaths();
  const prefix = `/${paths.ad.replace(/^\/|\/$/g, "")}/`;
  if (!pathname.startsWith(prefix)) return false;
  const slug = pathname.slice(prefix.length).replace(/\/$/, "");
  if (!slug || slug.includes("/")) return false;
  const doc = await Listing.findOne({ slug }).select("status expiresAt").lean<{ status?: string; expiresAt?: Date | null }>();
  return listingVisibility(doc) === "gone";
}

function skipRedirect(path: string) {
  return (
    path.startsWith("/api/") ||
    path.startsWith("/admin") ||
    path.startsWith("/_next") ||
    path.startsWith("/uploads/") ||
    path.startsWith("/sitemap") ||
    path.startsWith("/robots") ||
    path.startsWith("/manifest") ||
    path.startsWith("/brand/") ||
    path.startsWith("/placeholders/") ||
    path.includes(".")
  );
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  let rewriteTo = "";
  if ((req.method === "GET" || req.method === "HEAD") && !skipRedirect(path)) {
    try {
      const decision = await decideRequest(path);
      if (decision.action === "redirect") {
        await countRedirectHit(decision.id);
        const url = req.nextUrl.clone();
        url.pathname = decision.to;
        return NextResponse.redirect(url, 308);
      }
      if (decision.action === "rewrite") rewriteTo = decision.to;
    } catch {
      /* a missing database should not block the page */
    }
    if (process.env.MONGODB_URI) {
      try {
        if (await adIsGone(rewriteTo || path)) {
          return new NextResponse("This listing has been removed.", { status: 410, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      } catch {
        /* a lookup failure should fall through to the page */
      }
    }
  }
  const cronPost = req.method === "POST" && path.startsWith("/api/cron/");
  if (!cronPost && !originAllowed(req)) {
    return NextResponse.json(
      { ok: false, data: null, error: { code: "FORBIDDEN", message: "Origin is not allowed" } },
      { status: 403 },
    );
  }
  if (skipLimiter(req)) return nextWithPath(req);
  const ip = clientKey(req.headers);
  const routePath = rewriteTo.startsWith("/search") ? rewriteTo : path;
  const limit = limitBucket(routePath, req.method, req.headers.get("user-agent") || "");
  const key = `${ip}:${limit.bucket}`;
  const max = requestLimit(limit.envName, limit.fallback);
  // Only api and search are counted in Mongo. Page and bot views stay in memory: no database write per page view.
  const durable = limit.bucket === "api" || limit.bucket === "search";
  let ok = true;
  if (durable && process.env.MONGODB_URI) {
    try {
      ok = (await consumeRateLimit(key, max, 60_000)).ok;
    } catch {
      ok = allowRequest(key, max, 60_000);
    }
  } else {
    ok = allowRequest(key, max, 60_000);
  }
  if (!ok) return tooManyRequests(limit.bucket);
  if (rewriteTo) {
    const headers = new Headers(req.headers);
    headers.set("x-pathname", rewriteTo);
    const url = req.nextUrl.clone();
    url.pathname = rewriteTo;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return nextWithPath(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|placeholders|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|woff2|css|js|map|txt|xml)$).*)"],
};
