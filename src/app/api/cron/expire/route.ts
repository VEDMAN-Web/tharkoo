import { handle, parseInput, requestIdFrom, success } from "@/server/http";
import { renewDuePromotions } from "@/server/billing/service";
import { expireDue } from "@/server/listings/service";
import { sendSavedSearchDigests } from "@/server/listings/alerts";
import { assertCronAuth } from "@/server/shared/cron-auth";
import { cronBodySchema } from "@/server/shared/schemas/common";
import { repairCategoryKinds } from "@/server/categories/kind";
import { expireDueTours } from "@/server/tours/service";
import { repairDashes, repairDemoListingDashes } from "@/server/content/dash-repair";
import { convertHeroLayouts } from "@/server/layout/hero-migration";
import { ensureIdCheckSetting } from "@/server/settings/id-check";
import { ensureNewDesignSetting } from "@/server/site-links/new-design";
import { watermarkExistingAdMedia } from "@/server/media/watermark-migration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertCronAuth(request);
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
  // "Require ID check before posting" is stored OFF when it was never set (H6.14). Idempotent, like the hero conversion.
  const idCheck = await ensureIdCheckSetting(requestId);
  // H7.1: the "New design" switch is stored once (on only where SITE_NOINDEX is true). Idempotent, a saved value is never changed.
  const newDesign = await ensureNewDesignSetting(requestId);
  // H6.18: ad photos and videos uploaded before the watermark get it, a few per run. A file already marked is skipped.
  const watermark = await watermarkExistingAdMedia(requestId);
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
        idCheckSettingSet: idCheck.updated,
        newDesignSettingSet: newDesign.updated,
        adMediaWatermarked: watermark.processed,
        adMediaWatermarkFailed: watermark.failed,
      },
      requestId,
    ),
    { status: 200, headers: { "x-request-id": requestId } },
  );
}

export const POST = handle(dispatch);
/** Vercel Cron calls with GET and `Authorization: Bearer <CRON_SECRET>`. */
export const GET = handle(dispatch);
