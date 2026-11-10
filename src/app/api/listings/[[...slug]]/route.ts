import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser, userFromToken } from "@/server/auth/service";
import { NotFoundError, failure, handle, parseInput, requestIdFrom, success } from "@/server/http";
import {
  FreeLimitError,
  RevealLimitError,
  createDraft,
  duplicateListing,
  listOwn,
  listVersions,
  patchListing,
  pauseListing,
  readOwned,
  readPublic,
  removeListing,
  renewListing,
  resumeListing,
  revealContact,
  submitListing,
} from "@/server/listings/service";
import {
  contactRevealBodySchema,
  listingCreateBodySchema,
  listingPatchBodySchema,
  listingQuerySchema,
  listingSubmitBodySchema,
} from "@/server/shared/schemas/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function segmentsOf(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const prefix = "/api/listings";
  if (path === prefix) return [];
  if (!path.startsWith(`${prefix}/`)) return [];
  return path.slice(prefix.length + 1).split("/").filter(Boolean);
}

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function json(data: unknown, requestId: string, status = 200, meta: Record<string, unknown> = {}, extra: Record<string, string> = {}) {
  const headers = new Headers({ "x-request-id": requestId, ...extra });
  return Response.json(success(data, requestId, meta), { status, headers });
}

function limitResponse(requestId: string, status: number, code: string, message: string, retryAfter: number) {
  return Response.json(
    { ok: false, data: null, meta: { requestId }, error: { code, message } },
    {
      status,
      headers: { "retry-after": String(retryAfter), "x-request-id": requestId, "cache-control": "no-store" },
    },
  );
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    return await route(request, requestId);
  } catch (error) {
    if (error instanceof FreeLimitError) {
      return limitResponse(requestId, 429, "FREE_LIMIT", "Weekly free ad limit reached", error.retryAfter);
    }
    if (error instanceof RevealLimitError) {
      return Response.json(failure({ code: "RATE_LIMITED", message: "Too many requests" }, requestId), {
        status: 429,
        headers: { "retry-after": String(error.retryAfter), "x-request-id": requestId, "cache-control": "no-store" },
      });
    }
    throw error;
  }
}

async function route(request: Request, requestId: string) {
  assertOrigin(request);
  const segments = segmentsOf(request);
  const token = readCookie(request, SESSION_COOKIE);
  const method = request.method;

  if (method === "GET" && segments.length === 0) {
    const user = await requireUser(token);
    const query = parseInput(listingQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    const data = await listOwn(user.user.id, query);
    return json(data, requestId, 200, { page: query.page, pageSize: query.pageSize, total: data.total });
  }
  if (method === "POST" && segments.length === 0) {
    const user = await requireUser(token);
    const body = parseInput(listingCreateBodySchema, await readBody(request));
    return json(await createDraft(user.user.id, body, requestId), requestId, 201);
  }
  if (method === "GET" && segments[0] === "by-id" && segments[1] && segments.length === 2) {
    const user = await requireUser(token);
    return json(await readOwned(segments[1], user.user.id, user.user.roles), requestId);
  }
  if (method === "GET" && segments.length === 1 && segments[0] !== "by-id") {
    const viewer = await userFromToken(token);
    return json(await readPublic(segments[0], viewer?.user.id), requestId);
  }
  if (method === "PATCH" && segments.length === 1) {
    const user = await requireUser(token);
    const body = parseInput(listingPatchBodySchema, await readBody(request));
    return json(await patchListing(segments[0], user.user.id, body, requestId), requestId);
  }
  if (method === "DELETE" && segments.length === 1) {
    const user = await requireUser(token);
    return json(await removeListing(segments[0], user.user.id, requestId), requestId);
  }
  if (method === "POST" && segments.length === 2) {
    const [id, action] = segments;
    if (!id || !action) throw new NotFoundError("Not found");
    if (action === "contact" || action === "contact-reveal") {
      const viewer = await userFromToken(token);
      const body = parseInput(contactRevealBodySchema, await readBody(request));
      const data = await revealContact(id, viewer?.user.id, body.channel, requestId, clientKey(request.headers));
      return json(data, requestId, 200, {}, { "cache-control": "no-store" });
    }
    const user = await requireUser(token);
    if (action === "submit") {
      const body = parseInput(listingSubmitBodySchema, await readBody(request));
      return json(await submitListing(id, user.user.id, body.attestations, requestId), requestId);
    }
    if (action === "renew") return json(await renewListing(id, user.user.id, requestId), requestId);
    if (action === "pause") return json(await pauseListing(id, user.user.id, requestId), requestId);
    if (action === "resume") return json(await resumeListing(id, user.user.id, requestId), requestId);
    if (action === "duplicate") return json(await duplicateListing(id, user.user.id, requestId), requestId, 201);
    if (action === "versions" && method === "POST") throw new NotFoundError("Not found");
  }
  if (method === "GET" && segments.length === 2 && segments[1] === "versions" && segments[0]) {
    const user = await requireUser(token);
    return json(await listVersions(segments[0], user.user.id, user.user.roles), requestId);
  }
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const PATCH = handle(dispatch);
export const DELETE = handle(dispatch);
