import { z } from "zod";
import { SESSION_COOKIE, readCookie } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { loadDiscoverFeed } from "@/server/discover/feed";
import { handle, parseInput, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slug = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/);

/** Query string for GET /api/discover. Every field is optional. */
const discoverQuerySchema = z.object({
  category: slug.optional(),
  city: slug.optional(),
  withVideo: z.enum(["1", "0"]).optional(),
  seed: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  page: z.coerce.number().int().min(1).max(50).optional(),
});

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const query = parseInput(discoverQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const session = await userFromToken(readCookie(request, SESSION_COOKIE)).catch(() => null);
  const feed = await loadDiscoverFeed({
    filters: {
      categorySlug: query.category,
      citySlug: query.city,
      withVideo: query.withVideo === "1",
    },
    seed: query.seed ?? Math.random().toString(36).slice(2, 10),
    page: query.page ?? 1,
    viewerId: session?.user.id,
  });
  return Response.json(success(feed, requestId));
}

export const GET = handle(dispatch);
