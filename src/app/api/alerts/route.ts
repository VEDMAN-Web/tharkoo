import { z } from "zod";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { saveSearchAlert } from "@/server/listings/alerts";
import { handle, parseInput, requestIdFrom, success } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email().max(200),
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
});

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const body = parseInput(bodySchema, await request.json().catch(() => ({})));
  const session = await userFromToken(readCookie(request, SESSION_COOKIE)).catch(() => null);
  const saved = await saveSearchAlert({
    email: session?.user.email || body.email,
    q: body.q,
    categorySlug: body.category,
    citySlug: body.city,
    userId: session?.user.id,
  });
  return Response.json(success(saved, requestId));
}

export const POST = handle(dispatch);
