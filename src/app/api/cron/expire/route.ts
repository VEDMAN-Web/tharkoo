import { handle, parseInput, requestIdFrom, success, UnauthorizedError } from "@/server/http";
import { renewDuePromotions } from "@/server/billing/service";
import { expireDue } from "@/server/listings/service";
import { sendSavedSearchDigests } from "@/server/listings/alerts";
import { safeEqual } from "@/server/shared/crypto";
import { cronBodySchema } from "@/server/shared/schemas/common";
import { repairCategoryKinds } from "@/server/categories/kind";
import { expireDueTours } from "@/server/tours/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const expected = process.env.CRON_SECRET ?? "";
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!expected || !safeEqual(given, expected)) throw new UnauthorizedError("Unauthorized");
  parseInput(cronBodySchema, await readBody(request));
  const data = await expireDue(requestId);
  const renewed = await renewDuePromotions(requestId);
  const alerts = await sendSavedSearchDigests(requestId);
  const tours = await expireDueTours(requestId);
  // Keeps the people rule on every database, even one that was never reseeded (H6.5, relay #40).
  const kinds = await repairCategoryKinds();
  return Response.json(
    success({ ...data, ...renewed, ...alerts, ...tours, kindsUpdated: kinds.updated, categoriesWithoutKind: kinds.withoutKind.length }, requestId),
    { status: 200, headers: { "x-request-id": requestId } },
  );
}

export const POST = handle(dispatch);
