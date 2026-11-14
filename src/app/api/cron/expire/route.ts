import { handle, parseInput, requestIdFrom, success, UnauthorizedError } from "@/server/http";
import { renewDuePromotions } from "@/server/billing/service";
import { expireDue } from "@/server/listings/service";
import { sendSavedSearchDigests } from "@/server/listings/alerts";
import { safeEqual } from "@/server/shared/crypto";
import { cronBodySchema } from "@/server/shared/schemas/common";
import { repairCategoryKinds } from "@/server/categories/kind";
import { expireDueTours } from "@/server/tours/service";
import { repairDashes, repairDemoListingDashes } from "@/server/content/dash-repair";
import { convertHeroLayouts } from "@/server/layout/hero-migration";

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
  // Keeps stored text free of em and en dashes, on every run (H5.9b, relay #43). Both repairs are idempotent.
  const dashes = await repairDashes(requestId);
  const demoDashes = await repairDemoListingDashes(requestId);
  // The home hero becomes a full banner by default (H6.13, relay #56). Converts the stored blocks once; a later run changes nothing.
  const heroLayouts = await convertHeroLayouts(requestId);
  return Response.json(
    success(
      {
        ...data,
        ...renewed,
        ...alerts,
        ...tours,
        kindsUpdated: kinds.updated,
        categoriesWithoutKind: kinds.withoutKind.length,
        dashesUpdated: dashes.updated,
        demoListingDashesUpdated: demoDashes.updated,
        heroLayoutsConverted: heroLayouts.updated,
      },
      requestId,
    ),
    { status: 200, headers: { "x-request-id": requestId } },
  );
}

export const POST = handle(dispatch);
