import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Listing, User } from "@/server/models";
import { Site } from "@/server/models/cms";
import { ListingPin, isPinActive, pinScopeOf } from "@/server/ranking/pins";
import { DEFAULT_RANK_SETTINGS, normaliseRankSettings, type RankSettings } from "@/server/ranking/settings";
import { loadRankSettings } from "@/server/ranking/store";
import { queryListings } from "@/server/search";

const audit = new AuditRepository();
const SCOPE = /^(home|hub:[a-z0-9-]{1,80}(\/[a-z0-9-]{1,80}){0,2})$/;
const MAX_POSITION = 50;
const MAX_PINS_PER_SCOPE = 50;
const PREVIEW_SIZE = 20;

export interface Actor {
  roles: string[];
  email: string;
}

export interface PinInput {
  scope: string;
  ref: string;
  position: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

function assertAdmin(actor: Actor) {
  if (!actor.roles.some((role) => role === "admin" || role === "superadmin")) {
    throw new ForbiddenError("Only an admin can change the listing order");
  }
}

async function actorId(actor: Actor) {
  const user = actor.email ? await User.findOne({ email: actor.email }).select("_id") : null;
  return user?._id?.toString() ?? null;
}

async function record(actor: Actor, action: string, targetType: string, targetId: string, before: unknown, after: unknown) {
  await audit.append({
    actorId: await actorId(actor),
    actorType: "admin",
    action,
    targetType,
    targetId,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    requestId: crypto.randomUUID(),
  });
  await refreshPublicCache();
}

function parseDate(value: string | null | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${label} is not a valid date`);
  return date;
}

/** Finds an ad from a 24-character ID, an ad URL, or a slug. */
async function findAd(ref: string) {
  const text = ref.trim();
  if (!text) throw new ValidationError("Enter an ad ID or an ad URL");
  if (/^[a-f0-9]{24}$/i.test(text)) {
    const byId = await Listing.findById(text).select("title slug status feedHidden").lean();
    if (byId) return byId;
  }
  let path = text;
  try {
    path = new URL(text, "https://placeholder.invalid").pathname;
  } catch {
    path = text;
  }
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  if (!/^[a-z0-9-]{1,200}$/i.test(slug)) throw new ValidationError("That is not an ad ID or an ad URL");
  const bySlug = await Listing.findOne({ slug: slug.toLowerCase() }).select("title slug status feedHidden").lean();
  if (!bySlug) throw new NotFoundError("No ad found for that ID or URL");
  return bySlug;
}

export async function saveRankSettings(actor: Actor, input: unknown) {
  assertAdmin(actor);
  await connectDb();
  const before = await loadRankSettings();
  const next = normaliseRankSettings(input);
  const site = await Site.findOneAndUpdate(
    { key: "default" },
    { $set: { ranking: next } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  await record(actor, "listing-order.settings.update", "site", String(site._id), before, next);
  return next;
}

export async function addPin(actor: Actor, input: PinInput) {
  assertAdmin(actor);
  await connectDb();
  if (!SCOPE.test(input.scope)) throw new ValidationError("Choose a page for the pin");
  const position = Math.floor(Number(input.position));
  if (!Number.isFinite(position) || position < 1 || position > MAX_POSITION) {
    throw new ValidationError(`Position must be between 1 and ${MAX_POSITION}`);
  }
  const startsAt = parseDate(input.startsAt, "Start date");
  const endsAt = parseDate(input.endsAt, "End date");
  if (startsAt && endsAt && endsAt <= startsAt) throw new ValidationError("The end date must be after the start date");
  const ad = await findAd(input.ref);
  if (ad.status !== "active") throw new ValidationError("Only live ads can be pinned");
  const listingId = String(ad._id);
  if ((await ListingPin.countDocuments({ scope: input.scope })) >= MAX_PINS_PER_SCOPE) {
    throw new ValidationError("This page already has the maximum number of pins");
  }
  if (await ListingPin.exists({ scope: input.scope, listingId })) {
    throw new ValidationError("That ad is already pinned on this page");
  }
  const pin = await ListingPin.create({
    scope: input.scope,
    listingId,
    position,
    startsAt,
    endsAt,
    createdBy: (await actorId(actor)) ?? actor.email,
  });
  await record(actor, "listing-order.pin.add", "listing", listingId, null, {
    scope: input.scope,
    position,
    startsAt,
    endsAt,
  });
  return String(pin._id);
}

export async function removePin(actor: Actor, pinId: string) {
  assertAdmin(actor);
  await connectDb();
  if (!Types.ObjectId.isValid(pinId)) throw new ValidationError("Unknown pin");
  const pin = await ListingPin.findByIdAndDelete(pinId).lean();
  if (!pin) throw new NotFoundError("That pin is already gone");
  const before = { scope: pin.scope, position: pin.position, startsAt: pin.startsAt, endsAt: pin.endsAt };
  await record(actor, "listing-order.pin.remove", "listing", pin.listingId, before, null);
}

export async function setFeedHidden(actor: Actor, ref: string, hidden: boolean) {
  assertAdmin(actor);
  await connectDb();
  const ad = await findAd(ref);
  const before = { feedHidden: ad.feedHidden === true };
  await Listing.updateOne({ _id: ad._id }, { $set: { feedHidden: hidden } });
  await record(actor, hidden ? "listing-order.hide" : "listing-order.unhide", "listing", String(ad._id), before, { feedHidden: hidden });
  return { id: String(ad._id), title: ad.title, slug: ad.slug ?? "" };
}

/** Everything the admin screen shows. */
export async function loadListingOrder(actor: Actor) {
  assertAdmin(actor);
  await connectDb();
  const now = new Date();
  const [settings, pins, hidden] = await Promise.all([
    loadRankSettings(),
    ListingPin.find().sort({ scope: 1, position: 1 }).lean(),
    Listing.find({ feedHidden: true }).select("title slug").limit(200).lean(),
  ]);
  const ids = pins.map((pin) => pin.listingId).filter((id) => Types.ObjectId.isValid(id));
  const ads = await Listing.find({ _id: { $in: ids } }).select("title slug").lean();
  const byId = new Map(ads.map((ad) => [String(ad._id), ad]));
  return {
    settings,
    pins: pins.map((pin) => ({
      id: String(pin._id),
      scope: pin.scope,
      listingId: pin.listingId,
      title: byId.get(pin.listingId)?.title ?? "(ad not found)",
      slug: byId.get(pin.listingId)?.slug ?? "",
      position: pin.position,
      startsAt: pin.startsAt ? pin.startsAt.toISOString() : null,
      endsAt: pin.endsAt ? pin.endsAt.toISOString() : null,
      active: isPinActive(pin, now),
    })),
    hidden: hidden.map((ad) => ({ id: String(ad._id), title: ad.title, slug: ad.slug ?? "" })),
  };
}

/** First 20 ads of a page in the order they would have with `draft` settings (nothing is saved). */
export async function previewOrder(actor: Actor, scope: string, draft: Partial<RankSettings> | undefined) {
  assertAdmin(actor);
  await connectDb();
  const [category, city, district] = SCOPE.test(scope) && scope !== "home" ? scope.slice(4).split("/") : [];
  if (!SCOPE.test(scope) || pinScopeOf({ categorySlug: category, citySlug: city, districtSlug: district }) !== scope) {
    throw new ValidationError("Choose a page to preview");
  }
  const now = new Date();
  const [result, pins] = await Promise.all([
    queryListings({
      categorySlug: category,
      citySlug: city,
      districtSlug: district,
      sort: "ranked",
      excludeStar: true,
      page: 1,
      pageSize: PREVIEW_SIZE,
      rank: normaliseRankSettings(draft ?? DEFAULT_RANK_SETTINGS),
    }),
    ListingPin.find({ scope }).lean(),
  ]);
  const pinned = new Set(pins.filter((pin) => isPinActive(pin, now)).map((pin) => pin.listingId));
  return result.hits.map((hit, index) => ({
    position: index + 1,
    id: hit.id ?? "",
    title: hit.title,
    slug: hit.slug ?? "",
    tier: hit.variant,
    verified: hit.verified,
    pinned: pinned.has(hit.id ?? ""),
  }));
}
