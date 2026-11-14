import { cached } from "./cache";
import { mergeTemplates } from "@/lib/seo/landing";
import { connectDb } from "./db";
import {
  AttributeGroup,
  Banner,
  BlogPost,
  CreditPack,
  FeatureFlag,
  HelpArticle,
  Listing,
  Page,
  SeoTemplate,
  Site,
} from "@/server/models";
import { loadCategories, categoryBySlug, countMatching, publicCategories, queryListings, type ListingQuery } from "@/server/search";
import { cities, districts, loadLocations, locationBySlug, siblingCities, states, topCities } from "@/server/locations";
import type { ListingDoc } from "@/lib/models";
import { readContent } from "@/lib/ui/site-content";

const PAGE_SIZE = 25;
const THIN = 3;

export async function getSite() {
  return cached(
    "site",
    60_000,
    async () => {
      await connectDb();
      return (
        (await Site.findOne({ key: "default" }).lean()) ?? {
          name: "Tharkoo",
          tagline: "Tharkoo, premium classifieds in India.",
          legalName: "SparkBeta Tech",
          countryName: "India",
          supportHours: "Mon-Fri 14:00-20:00 IST",
          ageGateEnabled: true,
        }
      );
    },
    ["site"],
    true,
  );
}

export async function getHomepageContent() {
  const site = await getSite();
  return readContent((site as { homepage?: unknown }).homepage);
}

export async function getCategories() {
  return cached("categories", 60_000, async () => publicCategories(), ["categories"], true);
}

export async function getCategory(slug: string) {
  return categoryBySlug(slug);
}

export async function getLocationBySlug(slug: string) {
  return locationBySlug(slug);
}

export async function getCities(limit?: number) {
  return cached(`cities:${limit || "all"}`, 60_000, async () => cities(limit), ["locations"], true);
}

export async function getTopCities() {
  return cached("top-cities", 60_000, async () => topCities(), ["locations"], true);
}

export async function getSiblingCities(stateSlug: string) {
  return siblingCities(stateSlug);
}

export async function getDistricts(citySlug: string) {
  return districts(citySlug);
}

export async function getStates() {
  return states();
}

export async function getSeo(pageType: string) {
  await connectDb();
  return SeoTemplate.findOne({ pageType }).lean();
}

/** Page-type template, with the category-specific template (key "type:category") winning field by field. */
export async function getSeoFor(pageType: string, categorySlug?: string, fallbackType?: string) {
  await connectDb();
  const base =
    (await SeoTemplate.findOne({ pageType }).lean()) ??
    (fallbackType ? await SeoTemplate.findOne({ pageType: fallbackType }).lean() : null);
  if (!categorySlug || !/^[a-z0-9-]{1,60}$/.test(categorySlug)) return base;
  const specific = await SeoTemplate.findOne({ pageType: `${pageType}:${categorySlug}` }).lean();
  return mergeTemplates(base, specific);
}

function pageQuery(filter: Record<string, unknown>): ListingQuery {
  const photos = filter.photos;
  const photosOn =
    photos === true || (typeof photos === "object" && photos !== null && "$exists" in (photos as object));
  return {
    categorySlug: typeof filter.categorySlug === "string" ? filter.categorySlug : undefined,
    citySlug: typeof filter.citySlug === "string" ? filter.citySlug : undefined,
    stateSlug: typeof filter.stateSlug === "string" ? filter.stateSlug : undefined,
    districtSlug: typeof filter.districtSlug === "string" ? filter.districtSlug : undefined,
    verified: filter.verified === true ? true : undefined,
    photos: photosOn,
    tag: typeof filter.tag === "string" ? filter.tag : undefined,
  };
}

export async function countListings(filter: Record<string, unknown>) {
  return countMatching(pageQuery(filter));
}

export async function getStarListings(filter: Record<string, unknown>, limit = 6) {
  const result = await queryListings({ ...pageQuery(filter), page: 1, pageSize: limit, starOnly: true });
  return result.legacy;
}

export async function getFeed(filter: Record<string, unknown>, page = 1) {
  const safePage = Math.max(1, Number(page) || 1);
  return cached(
    `feed:${JSON.stringify(filter)}:${safePage}`,
    60_000,
    async () => {
      const result = await queryListings({
        ...pageQuery(filter),
        page: safePage,
        pageSize: PAGE_SIZE,
        excludeStar: true,
        sort: "ranked",
      });
      return {
        items: result.legacy,
        total: result.total,
        page: safePage,
        pageSize: PAGE_SIZE,
        pages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
      };
    },
    ["feed", "listings"],
    true,
  );
}

export type LatestListing = {
  slug: string;
  title: string;
  publishedAt: string;
  categorySlug: string;
  citySlug: string;
  publicId: string;
};

export async function getLatestListings(limit = 12): Promise<LatestListing[]> {
  const size = Math.min(12, Math.max(1, limit));
  return cached(
    `latest:${size}`,
    60_000,
    async () => {
      await connectDb();
      const now = new Date();
      const docs = await Listing.find({
        status: "active",
        feedHidden: { $ne: true },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
      })
        .sort({ publishedAt: -1, _id: -1 })
        .limit(size)
        .select("slug title publishedAt categoryId cityId")
        .lean<
          {
            slug?: string;
            title?: string;
            publishedAt?: Date;
            categoryId?: unknown;
            cityId?: unknown;
          }[]
        >();
      const [categories, locations] = await Promise.all([loadCategories(), loadLocations()]);
      const categorySlug = new Map(categories.map((row) => [String(row._id), row.slug || ""]));
      const citySlug = new Map(locations.map((row) => [String(row._id), row.slug || ""]));
      return docs
        .filter((doc) => doc.slug)
        .map((doc) => ({
          slug: doc.slug || "",
          title: doc.title || "",
          publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : "",
          categorySlug: categorySlug.get(String(doc.categoryId)) || "",
          citySlug: citySlug.get(String(doc.cityId)) || "",
          publicId: (doc.slug || "").split("-").pop() || "",
        }));
    },
    ["feed", "listings"],
    true,
  );
}

export async function getListingBySlug(slug: string) {
  if (!slug || slug.length > 160) return null;
  await connectDb();
  const publicId = slug.split("-").pop() || "";
  const exact = await Listing.findOne({ status: "active", slug }).select("slug").lean();
  const suffix =
    exact || !publicId || publicId === slug
      ? null
      : await Listing.findOne({
          status: "active",
          slug: new RegExp(`-${publicId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
        })
          .select("slug")
          .lean();
  const resolved = exact?.slug ?? suffix?.slug;
  if (!resolved) return null;
  const result = await queryListings({ slug: resolved, page: 1, pageSize: 1 });
  return result.legacy[0] ?? null;
}

export async function getRelated(listing: ListingDoc, limit = 6) {
  const result = await queryListings({
    categorySlug: listing.categorySlug,
    citySlug: listing.citySlug,
    excludeSlug: listing.slug,
    page: 1,
    pageSize: limit,
  });
  return result.legacy;
}

export async function searchListings(opts: {
  q?: string;
  category?: string;
  location?: string;
  photos?: boolean;
  verified?: boolean;
  page?: number;
}) {
  const safePage = Math.max(1, Number(opts.page) || 1);
  return cached(
    `search:${JSON.stringify(opts)}:${safePage}`,
    10_000,
    async () => {
      const result = await queryListings({
        q: opts.q,
        categorySlug: opts.category,
        placeSlug: opts.location,
        photos: opts.photos,
        verified: opts.verified,
        page: safePage,
        pageSize: PAGE_SIZE,
        sort: "ranked",
      });
      return {
        items: result.legacy,
        total: result.total,
        page: safePage,
        pageSize: PAGE_SIZE,
        pages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
      };
    },
    ["feed", "listings"],
  );
}

export async function listingCountsByCategoryCity() {
  return cached(
    "listing-counts",
    30_000,
    async () => {
      await connectDb();
      const grouped = await Listing.aggregate<{
        _id: { categoryId: unknown; cityId: unknown };
        n: number;
      }>([
        { $match: { status: "active", feedHidden: { $ne: true }, categoryId: { $exists: true }, cityId: { $exists: true } } },
        { $group: { _id: { categoryId: "$categoryId", cityId: "$cityId" }, n: { $sum: 1 } } },
      ]);
      const [categories, locations] = await Promise.all([loadCategories(), loadLocations()]);
      const categorySlug = new Map(categories.map((row) => [String(row._id), row.slug]));
      const citySlug = new Map(locations.map((row) => [String(row._id), row.slug]));
      return grouped
        .map((row) => ({
          _id: {
            categorySlug: categorySlug.get(String(row._id.categoryId)) ?? "",
            citySlug: citySlug.get(String(row._id.cityId)) ?? "",
          },
          n: row.n,
        }))
        .filter((row) => row._id.categorySlug && row._id.citySlug);
    },
    ["counts", "listings"],
    true,
  );
}

export function isThin(count: number, minimum = THIN) {
  return count < (minimum > 0 ? minimum : THIN);
}

export function pageOutOfRange(raw: string | undefined, pages: number) {
  if (raw === undefined || raw === "") return false;
  if (!/^[1-9]\d*$/.test(raw)) return true;
  return Number(raw) > Math.max(1, pages);
}

export async function getPage(slug: string) {
  await connectDb();
  return Page.findOne({ slug, status: "published" }).lean();
}

export async function getHelpArticles() {
  await connectDb();
  return HelpArticle.find({ status: "published" }).sort({ order: 1 }).lean();
}

export async function getHelp(slug: string) {
  await connectDb();
  return HelpArticle.findOne({ slug, status: "published" }).lean();
}

export async function getBlogPosts() {
  await connectDb();
  return BlogPost.find({ status: "published" }).lean();
}

export async function getBlog(slug: string) {
  await connectDb();
  return BlogPost.findOne({ slug, status: "published" }).lean();
}

export async function getCreditPacks() {
  await connectDb();
  return CreditPack.find({ status: "active" }).sort({ order: 1 }).lean();
}

export async function getBanners(slot?: string) {
  await connectDb();
  const q = slot ? { slot, enabled: true } : { enabled: true };
  return Banner.find(q).sort({ order: 1 }).lean();
}

export async function getFlags() {
  await connectDb();
  return FeatureFlag.find().lean();
}

export async function getAttributeGroups() {
  await connectDb();
  return AttributeGroup.find().sort({ order: 1 }).lean();
}

export { PAGE_SIZE };
