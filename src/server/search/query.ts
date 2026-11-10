import { Types, type QueryFilter } from "mongoose";
import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import type { ListingDoc as LegacyListing } from "@/lib/models";
import { listingPhotos } from "@/lib/media";
import {
  Category,
  Listing,
  MediaAsset,
  PromotionOrder,
  PromotionProduct,
  type CategoryDoc,
  type ListingDoc,
} from "@/server/models";
import { loadLocations, type LocationRow } from "@/server/locations/service";
import { compareRank, rankScore, type RankPromotion } from "@/server/ranking";
import { publicView } from "@/server/listings/service";
import { TOP_CITY_SLUGS } from "@/server/seed/data";

const TIER: Record<string, number> = {
  star: 80,
  "super-top": 70,
  flash: 60,
  top: 50,
  highlight: 40,
  new: 30,
  "auto-boost": 20,
  free: 0,
};

const VARIANT: Record<string, string> = {
  star: "star",
  "super-top": "supertop",
  flash: "flash",
  top: "top",
  highlight: "highlight",
  new: "free",
  "auto-boost": "free",
  free: "free",
};

export interface ListingQuery {
  q?: string;
  categorySlug?: string;
  citySlug?: string;
  stateSlug?: string;
  districtSlug?: string;
  areaSlug?: string;
  placeSlug?: string;
  verified?: boolean;
  badge?: string;
  photos?: boolean;
  attributes?: Record<string, string | number | boolean | string[]>;
  sort?: "ranked" | "fresh";
  page?: number;
  pageSize?: number;
  excludeStar?: boolean;
  starOnly?: boolean;
  excludeSlug?: string;
  slug?: string;
}

interface Row {
  _id: Types.ObjectId;
  ownerId?: Types.ObjectId;
  status: string;
  categoryId: Types.ObjectId;
  stateId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  districtId?: Types.ObjectId;
  localityId?: Types.ObjectId;
  title: string;
  slug?: string;
  description: string;
  attributes?: Record<string, unknown>;
  mediaIds?: Types.ObjectId[];
  coverMediaId?: Types.ObjectId;
  badges?: string[];
  qualityScore?: number;
  publishedAt?: Date;
  expiresAt?: Date;
  seoNoindex?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  bumpedAt?: Date;
}

export interface PublicHit {
  id: string | null;
  slug: string | null;
  title: string;
  description: string;
  status: string;
  categoryId: string | null;
  stateId: string | null;
  cityId: string | null;
  districtId: string | null;
  localityId: string | null;
  attributes: Record<string, unknown>;
  mediaIds: string[];
  coverMediaId: string | null;
  badges: string[];
  qualityScore: number;
  publishedAt: string | null;
  expiresAt: string | null;
  seoNoindex: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  categorySlug: string;
  stateSlug: string;
  citySlug: string;
  districtSlug: string;
  place: string;
  publicId: string;
  photos: string[];
  verified: boolean;
  variant: string;
  lastBumpedAt: string | null;
  displayName: string;
  age?: number;
}

export interface SearchFacets {
  categories: { slug: string; count: number }[];
  cities: { slug: string; count: number }[];
}

export interface SearchResult {
  hits: PublicHit[];
  legacy: LegacyListing[];
  total: number;
  facets: SearchFacets;
}

export function cleanQuery(q: string) {
  return q
    .trim()
    .slice(0, 200)
    .replace(/[^a-zA-Z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYMS: Record<string, string[]> = {
  flat: ["apartment", "rent", "rental", "house"],
  apartment: ["flat", "rent", "rental"],
  rent: ["rental", "flat", "apartment"],
  rental: ["rent", "flat", "apartment"],
  house: ["flat", "apartment"],
  job: ["jobs", "hiring", "vacancy", "vacancies"],
  jobs: ["job", "hiring", "vacancy", "vacancies"],
  hiring: ["job", "jobs", "vacancy", "vacancies"],
  vacancy: ["job", "jobs", "hiring", "vacancies"],
  vacancies: ["job", "jobs", "hiring", "vacancy"],
};

function stemToken(token: string) {
  const out = new Set<string>([token]);
  if (token.length > 3 && token.endsWith("s")) out.add(token.slice(0, -1));
  else if (token.length > 2) out.add(`${token}s`);
  return out;
}

/** One group per query token. Each group is the token plus a light stem and synonyms. */
export function expandSearchTerms(q: string) {
  const cleaned = cleanQuery(q).toLowerCase();
  if (!cleaned) return [] as string[][];
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      const alts = stemToken(token);
      for (const word of [...alts]) {
        for (const extra of SYNONYMS[word] || []) alts.add(extra);
      }
      return [...alts];
    });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function searchTextMatch(
  q: string,
  categories: { _id?: Types.ObjectId; slug: string; name?: string }[],
  locations: { _id?: Types.ObjectId; slug: string; name?: string; type?: string }[],
) {
  const groups = expandSearchTerms(q);
  if (!groups.length) return null;
  const words = new Set(groups.flat());
  const categoryIds = categories
    .filter((row) => words.has(row.slug.toLowerCase()) || words.has((row.name || "").toLowerCase()))
    .map((row) => row._id)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const cityIds = locations
    .filter(
      (row) =>
        row.type === "city" &&
        (words.has(row.slug.toLowerCase()) || words.has((row.name || "").toLowerCase())),
    )
    .map((row) => row._id)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const clauses = groups.map((alts) => {
    const pattern = new RegExp(alts.map(escapeRegExp).join("|"), "i");
    return { $or: [{ title: pattern }, { description: pattern }] };
  });
  const text = clauses.length === 1 ? clauses[0] : { $and: clauses };
  const or: Record<string, unknown>[] = [text];
  if (categoryIds.length) or.push({ categoryId: { $in: categoryIds } });
  if (cityIds.length) or.push({ cityId: { $in: cityIds } });
  return or.length === 1 ? or[0] : { $or: or };
}

export async function loadCategories() {
  return cached(
    "categories:rows",
    30_000,
    async () => {
      await connectDb();
      return Category.find().lean();
    },
    ["categories"],
  );
}

function slugOf(rows: { _id?: Types.ObjectId; slug: string }[], id?: Types.ObjectId | null) {
  if (!id) return "";
  return rows.find((row) => String(row._id) === String(id))?.slug ?? "";
}

function nameOf(rows: LocationRow[], id?: Types.ObjectId | null) {
  if (!id) return "";
  return rows.find((row) => String(row._id) === String(id))?.name ?? "";
}

function matchSlug(row: { slug: string; oldSlugs?: string[] }, slug: string) {
  return row.slug === slug || (row.oldSlugs ?? []).includes(slug);
}

function bestCode(promotions: readonly RankPromotion[], now: Date) {
  const nowMs = now.getTime();
  let code = "";
  let tier = 0;
  for (const promotion of promotions) {
    if (promotion.status !== "active") continue;
    if (promotion.startsAt && new Date(promotion.startsAt).getTime() > nowMs) continue;
    const end = promotion.endsAt ? new Date(promotion.endsAt).getTime() : 0;
    if (!promotion.endsAt || end <= nowMs) continue;
    const rank = TIER[promotion.code.trim().toLowerCase()] ?? 0;
    if (rank > tier) {
      tier = rank;
      code = promotion.code;
    }
  }
  return code;
}

async function promotionsFor(ids: Types.ObjectId[], now: Date) {
  if (ids.length === 0) return new Map<string, RankPromotion[]>();
  const orders = await PromotionOrder.find({
    listingId: { $in: ids },
    status: "active",
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).lean();
  const productIds = [...new Set(orders.map((order) => String(order.productId)))];
  const products = await PromotionProduct.find({ _id: { $in: productIds } }).select("code").lean();
  const codeById = new Map(products.map((product) => [String(product._id), product.code]));
  const byListing = new Map<string, RankPromotion[]>();
  for (const order of orders) {
    const code = codeById.get(String(order.productId));
    if (!code) continue;
    const list = byListing.get(String(order.listingId)) ?? [];
    list.push({ code, status: order.status, startsAt: order.startsAt, endsAt: order.endsAt });
    byListing.set(String(order.listingId), list);
  }
  return byListing;
}

async function photoMap(docs: Row[]) {
  const ids = docs.flatMap((doc) => doc.mediaIds ?? []);
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const assets = await MediaAsset.find({ _id: { $in: ids } }).select("objectKey").lean();
  const url = new Map(assets.map((asset) => [String(asset._id), asset.objectKey]));
  for (const doc of docs) {
    const photos = (doc.mediaIds ?? [])
      .map((id) => url.get(String(id)))
      .filter((value): value is string => Boolean(value && (value.startsWith("/") || value.startsWith("http"))));
    map.set(String(doc._id), photos);
  }
  return map;
}

function publicIdOf(slug: string | undefined, id: string) {
  const suffix = slug?.split("-").pop();
  if (suffix && suffix.length >= 4 && suffix !== slug) return suffix;
  return id.slice(-6);
}

function ageOf(attributes?: Record<string, unknown>) {
  const age = attributes?.age;
  return typeof age === "number" ? age : undefined;
}

function detailRows(attributes?: Record<string, unknown>) {
  if (!attributes) return [];
  return Object.entries(attributes)
    .filter(([key, value]) => key !== "age" && key !== "nickname" && (typeof value === "string" || typeof value === "number") && String(value).trim())
    .slice(0, 8)
    .map(([key, value]) => ({ label: key.replace(/[-_]/g, " "), value: String(value) }));
}

export async function buildFilter(input: ListingQuery): Promise<QueryFilter<ListingDoc> | null> {
  const [categories, locations] = await Promise.all([loadCategories(), loadLocations()]);
  const filter: Record<string, unknown> = { status: "active" };
  if (input.categorySlug) {
    const category = categories.find(
      (row) => row.enabled !== false && !row.deletedAt && matchSlug(row, input.categorySlug ?? ""),
    );
    if (!category?._id) return null;
    filter.categoryId = category._id;
  }
  const loc = (slug: string | undefined, type: LocationRow["type"]) =>
    slug
      ? locations.find((row) => row.enabled !== false && row.type === type && matchSlug(row, slug))
      : undefined;
  if (input.citySlug) {
    const city = loc(input.citySlug, "city");
    if (!city?._id) return null;
    filter.cityId = city._id;
  }
  if (input.stateSlug) {
    const state = loc(input.stateSlug, "state");
    if (!state?._id) return null;
    filter.stateId = state._id;
  }
  if (input.districtSlug) {
    const district = loc(input.districtSlug, "district");
    if (!district?._id) return null;
    filter.districtId = district._id;
  }
  if (input.areaSlug) {
    const area = locations.find(
      (row) =>
        row.enabled !== false &&
        (row.type === "district" || row.type === "locality") &&
        matchSlug(row, input.areaSlug ?? ""),
    );
    if (!area?._id) return null;
    if (area.type === "district") filter.districtId = area._id;
    else filter.localityId = area._id;
  }
  if (input.placeSlug) {
    const matches = locations.filter(
      (row) =>
        row.enabled !== false &&
        (row.type === "city" || row.type === "state" || row.type === "district") &&
        matchSlug(row, input.placeSlug ?? ""),
    );
    if (matches.length === 0) return null;
    filter.$or = matches.map((row) => {
      if (row.type === "city") return { cityId: row._id };
      if (row.type === "state") return { stateId: row._id };
      return { districtId: row._id };
    });
  }
  const badges: string[] = [];
  if (input.verified) badges.push("verified");
  if (input.badge && !badges.includes(input.badge)) badges.push(input.badge);
  if (badges.length === 1) filter.badges = badges[0];
  if (badges.length > 1) filter.badges = { $all: badges };
  if (input.photos) filter["mediaIds.0"] = { $exists: true };
  if (input.slug) filter.slug = input.slug;
  else if (input.excludeSlug) filter.slug = { $ne: input.excludeSlug };
  if (input.attributes && Object.keys(input.attributes).length > 0) {
    const category = input.categorySlug
      ? categories.find((row) => matchSlug(row, input.categorySlug ?? ""))
      : undefined;
    const allowed = category
      ? new Set(
          (category.fields ?? [])
            .filter((field) => field.filterable !== false && field.enabled !== false)
            .map((field) => field.key),
        )
      : null;
    for (const [key, value] of Object.entries(input.attributes)) {
      if (!/^[a-z0-9-]{1,40}$/.test(key)) continue;
      if (allowed && !allowed.has(key)) continue;
      const path = `attributes.${key}`;
      if (Array.isArray(value)) filter[path] = { $in: value.map(String) };
      else filter[path] = value;
    }
  }
  return filter as QueryFilter<ListingDoc>;
}

async function findRows(filter: QueryFilter<ListingDoc>, q?: string): Promise<Row[]> {
  const text = q ? cleanQuery(q) : "";
  if (!text) return Listing.find(filter).lean() as Promise<Row[]>;
  const [categories, locations] = await Promise.all([loadCategories(), loadLocations()]);
  const textMatch = searchTextMatch(text, categories, locations);
  if (!textMatch) return Listing.find(filter).lean() as Promise<Row[]>;
  if (filter.$or) {
    const { $or, ...rest } = filter;
    return (await Listing.find({ ...rest, $and: [{ $or }, textMatch] }).lean()) as Row[];
  }
  return (await Listing.find({ ...filter, ...textMatch }).lean()) as Row[];
}

function facetsFrom(hits: PublicHit[]): SearchFacets {
  const categories = new Map<string, number>();
  const cities = new Map<string, number>();
  for (const hit of hits) {
    if (hit.categorySlug) categories.set(hit.categorySlug, (categories.get(hit.categorySlug) ?? 0) + 1);
    if (hit.citySlug) cities.set(hit.citySlug, (cities.get(hit.citySlug) ?? 0) + 1);
  }
  const pack = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return { categories: pack(categories), cities: pack(cities) };
}

export async function presentRows(docs: Row[], promotions: Map<string, RankPromotion[]>, now: Date) {
  const [categories, locations, photos] = await Promise.all([loadCategories(), loadLocations(), photoMap(docs)]);
  const hits: PublicHit[] = [];
  const legacy: LegacyListing[] = [];
  for (const doc of docs) {
    const id = String(doc._id);
    const view = publicView(doc as ListingDoc);
    const categorySlug = slugOf(categories, doc.categoryId);
    const stateSlug = slugOf(locations, doc.stateId);
    const citySlug = slugOf(locations, doc.cityId);
    const districtSlug = slugOf(locations, doc.districtId);
    const place = nameOf(locations, doc.districtId) || nameOf(locations, doc.cityId);
    const code = bestCode(promotions.get(id) ?? [], now);
    const variant = VARIANT[code.trim().toLowerCase()] ?? "free";
    const verified = doc.badges?.includes("verified") === true;
    const bumped = doc.bumpedAt ? new Date(doc.bumpedAt) : doc.publishedAt;
    const publicId = publicIdOf(doc.slug, id);
    const photoList = listingPhotos(categorySlug, publicId, photos.get(id) ?? []);
    const age = ageOf(doc.attributes);
    hits.push({
      ...view,
      categorySlug,
      stateSlug,
      citySlug,
      districtSlug,
      place,
      publicId,
      photos: photoList,
      verified,
      variant,
      lastBumpedAt: bumped ? new Date(bumped).toISOString() : null,
      displayName: doc.title,
      ...(age !== undefined ? { age } : {}),
    });
    legacy.push({
      slug: doc.slug,
      publicId,
      title: doc.title,
      description: doc.description,
      displayName: doc.title,
      age,
      categorySlug,
      stateSlug,
      citySlug,
      districtSlug,
      place,
      photos: photoList,
      details: detailRows(doc.attributes),
      variant,
      verified,
      lastBumpedAt: bumped ? new Date(bumped) : undefined,
      publishedAt: doc.publishedAt,
      status: "live",
    });
  }
  return { hits, legacy };
}

export async function queryListings(input: ListingQuery): Promise<SearchResult> {
  await connectDb();
  const filter = await buildFilter(input);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  if (!filter) return { hits: [], legacy: [], total: 0, facets: { categories: [], cities: [] } };
  const docs = await findRows(filter, input.q);
  const now = new Date();
  const promotions = await promotionsFor(
    docs.map((doc) => doc._id),
    now,
  );
  const ranked = docs
    .map((doc) => {
      const promos = promotions.get(String(doc._id)) ?? [];
      return {
        doc,
        promos,
        score: rankScore(
          { badges: doc.badges, bumpedAt: doc.bumpedAt, publishedAt: doc.publishedAt },
          promos,
          now,
        ),
        code: bestCode(promos, now).trim().toLowerCase(),
      };
    })
    .filter((row) => (input.starOnly ? row.code === "star" : true))
    .filter((row) => (input.excludeStar ? row.code !== "star" : true));
  ranked.sort((a, b) => {
    if ((input.sort ?? "ranked") === "fresh") {
      return b.score.freshness - a.score.freshness || (a.doc.slug ?? "").localeCompare(b.doc.slug ?? "");
    }
    return compareRank(a.score, b.score) || (a.doc.slug ?? "").localeCompare(b.doc.slug ?? "");
  });
  const ordered = ranked.map((row) => row.doc);
  const promoMap = new Map(ranked.map((row) => [String(row.doc._id), row.promos]));
  const presented = await presentRows(ordered, promoMap, now);
  const start = (page - 1) * pageSize;
  return {
    hits: presented.hits.slice(start, start + pageSize),
    legacy: presented.legacy.slice(start, start + pageSize),
    total: presented.hits.length,
    facets: facetsFrom(presented.hits),
  };
}

export async function countMatching(input: ListingQuery) {
  await connectDb();
  const filter = await buildFilter(input);
  if (!filter) return 0;
  return Listing.countDocuments(filter);
}

export function presentCategory(doc: CategoryDoc) {
  return {
    _id: doc._id,
    slug: doc.slug,
    name: doc.name,
    description: doc.description ?? "",
    order: doc.order ?? 0,
    status: doc.enabled === false ? "disabled" : "active",
    enabled: doc.enabled !== false,
    showOnHome: true,
    homeBlurb: doc.description ?? "",
    homeCities: [...TOP_CITY_SLUGS],
    icon: "",
    color: "",
    starEnabled: false,
    moreLabel: "More cities",
    oldSlugs: doc.oldSlugs ?? [],
    deletedAt: doc.deletedAt ?? null,
    minListingsIndex: doc.minListingsIndex ?? 3,
    minListingsLocality: doc.minListingsLocality ?? 10,
    fields: doc.fields ?? [],
  };
}

export async function publicCategories() {
  const rows = await loadCategories();
  return rows
    .filter((row) => row.enabled !== false && !row.deletedAt)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    .map((row) => presentCategory(row));
}

export async function categoryBySlug(slug: string) {
  const rows = await loadCategories();
  const doc = rows.find((row) => row.enabled !== false && !row.deletedAt && matchSlug(row, slug));
  return doc ? presentCategory(doc) : null;
}
