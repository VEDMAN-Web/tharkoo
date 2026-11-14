import { clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { json, readJson, segmentsOf } from "@/server/billing/http";
import { ForbiddenError, NotFoundError, handle, parseInput, requestIdFrom } from "@/server/http";
import { idSchema } from "@/server/shared/schemas/common";
import {
  acceptTour,
  declineTour,
  disputeTour,
  listTours,
  listVideoTourCategories,
  requestTour,
  reverseTour,
  updateVideoTourSettings,
} from "@/server/tours/service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ listingId: idSchema });
const disputeSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const settingsSchema = z.object({
  categoryId: idSchema,
  kind: z.enum(["goods", "property", "vehicle", "job", "service", "people"]).optional(),
  enabled: z.boolean().optional(),
  coins: z.number().int().min(1).max(100).optional(),
});

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const path = segmentsOf(request, "/api/tours").join("/");
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  const userId = user.user.id;
  const roles = user.user.roles;
  if (request.method === "GET" && path === "") return json(await listTours(userId), requestId);
  if (request.method === "POST" && path === "request") {
    const body = parseInput(requestSchema, await readJson(request));
    return json(await requestTour({ userId, listingId: body.listingId, requestId, ip: clientKey(request.headers) }), requestId);
  }
  if (path === "admin/categories" && request.method === "GET") {
    if (!roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin changes video tour settings");
    return json(await listVideoTourCategories(), requestId);
  }
  if (path === "admin/settings" && request.method === "PUT") {
    const body = parseInput(settingsSchema, await readJson(request));
    return json(await updateVideoTourSettings({ actorId: userId, roles, ...body, requestId }), requestId);
  }
  const action = /^([^/]+)\/(accept|decline|dispute|reverse)$/.exec(path);
  if (action && request.method === "POST") {
    const [, tourId, verb] = action;
    if (verb === "accept") return json(await acceptTour({ ownerId: userId, tourId, requestId }), requestId);
    if (verb === "decline") return json(await declineTour({ ownerId: userId, tourId, requestId }), requestId);
    if (verb === "dispute") {
      const body = parseInput(disputeSchema, await readJson(request));
      return json(await disputeTour({ userId, tourId, reason: body.reason, requestId }), requestId);
    }
    return json(await reverseTour({ actorId: userId, roles, tourId, requestId }), requestId);
  }
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const PUT = handle(dispatch);
